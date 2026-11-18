import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateFoodDropUnits, validateFoodDropEditUnits } from "@/lib/food-drops";
import { canCreateFoodDrop, extractPlanCode, getIstMidnightDate } from "@/lib/plans";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// POST: Create a Food Drop with strict server-side stock validation
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vendorId, productId, title, description, dropPrice, originalPrice, totalQuantity } = body;

    if (!vendorId || !productId) {
      return NextResponse.json({ error: "Vendor ID and Product ID are required." }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      // In mock/demo environment without Supabase keys, validate directly
      const mockStock = Number(body.productStock ?? 0);
      const mockName = String(body.productName ?? "Product");
      const validation = validateFoodDropUnits(totalQuantity, mockStock, mockName);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        drop: {
          id: `drop-${Date.now()}`,
          vendorId,
          productId,
          title: title || `${mockName} — flash drop`,
          dropPrice: Number(dropPrice || 0),
          originalPrice: Number(originalPrice || 0),
          totalQuantity: validation.quantity,
          remainingQuantity: validation.quantity,
          status: "active",
        },
      }, { status: 201 });
    }

    // 1. Fetch vendor & plan check
    const { data: vendor, error: vErr } = await admin
      .from("vendors")
      .select("id, plan_id, vendor_plans(code)")
      .eq("id", vendorId)
      .maybeSingle();

    if (vErr || !vendor) {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }

    const planCode = extractPlanCode(vendor.vendor_plans) || "crave";
    const istMidnight = getIstMidnightDate();
    const { count } = await admin
      .from("food_drops")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .gte("created_at", istMidnight.toISOString());

    const planCheck = canCreateFoodDrop(planCode, count || 0);
    if (!planCheck.allowed) {
      return NextResponse.json({ error: planCheck.message }, { status: 403 });
    }

    // 2. Fetch product and stock check
    const { data: product, error: pErr } = await admin
      .from("vendor_menu_items")
      .select("id, name, stock_quantity, active")
      .eq("id", productId)
      .eq("vendor_id", vendorId)
      .maybeSingle();

    if (pErr || !product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const stock = Number(product.stock_quantity ?? 0);
    const validation = validateFoodDropUnits(totalQuantity, stock, product.name);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const validQty = validation.quantity!;

    // 3. Atomically decrement stock from vendor_menu_items
    const { data: updatedProd, error: stockUpdateErr } = await admin
      .from("vendor_menu_items")
      .update({
        stock_quantity: stock - validQty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .gte("stock_quantity", validQty)
      .select("stock_quantity")
      .maybeSingle();

    if (stockUpdateErr || !updatedProd) {
      // Re-fetch current stock to give exact message on race condition
      const { data: currentProd } = await admin
        .from("vendor_menu_items")
        .select("stock_quantity")
        .eq("id", productId)
        .maybeSingle();
      const currentStock = currentProd?.stock_quantity ?? 0;
      return NextResponse.json({
        error: `You entered ${validQty} units, but only ${currentStock} are in stock for ${product.name}. Please enter ${currentStock} or fewer, or update your stock first.`,
      }, { status: 409 });
    }

    // 4. Create Food Drop
    const now = new Date();
    const startsAt = now.toISOString();
    const endsAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();

    const { data: createdDrop, error: dropErr } = await admin
      .from("food_drops")
      .insert({
        vendor_id: vendorId,
        product_id: productId,
        title: String(title || `${product.name} — flash drop`).trim(),
        description: description || null,
        drop_price: Number(dropPrice),
        original_price: Number(originalPrice),
        total_quantity: validQty,
        remaining_quantity: validQty,
        starts_at: startsAt,
        ends_at: endsAt,
        status: "active",
      })
      .select("*")
      .single();

    if (dropErr || !createdDrop) {
      // Rollback stock reservation
      await admin
        .from("vendor_menu_items")
        .update({ stock_quantity: stock })
        .eq("id", productId);
      return NextResponse.json({ error: dropErr?.message || "Failed to create Food Drop." }, { status: 500 });
    }

    return NextResponse.json({ success: true, drop: createdDrop }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH: Edit a Food Drop with stock check on raise
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { dropId, title, dropPrice, totalQuantity } = body;

    if (!dropId) {
      return NextResponse.json({ error: "dropId is required." }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      // Mock validation
      const mockStock = Number(body.productStock ?? 0);
      const mockTotal = Number(body.currentTotalQuantity ?? 10);
      const mockClaimed = Number(body.claimedQuantity ?? 0);
      const mockName = String(body.productName ?? "Product");
      const validation = validateFoodDropEditUnits(totalQuantity, mockTotal, mockClaimed, mockStock, mockName);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, quantity: validation.quantity });
    }

    // 1. Fetch Food Drop
    const { data: drop, error: dropErr } = await admin
      .from("food_drops")
      .select("*")
      .eq("id", dropId)
      .maybeSingle();

    if (dropErr || !drop) {
      return NextResponse.json({ error: "Food Drop not found." }, { status: 404 });
    }

    // 2. Fetch Product
    const { data: product, error: prodErr } = await admin
      .from("vendor_menu_items")
      .select("id, name, stock_quantity")
      .eq("id", drop.product_id)
      .maybeSingle();

    if (prodErr || !product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const claimed = drop.total_quantity - drop.remaining_quantity;
    const stock = Number(product.stock_quantity ?? 0);

    let newQty = drop.total_quantity;
    let newRemaining = drop.remaining_quantity;

    if (totalQuantity !== undefined) {
      const validation = validateFoodDropEditUnits(totalQuantity, drop.total_quantity, claimed, stock, product.name);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      newQty = validation.quantity!;
      const diff = validation.additionalUnits ?? 0;

      if (diff > 0) {
        // Reserve extra units
        const { error: reserveErr } = await admin
          .from("vendor_menu_items")
          .update({
            stock_quantity: stock - diff,
            updated_at: new Date().toISOString(),
          })
          .eq("id", drop.product_id)
          .gte("stock_quantity", diff);

        if (reserveErr) {
          return NextResponse.json({
            error: `You entered ${newQty} units, but only ${stock} more are in stock for ${product.name}. Please enter ${drop.total_quantity + stock} or fewer, or update your stock first.`,
          }, { status: 409 });
        }
      } else if (diff < 0) {
        // Return surplus back to product stock
        await admin
          .from("vendor_menu_items")
          .update({
            stock_quantity: stock + (-diff),
            updated_at: new Date().toISOString(),
          })
          .eq("id", drop.product_id);
      }

      newRemaining = drop.remaining_quantity + diff;
    }

    const updates: Record<string, unknown> = {
      total_quantity: newQty,
      remaining_quantity: newRemaining,
      updated_at: new Date().toISOString(),
    };
    if (title) updates.title = String(title).trim();
    if (typeof dropPrice === "number") updates.drop_price = dropPrice;

    const { data: updated, error: updateErr } = await admin
      .from("food_drops")
      .update(updates)
      .eq("id", dropId)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, drop: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: Cancel a Food Drop and refund unsold units
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dropId = searchParams.get("id");

    if (!dropId) {
      return NextResponse.json({ error: "Drop ID is required." }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ success: true });
    }

    const { data: drop, error: fetchErr } = await admin
      .from("food_drops")
      .select("id, product_id, remaining_quantity, status")
      .eq("id", dropId)
      .maybeSingle();

    if (fetchErr || !drop) {
      return NextResponse.json({ error: "Food Drop not found." }, { status: 404 });
    }

    if (drop.status !== "cancelled" && drop.remaining_quantity > 0) {
      // Refund remaining units to vendor_menu_items
      const { data: prod } = await admin
        .from("vendor_menu_items")
        .select("stock_quantity")
        .eq("id", drop.product_id)
        .maybeSingle();

      if (prod) {
        await admin
          .from("vendor_menu_items")
          .update({
            stock_quantity: (prod.stock_quantity ?? 0) + drop.remaining_quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", drop.product_id);
      }
    }

    await admin
      .from("food_drops")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", dropId);

    return NextResponse.json({ success: true, refundedQuantity: drop.remaining_quantity });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
