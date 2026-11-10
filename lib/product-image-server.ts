import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildProductImagePrompt, conceptKey, detectImageType, sanitizeProductName, storageSlug } from "@/lib/product-image-ai";

/** Server-only: draws one product image with the image model, keeps it in storage, and remembers it per product type. */

export class ImageError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type ImageResult = { imageUrl: string; source: "cache" | "generated" };
type Fetch = typeof fetch;

const apiBase = () => (process.env.AI_API_BASE || process.env.URUV_API_BASE || "https://api.uruv.ai/v1").replace(/\/$/, "");

const apiKey = () => process.env.URUV_API_KEY || process.env.URV_API_KEY || process.env.AI_API_KEY || "";

export const DAILY_LIMIT = () => Math.max(0, Number(process.env.AI_IMAGE_DAILY_LIMIT ?? 60));
export const VENDOR_DAILY_LIMIT = () => Math.max(0, Number(process.env.AI_IMAGE_VENDOR_DAILY_LIMIT ?? 15));

export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function callerFromRequest(request: Request): Promise<{ id: string; role: string; vendorId: string | null } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return null;
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: authData } = await caller.auth.getUser(token);
  if (!authData.user) return null;
  const { data: profile } = await caller.from("profiles").select("role,vendor_id").eq("id", authData.user.id).maybeSingle();
  if (!profile) return null;
  return { id: authData.user.id, role: String(profile.role), vendorId: (profile.vendor_id as string | null) ?? null };
}

/** Asks the image model for one picture. Retries once without the format options for models that reject them. */
export async function requestAiImage(input: { apiKey: string; model: string; prompt: string; fetchImpl?: Fetch }): Promise<Uint8Array> {
  const doFetch = input.fetchImpl ?? fetch;
  const call = async (extra: Record<string, unknown>) => doFetch(`${apiBase()}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: input.model, prompt: input.prompt, size: "1024x1024", quality: "medium", n: 1, ...extra }),
  });
  let response = await call({ output_format: "webp", output_compression: 82 });
  if (response.status === 400) response = await call({});
  const json = await response.json() as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } };
  if (!response.ok) throw new ImageError(response.status === 429 ? 429 : 502, json.error?.message || "The image service could not draw this item.");
  const item = json.data?.[0];
  if (item?.b64_json) return new Uint8Array(Buffer.from(item.b64_json, "base64"));
  if (item?.url) {
    const download = await doFetch(item.url);
    if (download.ok) return new Uint8Array(await download.arrayBuffer());
  }
  throw new ImageError(502, "The image service returned no picture.");
}

async function nameIsAllowed(apiKey: string, name: string, fetchImpl?: Fetch): Promise<boolean> {
  try {
    const response = await (fetchImpl ?? fetch)(`${apiBase()}/moderations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.AI_MODERATION_MODEL || process.env.URUV_MODERATION_MODEL || "uruv-moderate", input: name }),
    });
    if (!response.ok) return true;
    const json = await response.json() as { results?: Array<{ flagged?: boolean }> };
    return !json.results?.[0]?.flagged;
  } catch { return true; }
}

async function usageToday(admin: SupabaseClient, vendorId: string | null) {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const total = await admin.from("ai_product_images").select("concept_key", { count: "exact", head: true }).gte("created_at", since.toISOString());
  if (total.error) {
    if (/ai_product_images|does not exist|schema cache/i.test(total.error.message) || total.error.code === "42P01") {
      throw new ImageError(503, "The product image library is not set up yet. Run supabase/V9_17_AI_PRODUCT_IMAGES.sql in Supabase.");
    }
    throw new ImageError(500, total.error.message);
  }
  let mine = 0;
  if (vendorId) {
    const own = await admin.from("ai_product_images").select("concept_key", { count: "exact", head: true }).eq("created_by_vendor", vendorId).gte("created_at", since.toISOString());
    mine = own.count ?? 0;
  }
  return { total: total.count ?? 0, mine };
}

