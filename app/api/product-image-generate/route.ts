import { NextResponse } from "next/server";
import { adminClient, callerFromRequest, ensureConceptImage, ImageError, setProductImage } from "@/lib/product-image-server";

export const maxDuration = 120;

/**
 * Draws a sample picture for a product that has none. A vendor may only do this for their own store; Operations and
 * Super Admin may do it for any product. Send { productId } to attach the picture, or { name, category } to preview it.
 * { force: true } draws a fresh variant (Regenerate). A vendor's own photo is never replaced unless force is sent.
 */
export async function POST(request: Request) {
  try {
    const caller = await callerFromRequest(request);
    if (!caller) return NextResponse.json({ error: "Sign in to create an image." }, { status: 401 });
    if (!["vendor", "admin", "operations"].includes(caller.role)) return NextResponse.json({ error: "Vendor access is required." }, { status: 403 });
    const admin = adminClient();
    if (!admin) return NextResponse.json({ error: "Image storage is unavailable." }, { status: 503 });

    const body = await request.json() as { productId?: string; name?: string; category?: string; force?: boolean };
    let name = String(body.name ?? "");
    let category = String(body.category ?? "");
    const productId = body.productId?.trim();
    if (productId) {
      const { data: product } = await admin.from("vendor_menu_items").select("id,vendor_id,name,category,image_url").eq("id", productId).maybeSingle();
      if (!product) return NextResponse.json({ error: "That product was not found." }, { status: 404 });
      if (caller.role === "vendor" && caller.vendorId !== product.vendor_id) return NextResponse.json({ error: "This product belongs to another store." }, { status: 403 });
      if (product.image_url && !body.force) return NextResponse.json({ imageUrl: product.image_url, source: "existing" });
      name = String(product.name); category = String(product.category);
    }

    const result = await ensureConceptImage(admin, { name, category, vendorId: caller.role === "vendor" ? caller.vendorId : null, force: !!body.force });
    if (productId) await setProductImage(admin, [productId], result.imageUrl, !body.force);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImageError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "The image could not be created." }, { status: 500 });
  }
}
