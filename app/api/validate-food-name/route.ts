import { NextResponse } from "next/server";
import { validateFoodName, MIN_NAME_LENGTH } from "@/lib/food-name-validator";

/**
 * POST /api/validate-food-name
 * Body: { name: string; category: string }
 * Returns: { isFood: boolean; confidence: number; reason?: string }
 *
 * Used by the vendor ProductDialog before triggering any AI image generation.
 * No auth required — this is a lightweight classification endpoint.
 * Rate-limiting / abuse prevention is handled upstream by the Next.js middleware.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; category?: string };
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "").trim();

    if (!name || name.length < MIN_NAME_LENGTH) {
      return NextResponse.json(
        { isFood: false, confidence: 1, reason: "Product name is too short or empty." },
        { status: 200 }
      );
    }

    const result = await validateFoodName(name, category);
    return NextResponse.json(result);
  } catch {
    // Fail open — do not block the vendor on a validation error
    return NextResponse.json({ isFood: true, confidence: 0.5, reason: "Validation error; allowed by default." });
  }
}
