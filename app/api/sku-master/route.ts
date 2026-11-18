import { NextResponse } from "next/server";
import {
  SKU_CATEGORIES,
  SKU_GROUPS_BY_CATEGORY,
  SKU_MASTER_RECORDS,
  getSkuGroups,
  getSkusForGroup,
  findSkuDefinition,
  validateSkuSelection,
} from "@/lib/sku-master";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const group = searchParams.get("group");

  if (category && group) {
    const skus = getSkusForGroup(category, group);
    return NextResponse.json({ category, group, skus });
  }

  if (category) {
    const groups = getSkuGroups(category);
    return NextResponse.json({ category, groups });
  }

  return NextResponse.json({
    categories: SKU_CATEGORIES,
    groupsByCategory: SKU_GROUPS_BY_CATEGORY,
    totalRecords: SKU_MASTER_RECORDS.length,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { category?: string; group?: string; packSize?: string };
    const { category = "", group = "", packSize = "" } = body;
    const result = validateSkuSelection(category, group, packSize);
    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  } catch {
    return NextResponse.json({ valid: false, error: "Invalid request payload" }, { status: 400 });
  }
}

