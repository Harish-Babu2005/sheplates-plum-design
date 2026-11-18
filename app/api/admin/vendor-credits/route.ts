import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  adjustVendorAiCreditsAdmin,
  getVendorAiCreditLedger,
  getVendorAiCredits,
} from "@/lib/ai-credits-server";
import { adminClient } from "@/lib/product-image-server";

async function authoriseAdminOrOps(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false") return { id: "demo-admin", role: "admin" };
    return null;
  }
  const supabase = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData.user) return null;
  const { data: profile } = await supabase.from("profiles").select("id,role").eq("id", authData.user.id).maybeSingle();
  if (!profile || !["admin", "operations"].includes(profile.role)) return null;
  return { id: profile.id, role: profile.role };
}

export async function GET(request: Request) {
  const caller = await authoriseAdminOrOps(request);
  if (!caller) return NextResponse.json({ error: "Operations or Super Admin access required." }, { status: 403 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendorId");
  if (!vendorId) return NextResponse.json({ error: "Missing vendorId query param." }, { status: 400 });

  try {
    const balance = await getVendorAiCredits(admin, vendorId);
    const ledger = await getVendorAiCreditLedger(admin, vendorId, 100);
    return NextResponse.json({ ok: true, balance, ledger });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load credits." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const caller = await authoriseAdminOrOps(request);
  if (!caller) return NextResponse.json({ error: "Operations or Super Admin access required." }, { status: 403 });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  try {
    const body = await request.json() as { vendorId?: string; amount?: number; reason?: string };
    const vendorId = String(body.vendorId || "").trim();
    const amount = Number(body.amount || 0);
    const reason = String(body.reason || "").trim();

    if (!vendorId) return NextResponse.json({ error: "Missing vendor ID." }, { status: 400 });
    if (!amount || isNaN(amount)) return NextResponse.json({ error: "Adjustment amount must be a non-zero integer." }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "A clear reason is required for manual credit adjustments." }, { status: 400 });

    const result = await adjustVendorAiCreditsAdmin(admin, vendorId, amount, reason, caller.id);
    const balance = await getVendorAiCredits(admin, vendorId);
    const ledger = await getVendorAiCreditLedger(admin, vendorId, 100);

    return NextResponse.json({
      ok: true,
      message: `Adjusted ${amount > 0 ? `+${amount}` : amount} credits for vendor.`,
      result,
      balance,
      ledger,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to adjust credits." }, { status: 500 });
  }
}
