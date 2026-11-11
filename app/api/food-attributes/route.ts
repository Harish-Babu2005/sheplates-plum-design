import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TASTE_DIMENSIONS, inferAttributesLocally, type TasteWeights } from "@/lib/taste-match";
import { uruvChat, uruvApiKey } from "@/lib/uruv-ai";

function clients(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !token) return null;
  return {
    caller: createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }),
    admin: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }),
    token,
  };
}

type ProductInput = { id: string; name: string; category: string; description?: string };

async function classifyWithAI(products: ProductInput[]): Promise<Record<string, TasteWeights> | null> {
  if (!uruvApiKey() || !products.length) return null;
  const dimensionProperties = Object.fromEntries(TASTE_DIMENSIONS.map((d) => [d, { type: "number", minimum: 0, maximum: 1 }]));
  const prompt = `Classify each food product into weighted taste dimensions (0 to 1, 0 = not applicable, 1 = strongly applicable). Use only the listed dimensions. Base the weights strictly on the product's name, category and description — do not invent facts about ingredients you cannot infer. Products: ${JSON.stringify(products)}`;
  try {
    const data = await uruvChat({
      model: process.env.AI_MODEL || process.env.URUV_MODEL || "uruv-chat",
      messages: [
        { role: "system", content: "Return valid JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "food_attribute_classification",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    productId: { type: "string" },
                    attributes: {
                      type: "object",
                      additionalProperties: false,
                      properties: dimensionProperties,
                      required: [...TASTE_DIMENSIONS],
                    },
                  },
                  required: ["productId", "attributes"],
                },
              },
            },
            required: ["items"],
          },
        },
      },
    });
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text) return null;
    const parsed = JSON.parse(text) as { items: { productId: string; attributes: TasteWeights }[] };
    const result: Record<string, TasteWeights> = {};
    for (const item of parsed.items) {
      const trimmed: TasteWeights = {};
      for (const [dimension, value] of Object.entries(item.attributes)) if (typeof value === "number" && value >= 0.2) trimmed[dimension] = value;
      result[item.productId] = trimmed;
    }
    return result;
  } catch (caught) {
    const error = caught as { code?: string; status?: number; message?: string };
    console.error("[food-attributes] AI classification failed, using local fallback", { code: error?.code, status: error?.status, message: error?.message });
    return null;
  }
}

export async function POST(request: Request) {
  const c = clients(request);
  if (!c) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: authData } = await c.caller.auth.getUser(c.token);
  if (!authData.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null) as { products?: ProductInput[] } | null;
  const products = (body?.products || []).filter((p) => p?.id && p?.name).slice(0, 16);
  if (!products.length) return NextResponse.json({ attributes: {} });

  const existing = await c.admin.from("food_item_attributes").select("product_id,attributes").in("product_id", products.map((p) => p.id));
  const cached: Record<string, TasteWeights> = {};
  for (const row of existing.data || []) cached[row.product_id as string] = row.attributes as TasteWeights;

  const uncached = products.filter((p) => !cached[p.id]);
  if (uncached.length) {
    const aiResult = await classifyWithAI(uncached);
    const rowsToInsert = uncached.map((p) => {
      const attributes = aiResult?.[p.id] && Object.keys(aiResult[p.id]).length ? aiResult[p.id] : inferAttributesLocally(p.name, p.category);
      cached[p.id] = attributes;
      return { product_id: p.id, attributes, source: "inferred" as const };
    });
    const inserted = await c.admin.from("food_item_attributes").upsert(rowsToInsert, { onConflict: "product_id" });
    if (inserted.error) console.error("[food-attributes] cache write failed", inserted.error.message);
  }

  return NextResponse.json({ attributes: cached });
}
