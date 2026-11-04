import { NextResponse } from "next/server";
import { conceptKey } from "@/lib/product-image-ai";
import { adminClient, callerFromRequest, ensureConceptImage, ImageError, setProductImage } from "@/lib/product-image-server";

export const maxDuration = 120;

type Row = { id: string; name: string; category: string };

async function missing(admin: NonNullable<ReturnType<typeof adminClient>>) {
  const { data, error } = await admin.from("vendor_menu_items").select("id,name,category").is("image_url", null).limit(2000);
  if (error) throw new ImageError(500, error.message);
  const groups = new Map<string, Row[]>();
  for (const row of (data ?? []) as Row[]) {
    const key = conceptKey(row.name, row.category);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return { products: (data ?? []).length, groups };
}

async function guard(request: Request) {
  const caller = await callerFromRequest(request);
  if (!caller || caller.role !== "admin") return { error: NextResponse.json({ error: "Super Admin access is required." }, { status: 403 }) };
  const admin = adminClient();
  if (!admin) return { error: NextResponse.json({ error: "Image storage is unavailable." }, { status: 503 }) };
  return { admin };
}

/** How many products still have no picture (Super Admin only). */
export async function GET(request: Request) {
  try {
    const checked = await guard(request);
    if (checked.error) return checked.error;
    const { products, groups } = await missing(checked.admin!);
    return NextResponse.json({ products, kinds: groups.size });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not count products." }, { status: error instanceof ImageError ? error.status : 500 });
  }
}

/** Draws pictures for a few product types at a time (two by default) so each request stays short; the screen repeats the call. */
export async function POST(request: Request) {
  try {
    const checked = await guard(request);
    if (checked.error) return checked.error;
    const admin = checked.admin!;
    const body = await request.json().catch(() => ({})) as { limit?: number };
    const limit = Math.min(4, Math.max(1, Math.floor(Number(body.limit) || 2)));
    const { groups } = await missing(admin);
    let generated = 0, reused = 0, failed = 0, message = "";
    const keys = [...groups.keys()].slice(0, limit);
    for (const key of keys) {
      const rows = groups.get(key)!;
      try {
        const result = await ensureConceptImage(admin, { name: rows[0].name, category: rows[0].category, vendorId: null });
        await setProductImage(admin, rows.map((row) => row.id), result.imageUrl, true);
        if (result.source === "generated") generated += 1; else reused += 1;
      } catch (error) {
        if (error instanceof ImageError && (error.status === 429 || error.status === 503)) { message = error.message; break; }
        failed += 1;
        if (error instanceof ImageError) message = error.message;
      }
    }
    const after = await missing(admin);
    return NextResponse.json({ generated, reused, failed, remainingProducts: after.products, remainingKinds: after.groups.size, message });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Backfill failed." }, { status: error instanceof ImageError ? error.status : 500 });
  }
}
