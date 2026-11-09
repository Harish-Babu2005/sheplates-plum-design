import { NextResponse } from "next/server";

// Used by the deploy pipeline and uptime monitors. Reveals nothing about the configuration.
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json({ ok: true, time: new Date().toISOString() }); }
