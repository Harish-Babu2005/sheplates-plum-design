import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uruvChat, uruvApiKey, UruvAiError } from "@/lib/uruv-ai";

function extractText(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? (payload.choices as Array<Record<string, unknown>>) : [];
  const message = choices[0] ? (choices[0].message as Record<string, unknown> | undefined) : undefined;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const parts = content
      .map((part) => (typeof part === "object" && part && typeof (part as Record<string, unknown>).text === "string" ? (part as Record<string, unknown>).text as string : ""))
      .filter(Boolean);
    if (parts.length) return parts.join("\n");
  }
  return "";
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth } = await caller.auth.getUser(token);
  if (!auth.user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { data: profile } = await caller.from("profiles").select("role,vendor_id").eq("id", auth.user.id).maybeSingle();
  if (!profile || !["vendor", "admin"].includes(profile.role)) return NextResponse.json({ error: "Vendor access is required." }, { status: 403 });
  const body = await request.json() as { text?: string; defaultCategory?: string };
  const raw = String(body.text || "").trim().slice(0, 30000);
  if (!raw) return NextResponse.json({ error: "The uploaded list is empty." }, { status: 400 });
  if (!uruvApiKey()) return NextResponse.json({ error: "Smart list reading is temporarily unavailable." }, { status: 503 });

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        maxItems: 150,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" }, category: { type: "string" }, pack: { type: "string" }, price: { type: "number" }, stock: { type: "number" },
          },
          required: ["name", "category", "pack", "price", "stock"],
        },
      },
    },
    required: ["items"],
  };
  try {
    const json = await uruvChat({
      model: process.env.AI_MODEL || process.env.URUV_MODEL || "uruv-chat",
      messages: [
        { role: "system", content: "Convert a vendor product/grocery list into clean catalogue draft rows. Preserve product names faithfully. Infer only obvious categories and pack descriptions. If price or stock are absent, return 0 for price and 1 for stock. Never invent brands, claims or nutrition. The vendor will review every row before publication." },
        { role: "user", content: `Default category: ${body.defaultCategory || "Groceries"}\n\nList:\n${raw}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "catalogue_import", strict: true, schema } },
    });
    const parsed = JSON.parse(extractText(json)) as { items?: unknown[] };
    return NextResponse.json({ items: parsed.items || [] });
  } catch (err) {
    if (err instanceof UruvAiError && (err.status === 400 || err.status === 422)) {
      return NextResponse.json({ error: "The list needs manual review." }, { status: 422 });
    }
    return NextResponse.json({ error: "The list could not be read right now." }, { status: 502 });
  }
}