async function ensureBucket(admin: SupabaseClient) {
  const buckets = await admin.storage.listBuckets();
  if (!buckets.data?.some((bucket) => bucket.name === "product-images")) {
    const created = await admin.storage.createBucket("product-images", { public: true, fileSizeLimit: "10MB", allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] });
    if (created.error && !/already exists/i.test(created.error.message)) throw new ImageError(500, created.error.message);
  }
}

/**
 * The picture for one product type. A vendor's own photo is never touched here. `force` draws a fresh variant
 * (Regenerate); otherwise a previously drawn picture for the same product type is reused at no cost.
 */
export async function ensureConceptImage(admin: SupabaseClient, input: { name: string; category: string; vendorId: string | null; force?: boolean; fetchImpl?: Fetch }): Promise<ImageResult> {
  const clean = sanitizeProductName(input.name);
  const key = conceptKey(input.name, input.category);
  if (!clean || !key) throw new ImageError(422, "Give the product a clear name first.");

  if (!input.force) {
    const cached = await admin.from("ai_product_images").select("url").eq("concept_key", key).maybeSingle();
    if (cached.error) {
      if (/ai_product_images|does not exist|schema cache/i.test(cached.error.message) || cached.error.code === "42P01") throw new ImageError(503, "The product image library is not set up yet. Run supabase/V9_17_AI_PRODUCT_IMAGES.sql in Supabase.");
      throw new ImageError(500, cached.error.message);
    }
    if (cached.data?.url) return { imageUrl: cached.data.url as string, source: "cache" };
  }

  const usage = await usageToday(admin, input.vendorId);
  if (usage.total >= DAILY_LIMIT()) throw new ImageError(429, "The daily limit for AI product images has been reached. It resets tomorrow.");
  if (input.vendorId && usage.mine >= VENDOR_DAILY_LIMIT()) throw new ImageError(429, "Your store has used its AI images for today. Try again tomorrow or upload a photo.");

  const apiKeyValue = apiKey();
  if (!apiKeyValue) throw new ImageError(503, "AI images are temporarily unavailable.");
  if (!(await nameIsAllowed(apiKeyValue, clean, input.fetchImpl))) throw new ImageError(422, "That name cannot be illustrated.");

  const model = process.env.AI_IMAGE_MODEL || process.env.URUV_IMAGE_MODEL || "uruv-image";
  const prompt = buildProductImagePrompt(clean, input.category);
  const bytes = await requestAiImage({ apiKey: apiKeyValue, model, prompt, fetchImpl: input.fetchImpl });
  const { mime, ext } = detectImageType(bytes);

  await ensureBucket(admin);
  const variant = input.force ? `-${crypto.randomUUID().slice(0, 6)}` : "";
  const path = `ai/${storageSlug(key)}${variant}.${ext}`;
  const uploaded = await admin.storage.from("product-images").upload(path, bytes, { contentType: mime, upsert: true });
  if (uploaded.error) throw new ImageError(500, uploaded.error.message);
  const imageUrl = admin.storage.from("product-images").getPublicUrl(path).data.publicUrl;

  const record = await admin.from("ai_product_images").insert({ concept_key: input.force ? `${key}~${crypto.randomUUID().slice(0, 6)}` : key, url: imageUrl, prompt, model, created_by_vendor: input.vendorId });
  if (record.error && record.error.code !== "23505") throw new ImageError(500, record.error.message);
  return { imageUrl, source: "generated" };
}

/** Attach a picture to a product only if it has none (or when force-regenerating). Tolerates a database without image_source. */
export async function setProductImage(admin: SupabaseClient, productIds: string[], imageUrl: string, onlyWhenEmpty: boolean) {
  if (!productIds.length) return;
  const run = (patch: Record<string, unknown>) => {
    let query = admin.from("vendor_menu_items").update(patch).in("id", productIds);
    if (onlyWhenEmpty) query = query.is("image_url", null);
    return query;
  };
  const withSource = await run({ image_url: imageUrl, image_source: "ai", updated_at: new Date().toISOString() });
  if (withSource.error && /image_source|schema cache/i.test(withSource.error.message)) {
    const plain = await run({ image_url: imageUrl, updated_at: new Date().toISOString() });
    if (plain.error) throw new ImageError(500, plain.error.message);
  } else if (withSource.error) throw new ImageError(500, withSource.error.message);
}
