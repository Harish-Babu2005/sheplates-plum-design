import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const CURRENT_VENDOR_TERMS_VERSION = "1.0";
export const VENDOR_TERMS_DOCUMENT_REF = "/docs/sheplates-vendor-terms-v1.0.pdf";

function getClients(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !token) return null;

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { caller, admin, token };
}

export async function POST(request: Request) {
  const c = getClients(request);
  if (!c) {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }

  const { data: authData } = await c.caller.auth.getUser(c.token);
  if (!authData.user) {
    return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  }

  const { data: profile } = await c.caller
    .from("profiles")
    .select("id,full_name,role,vendor_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!profile || !["vendor", "operations", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Vendor or authorized staff access is required." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const action = String(body.action || "submit_onboarding");

  // Action: Accept updated terms for an existing vendor
  if (action === "accept_terms") {
    const vendorId = String(body.vendorId || profile.vendor_id || "");
    const termsVersion = String(body.termsVersion || CURRENT_VENDOR_TERMS_VERSION).trim();
    if (!vendorId) return NextResponse.json({ error: "Vendor ID is required." }, { status: 400 });

    const { data: vendor } = await c.admin
      .from("vendors")
      .select("id,owner_id")
      .eq("id", vendorId)
      .maybeSingle();

    if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    if (profile.role === "vendor" && vendor.owner_id !== authData.user.id) {
      return NextResponse.json({ error: "Not authorized to accept terms for another vendor." }, { status: 403 });
    }

    const acceptedAt = new Date().toISOString();
    const docRef = String(body.documentReference || VENDOR_TERMS_DOCUMENT_REF);

    const updateRes = await c.admin
      .from("vendors")
      .update({
        terms_accepted: true,
        terms_version: termsVersion,
        terms_accepted_at: acceptedAt,
        terms_document_reference: docRef,
        updated_at: acceptedAt,
      })
      .eq("id", vendorId);

    if (updateRes.error) throw updateRes.error;

    // Log in history table
    await c.admin.from("vendor_terms_acceptances").insert({
      vendor_id: vendorId,
      user_id: authData.user.id,
      terms_version: termsVersion,
      terms_accepted: true,
      terms_accepted_at: acceptedAt,
      terms_document_reference: docRef,
    });

    return NextResponse.json({
      ok: true,
      vendorId,
      termsVersion,
      termsAccepted: true,
      termsAcceptedAt: acceptedAt,
    });
  }

  // Action: Submit vendor onboarding application
  if (action === "submit_onboarding") {
    // 1. Strict backend Terms & Conditions enforcement
    const termsAccepted = body.termsAccepted === true;
    if (!termsAccepted) {
      return NextResponse.json(
        { error: "You must review and agree to the Sheplates Vendor Terms & Conditions before submitting onboarding." },
        { status: 400 }
      );
    }

    const termsVersion = String(body.termsVersion || CURRENT_VENDOR_TERMS_VERSION).trim();
    const termsDocRef = String(body.termsDocumentReference || VENDOR_TERMS_DOCUMENT_REF);
    const serverTimestamp = new Date().toISOString();

    const businessName = String(body.businessName || "").trim();
    const category = String(body.category || "").trim();
    const address = String(body.address || body.locality || "").trim();
    const fssaiNumber = String(body.fssaiNumber || "").trim();
    const expiryDate = String(body.expiryDate || "").trim();
    const certificateStoragePath = String(body.certificateStoragePath || "").trim();

    // PAN, bank and registration numbers are kept with their document (vendor_documents: only the vendor and
    // Operations can read it), never as columns on the vendor row that customers can see.

    // Optional list of additional compliance documents
    const rawDocuments = Array.isArray(body.documents) ? (body.documents as Array<Record<string, unknown>>) : [];

    // Enforce PDF-only validation for all submitted documents
    for (const doc of rawDocuments) {
      const fileName = String(doc.fileName || "").toLowerCase();
      const storagePath = String(doc.storagePath || "").toLowerCase();
      const mimeType = String(doc.mimeType || "").toLowerCase();

      const isPdf =
        mimeType === "application/pdf" ||
        fileName.endsWith(".pdf") ||
        storagePath.endsWith(".pdf") ||
        !storagePath; // allow placeholder if not uploaded yet

      if (!isPdf) {
        return NextResponse.json(
          { error: `Document "${doc.fileName || doc.documentType}" must be in PDF format (.pdf) only.` },
          { status: 400 }
        );
      }
    }

    if (!businessName || !category || !address || !fssaiNumber || !expiryDate) {
      return NextResponse.json({ error: "All business and certification fields are required." }, { status: 400 });
    }

    // Determine target owner user ID: vendor self-onboarding or staff assigning
    const targetUserId = profile.role === "vendor" ? authData.user.id : String(body.userId || authData.user.id);

    // A stored file must live in the owner's own folder, so an application can never point at somebody else's upload.
    for (const doc of rawDocuments) {
      const path = String(doc.storagePath || "");
      if (path && !path.startsWith(`${targetUserId}/`)) {
        return NextResponse.json({ error: `Document "${doc.fileName || doc.documentType}" is not stored in the owner's folder.` }, { status: 400 });
      }
    }
    if (certificateStoragePath && !certificateStoragePath.startsWith(`${targetUserId}/`)) {
      return NextResponse.json({ error: "The certificate is not stored in the owner's folder." }, { status: 400 });
    }

    // 2. Insert vendor record with verified terms acceptance & server-generated timestamp
    const vendorInsert = await c.admin
      .from("vendors")
      .insert({
        owner_id: targetUserId,
        name: businessName,
        category,
        locality: address,
        address,
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        service_radius_km: body.radiusKm != null ? Number(body.radiusKm) : 5,
        delivery_enabled: body.delivery !== false,
        pickup_enabled: body.pickup !== false,
        store_open_today: false,
        verification_status: "submitted",
        operational_status: "inactive",
        marketplace_visible: false,
        terms_accepted: true,
        terms_version: termsVersion,
        terms_accepted_at: serverTimestamp,
        terms_document_reference: termsDocRef,
        ...(body.logoUrl ? { logo_url: String(body.logoUrl) } : body.logo_url ? { logo_url: String(body.logo_url) } : {}),
        ...(body.bannerUrl ? { banner_url: String(body.bannerUrl) } : body.banner_url ? { banner_url: String(body.banner_url) } : {}),
        ...(body.bio ? { description: String(body.bio) } : body.description ? { description: String(body.description) } : {}),
        ...(body.operatingHours ? { operating_hours: body.operatingHours } : {}),
      })
      .select("id")
      .single();

    if (vendorInsert.error || !vendorInsert.data) {
      return NextResponse.json(
        { error: vendorInsert.error?.message || "Failed to create vendor record." },
        { status: 500 }
      );
    }

    const vendorId = vendorInsert.data.id as string;

    // 3. Insert compliance documents
    let fssaiInserted = false;
    for (const doc of rawDocuments) {
      const docType = String(doc.documentType || "document");
      if (docType === "food_certificate") fssaiInserted = true;
      await c.admin.from("vendor_documents").insert({
        vendor_id: vendorId,
        document_type: docType,
        document_number: doc.documentNumber ? String(doc.documentNumber).trim() : null,
        storage_path: String(doc.storagePath || "pending-upload"),
        file_name: doc.fileName ? String(doc.fileName) : null,
        file_size: typeof doc.fileSize === "number" ? doc.fileSize : null,
        mime_type: "application/pdf",
        expiry_date: doc.expiryDate ? String(doc.expiryDate) : null,
        verification_status: "submitted",
        metadata: (doc.metadata as Record<string, unknown>) || {},
      });
    }

    // Insert FSSAI document if not already inserted from documents array
    if (!fssaiInserted && fssaiNumber) {
      await c.admin.from("vendor_documents").insert({
        vendor_id: vendorId,
        document_type: "food_certificate",
        document_number: fssaiNumber,
        storage_path: certificateStoragePath || "pending-upload",
        file_name: certificateStoragePath.split("/").pop() || "fssai-certificate.pdf",
        mime_type: "application/pdf",
        expiry_date: expiryDate,
        verification_status: "submitted",
      });
    }

    // 4. Link profile to the newly created vendor
    await c.admin.from("profiles").update({ vendor_id: vendorId }).eq("id", targetUserId);

    // 5. Explicitly log terms acceptance in history table
    await c.admin.from("vendor_terms_acceptances").insert({
      vendor_id: vendorId,
      user_id: targetUserId,
      terms_version: termsVersion,
      terms_accepted: true,
      terms_accepted_at: serverTimestamp,
      terms_document_reference: termsDocRef,
    });

    return NextResponse.json(
      {
        ok: true,
        vendorId,
        termsAccepted: true,
        termsVersion,
        termsAcceptedAt: serverTimestamp,
      },
      { status: 201 }
    );
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

