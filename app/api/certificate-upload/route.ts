import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !token) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth } = await caller.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { data: profile } = await caller.from("profiles").select("role,vendor_id").eq("id", auth.user.id).maybeSingle();
  if (!profile || !["vendor", "operations", "admin"].includes(profile.role)) return NextResponse.json({ error: "Vendor or authorized staff access is required." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const vendorId = String(form.get("vendorId") || profile.vendor_id || "");
  const outletId = String(form.get("outletId") || "");
  const documentNumber = String(form.get("documentNumber") || "").trim();
  const expiryDate = String(form.get("expiryDate") || "").trim();
  if (expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
    const today = new Date().toISOString().slice(0, 10);
    if (expiryDate < today) {
      return NextResponse.json({ error: "Expiry date cannot be in the past." }, { status: 400 });
    }
  }
  if (!(file instanceof File) || !vendorId) return NextResponse.json({ error: "Choose a certificate file." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "The uploaded file is empty (0 bytes). Please upload a valid certificate file." }, { status: 400 });
  if (profile.role === "vendor" && profile.vendor_id !== vendorId) return NextResponse.json({ error: "This certificate belongs to another store." }, { status: 403 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Certificate must be under 10 MB." }, { status: 413 });
  // Enforce PDF-only by real MIME type, not just file extension
  if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF files are accepted for certificates. Upload a .pdf file." }, { status: 400 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: vendor, error: vendorError } = await admin.from("vendors")
    .select("id,vendor_kind")
    .eq("id", vendorId)
    .maybeSingle();
  if (vendorError) return NextResponse.json({ error: "Vendor record could not be verified." }, { status: 500 });
  if (!vendor) return NextResponse.json({ error: "Vendor record was not found." }, { status: 404 });

  if (vendor.vendor_kind === "p0_connect") {
    if (profile.role === "vendor") return NextResponse.json({ error: "P0 Connect vendors do not have vendor login accounts." }, { status: 403 });
    if (profile.role === "operations") {
      const { data: allowed, error: permissionError } = await admin.rpc("p0_actor_can", {
        p_actor: auth.user.id,
        p_action: "upload",
      });
      if (permissionError || allowed !== true) return NextResponse.json({ error: "Your Operations account is not authorized to upload P0 certificates." }, { status: 403 });
    }
    if (!documentNumber || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
      return NextResponse.json({ error: "P0 certificates require a certificate number and expiry date." }, { status: 400 });
    }
    if (outletId) return NextResponse.json({ error: "P0 certificates must be attached to the vendor record, not an outlet." }, { status: 400 });
  } else if (profile.role === "operations") {
    return NextResponse.json({ error: "Operations certificate upload is limited to authorized P0 vendors." }, { status: 403 });
  }

  const buckets = await admin.storage.listBuckets();
  if (!buckets.data?.some((bucket) => bucket.name === "vendor-certificates")) {
    const created = await admin.storage.createBucket("vendor-certificates", { public: false, fileSizeLimit: "10MB", allowedMimeTypes: ["application/pdf"] });
    if (created.error && !/already exists/i.test(created.error.message)) return NextResponse.json({ error: "Certificate storage could not be prepared." }, { status: 500 });
  }
  const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || (file.type === "application/pdf" ? "pdf" : "jpg");
  const path = `${vendorId}/${outletId || "main"}/${crypto.randomUUID()}.${ext}`;
  const uploaded = await admin.storage.from("vendor-certificates").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 500 });
  if (outletId) await admin.from("vendor_outlets").update({ certificate_storage_path: path, updated_at: new Date().toISOString() }).eq("id", outletId).eq("vendor_id", vendorId);
  else if (vendor.vendor_kind === "p0_connect") {
    const saved = await admin.from("vendor_documents").insert({
      vendor_id: vendorId,
      document_type: "food_certificate",
      document_number: documentNumber,
      storage_path: path,
      expiry_date: expiryDate,
      verification_status: "submitted",
    });
    if (saved.error) return NextResponse.json({ error: "The file uploaded but its certificate record could not be saved. Retry with a new upload." }, { status: 500 });
  }
  else {
    const newDoc: Record<string, unknown> = {
      vendor_id: vendorId,
      document_type: "food_certificate",
      document_number: documentNumber || null,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || "application/pdf",
      expiry_date: expiryDate || null,
      verification_status: "submitted",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    let docRes = await admin.from("vendor_documents").insert(newDoc);
    if (docRes.error && /file_name|file_size|mime_type/i.test(docRes.error.message)) {
      delete newDoc.file_name;
      delete newDoc.file_size;
      delete newDoc.mime_type;
      await admin.from("vendor_documents").insert(newDoc);
    }
  }
  return NextResponse.json({ path, fileName: file.name });
}
