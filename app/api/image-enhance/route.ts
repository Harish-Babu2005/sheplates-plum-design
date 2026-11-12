import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uruvImageEdit, uruvApiKey, UruvAiError } from "@/lib/uruv-ai";

async function authoriseVendorOrAdmin(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
  const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).maybeSingle();
  return profile?.role === "vendor" || profile?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await authoriseVendorOrAdmin(request))) return NextResponse.json({ error: "Vendor or Super Admin access is required." }, { status: 403 });
  if (!uruvApiKey()) return NextResponse.json({ error: "Image enhancement is temporarily unavailable." }, { status: 503 });

  const body = await request.json() as { imageDataUrl?: string; productName?: string; name?: string; category?: string };
  const match = body.imageDataUrl?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Upload a valid product image first." }, { status: 400 });

  const mime = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 10 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 10 MB. Please upload a smaller photo." }, { status: 413 });

  const productName = String(body.productName ?? body.name ?? "").trim().slice(0, 60);

  const form = new FormData();
  form.append("model", process.env.AI_IMAGE_MODEL || process.env.URUV_IMAGE_MODEL || "uruv-image");
  form.append("image", new Blob([bytes], { type: mime }), "product-upload.png");
  form.append("size", "1024x1024");
  form.append("quality", "medium");
  form.append("prompt", `Create a polished marketplace product photo for Sheplates from this vendor-uploaded image. Product: ${productName || "food product"}. Category: ${body.category || "food"}. Preserve the actual product identity, pack, ingredients and visible quantity. Improve lighting, framing, sharpness and background only. Use a clean premium food-commerce aesthetic with natural realistic colors, soft daylight, uncluttered neutral background and no text overlays, fake labels, extra ingredients, people or misleading quantity changes. The result must still honestly represent the uploaded product.`);

  try {
    const json = await uruvImageEdit(form);
    const item = json.data?.[0];
    if (item?.b64_json) return NextResponse.json({ imageDataUrl: `data:image/png;base64,${item.b64_json}`, source: "uruv" });
    if (item?.url) return NextResponse.json({ imageUrl: item.url, source: "uruv" });
    return NextResponse.json({ error: "Image enhancement returned no image." }, { status: 502 });
  } catch (err) {
    const status = err instanceof UruvAiError ? err.status : 502;
    return NextResponse.json({ error: err instanceof Error && err.message ? err.message : "Image enhancement failed." }, { status });
  }
}
