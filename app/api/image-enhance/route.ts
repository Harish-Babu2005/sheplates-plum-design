import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uruvImageEdit, uruvApiKey, UruvAiError } from "@/lib/uruv-ai";
import { adminClient } from "@/lib/product-image-server";
import { checkVendorAiCredits, deductVendorAiCredits } from "@/lib/ai-credits-server";
import { validateFoodName } from "@/lib/food-name-validator";

async function callerFromRequest(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false") return { role: "vendor", vendorId: null };
    return null;
  }
  const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role,vendor_id").eq("id", authData.user.id).maybeSingle();
  if (!profile) return null;
  return { role: String(profile.role), vendorId: (profile.vendor_id as string | null) ?? null };
}

export async function POST(request: Request) {
  const caller = await callerFromRequest(request);
  if (!caller || !["vendor", "admin", "operations"].includes(caller.role)) {
    return NextResponse.json({ error: "Vendor or Super Admin access is required." }, { status: 403 });
  }
  if (!uruvApiKey()) return NextResponse.json({ error: "Image enhancement is temporarily unavailable." }, { status: 503 });

  const admin = adminClient();
  if (caller.role === "vendor" && caller.vendorId && admin) {
    const creditCheck = await checkVendorAiCredits(admin, caller.vendorId, "image_enhance");
    if (!creditCheck.allowed) {
      return NextResponse.json({
        error: creditCheck.message || "Insufficient AI credits to enhance images.",
        code: "insufficient_credits",
        buyCreditsUrl: "/?view=Buy+credits",
        balance: creditCheck.balance,
        cost: creditCheck.cost,
      }, { status: 402 });
    }
  }

  const body = await request.json() as { imageDataUrl?: string; productName?: string; name?: string; category?: string };
  const match = body.imageDataUrl?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Upload a valid product image first." }, { status: 400 });

  const mime = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 10 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 10 MB. Please upload a smaller photo." }, { status: 413 });

  const productName = String(body.productName ?? body.name ?? "").trim().slice(0, 60);
  const category = String(body.category ?? "").trim();

  // Food-name guard: block AI enhancement for non-food product names
  if (productName) {
    const foodCheck = await validateFoodName(productName, category);
    if (!foodCheck.isFood) {
      return NextResponse.json(
        { error: "Only food and beverage products can have AI-enhanced images. Please enter a valid food item name.", code: "not_food" },
        { status: 422 }
      );
    }
  }

  const form = new FormData();
  form.append("model", process.env.AI_IMAGE_MODEL || process.env.URUV_IMAGE_MODEL || "uruv-image");
  form.append("image", new Blob([bytes], { type: mime }), "product-upload.png");
  form.append("size", "1024x1024");
  form.append("quality", "medium");
  form.append("prompt", `Create a polished marketplace product photo for Sheplates from this vendor-uploaded image. Product: ${productName || "food product"}. Category: ${body.category || "food"}. Preserve the actual product identity, pack, ingredients and visible quantity. Improve lighting, framing, sharpness and background only. Use a clean premium food-commerce aesthetic with natural realistic colors, soft daylight, uncluttered neutral background and no text overlays, fake labels, extra ingredients, people or misleading quantity changes. The result must still honestly represent the uploaded product.`);

  try {
    const json = await uruvImageEdit(form);
    const item = json.data?.[0];

    // Deduct credits only upon success
    if (caller.role === "vendor" && caller.vendorId && admin) {
      await deductVendorAiCredits(admin, caller.vendorId, "image_enhance", `Enhanced image for ${productName || "product"}`);
    }

    if (item?.b64_json) return NextResponse.json({ imageDataUrl: `data:image/png;base64,${item.b64_json}`, source: "uruv" });
    if (item?.url) return NextResponse.json({ imageUrl: item.url, source: "uruv" });
    return NextResponse.json({ error: "Image enhancement returned no image." }, { status: 502 });
  } catch (err) {
    const status = err instanceof UruvAiError ? err.status : 502;
    return NextResponse.json({ error: err instanceof Error && err.message ? err.message : "Image enhancement failed." }, { status });
  }
}
