// Audit trail helpers for Operations and Super Admin. Backed by supabase/V9_14_AUDIT_VIEWS_AND_VENDOR_NOTES.sql and V9_21.
async function getSupabaseContext() {
  try {
    const mod = await import("./supabase.ts");
    return {
      sb: mod.getSupabaseBrowserClient?.() ?? null,
      isLive: mod.isLiveSupabaseMode?.() ?? false,
    };
  } catch {
    return { sb: null, isLive: false };
  }
}

export type AuditCategory =
  | "All"
  | "Permissions"
  | "Vendors"
  | "Plans and pricing"
  | "Vendor verification"
  | "Vendor creation"
  | "Team user management"
  | "Other";

export type AuditChangeField = {
  field: string;
  previousValue?: string | number | boolean | null;
  newValue?: string | number | boolean | null;
};

export type TrailEvent = {
  id: string;
  actor: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  category?: Exclude<AuditCategory, "All"> | string;
  entityType?: string;
  entityId?: string;
  vendorName?: string;
  customerName?: string;
  detail: string;
  at: string;
  timestamp?: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  changes?: AuditChangeField[];
  reason?: string;
  metadata?: Record<string, unknown>;
};

const LABELS: Record<string, string> = {
  vendor_plan_changed: "Vendor Plan Updated",
  "Vendor plan changed": "Vendor Plan Updated",
  "vendor plan updated": "Vendor Plan Updated",
  "Vendor Plan Updated": "Vendor Plan Updated",
  viewed_customer_details: "Viewed customer details",
  sent_vendor_note: "Sent a note to a vendor",
  created_team_user: "Created a team user",
  invited_vendor: "Invited a vendor by email",
  set_vendor_commercial_terms: "Set vendor commercial terms",
  pricing_markup_updated: "Pricing change: item markup",
  "Pricing change: item markup": "Pricing change: item markup",
};

export const label = (action: string) => LABELS[action] || action.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

export function classifyAuditCategory(action: string, entityType = "", detailText = ""): Exclude<AuditCategory, "All"> {
  const combined = `${action} ${entityType} ${detailText}`.toLowerCase();
  if (/permission|access|p0_permission|role_grant/i.test(combined)) return "Permissions";
  if (/plan|pricing|price|markup|percentage|fee|commercial/i.test(combined)) return "Plans and pricing";
  if (/verif|fssai|compliance|certificate|review.*vendor|reject.*vendor/i.test(combined)) return "Vendor verification";
  if (/team.*user|staff.*user|create.*user|created.*user/i.test(combined)) return "Team user management";
  if (/invite.*vendor|p0_vendor_created|vendor.*created|onboard/i.test(combined)) return "Vendor creation";
  if (/vendor|store|outlet|note|shop/i.test(combined) || entityType === "vendor") return "Vendors";
  return "Other";
}

function friendly(message: string) {
  return /function .* does not exist|schema cache/i.test(message) ? "This needs a database update. Apply supabase/V9_14_AUDIT_VIEWS_AND_VENDOR_NOTES.sql first." : message;
}

export function extractAuditChanges(
  actionOrBefore?: string | Record<string, unknown> | null,
  beforeOrAfter?: Record<string, unknown> | null,
  maybeAfter?: Record<string, unknown> | null
): AuditChangeField[] {
  let action = "plan";
  let beforeData: Record<string, unknown> | null | undefined = null;
  let afterData: Record<string, unknown> | null | undefined = null;

  if (typeof actionOrBefore === "string") {
    action = actionOrBefore;
    beforeData = beforeOrAfter;
    afterData = maybeAfter;
  } else {
    action = "plan";
    beforeData = actionOrBefore;
    afterData = beforeOrAfter;
  }

  const changes: AuditChangeField[] = [];
  if (!beforeData && !afterData) return changes;

  const isPlanUpdate = /plan/i.test(action);
  if (isPlanUpdate) {
    const prevPlan = beforeData?.planName || beforeData?.plan;
    const nextPlan = afterData?.planName || afterData?.plan;
    if (prevPlan || nextPlan) {
      changes.push({
        field: "Subscription Plan",
        previousValue: prevPlan ? String(prevPlan) : undefined,
        newValue: nextPlan ? String(nextPlan) : undefined,
      });
    }

    const prevPrice = beforeData?.formattedPrice != null ? String(beforeData.formattedPrice) : (beforeData?.monthlyPrice != null ? `₹${beforeData.monthlyPrice}/month` : undefined);
    const nextPrice = afterData?.formattedPrice != null ? String(afterData.formattedPrice) : (afterData?.monthlyPrice != null ? `₹${afterData.monthlyPrice}/month` : undefined);
    if (prevPrice || nextPrice) {
      changes.push({
        field: "Plan Price",
        previousValue: prevPrice,
        newValue: nextPrice,
      });
    }

    const prevStatus = beforeData?.status;
    const nextStatus = afterData?.status;
    if (prevStatus || nextStatus) {
      changes.push({
        field: "Plan Status",
        previousValue: prevStatus ? String(prevStatus) : "Active",
        newValue: nextStatus ? String(nextStatus) : "Active",
      });
    }

    const prevDates = beforeData?.startDate || beforeData?.effectiveDate;
    const nextDates = afterData?.startDate || afterData?.effectiveDate;
    if (prevDates || nextDates) {
      changes.push({
        field: "Subscription Period",
        previousValue: prevDates ? String(prevDates) : undefined,
        newValue: nextDates ? String(nextDates) : undefined,
      });
    }

    return changes;
  }

  // Generic key-value diff
  const allKeys = new Set([...Object.keys(beforeData || {}), ...Object.keys(afterData || {})]);
  const ignoredKeys = new Set(["changedAt", "actorId", "actorEmail", "actorRole", "actorName", "limits", "vendorId", "vendorName"]);

  for (const key of allKeys) {
    if (ignoredKeys.has(key)) continue;
    const prev = beforeData?.[key];
    const next = afterData?.[key];
    if (prev !== next && (prev !== undefined || next !== undefined)) {
      changes.push({
        field: key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
        previousValue: prev !== undefined && prev !== null ? String(prev) : "—",
        newValue: next !== undefined && next !== null ? String(next) : "—",
      });
    }
  }

  return changes;
}

export function createVendorPlanAuditEvent(params: {
  id?: string;
  actorName: string;
  actorEmail?: string;
  actorRole: string;
  vendorId: string;
  vendorName: string;
  previousPlan: string;
  newPlan: string;
  previousPrice: string | number;
  newPrice: string | number;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  at?: string;
  timestamp?: string;
}): TrailEvent {
  const atFormatted = params.at || new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedPrevPrice = typeof params.previousPrice === "number" ? `₹${params.previousPrice}/month` : params.previousPrice;
  const formattedNextPrice = typeof params.newPrice === "number" ? `₹${params.newPrice}/month` : params.newPrice;

  const beforeData = {
    plan: params.previousPlan.toLowerCase(),
    planName: params.previousPlan,
    monthlyPrice: typeof params.previousPrice === "number" ? params.previousPrice : Number(params.previousPrice.replace(/\D/g, "")),
    formattedPrice: formattedPrevPrice,
    status: params.previousStatus || "Active",
    vendorName: params.vendorName,
    vendorId: params.vendorId,
  };

  const afterData = {
    plan: params.newPlan.toLowerCase(),
    planName: params.newPlan,
    monthlyPrice: typeof params.newPrice === "number" ? params.newPrice : Number(params.newPrice.replace(/\D/g, "")),
    formattedPrice: formattedNextPrice,
    status: params.newStatus || "Active",
    vendorName: params.vendorName,
    vendorId: params.vendorId,
    actorName: params.actorName,
    actorEmail: params.actorEmail || "",
    actorRole: params.actorRole,
    changedAt: params.timestamp || new Date().toISOString(),
    reason: params.reason || "Vendor plan updated by admin",
  };

  const changes: AuditChangeField[] = [
    { field: "Subscription Plan", previousValue: params.previousPlan, newValue: params.newPlan },
    { field: "Plan Price", previousValue: formattedPrevPrice, newValue: formattedNextPrice },
    { field: "Plan Status", previousValue: params.previousStatus || "Active", newValue: params.newStatus || "Active" },
  ];

  return {
    id: params.id || `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    actor: `${params.actorName} · ${params.actorRole}`,
    actorName: params.actorName,
    actorEmail: params.actorEmail || "",
    actorRole: params.actorRole,
    action: "Vendor Plan Updated",
    category: "Plans and pricing",
    entityType: "vendor",
    entityId: params.vendorId,
    vendorName: params.vendorName,
    detail: `${params.vendorName}: plan changed from ${params.previousPlan} (${formattedPrevPrice}) to ${params.newPlan} (${formattedNextPrice})`,
    at: atFormatted,
    timestamp: params.timestamp || new Date().toISOString(),
    beforeData,
    afterData,
    changes,
    reason: params.reason,
    metadata: {
      vendorId: params.vendorId,
      vendorName: params.vendorName,
    },
  };
}

/** Latest events from the database audit table (live mode only). */
export async function loadAuditTrail(limit = 200): Promise<TrailEvent[]> {
  const { sb, isLive } = await getSupabaseContext();
  if (!sb || !isLive) return [];

  try {
    const res = await sb.rpc("audit_trail", { p_limit: limit });
    if (!res.error && Array.isArray(res.data)) {
      return (res.data as Record<string, unknown>[]).map((row) => {
        const id = String(row.id ?? "");
        const rawAction = String(row.action ?? "");
        const action = label(rawAction);
        const entityType = String(row.entity_type ?? "");
        const entityId = String(row.entity_id ?? "");
        const actorName = String(row.actor_name || "System");
        const actorRole = row.actor_role ? String(row.actor_role) : "";
        const actorEmail = String(row.actor_email || (row.after_data as Record<string, unknown>)?.actorEmail || "");
        const actor = `${actorName}${actorRole ? ` · ${actorRole}` : ""}`;

        const beforeData = (row.before_data as Record<string, unknown>) || null;
        const afterData = (row.after_data as Record<string, unknown>) || (row.detail as Record<string, unknown>) || null;

        const vendorName = String(
          afterData?.vendorName ||
          beforeData?.vendorName ||
          afterData?.vendor ||
          afterData?.businessName ||
          (entityType === "vendor" ? entityId : "")
        );

        const customerName = String(
          afterData?.customerName ||
          afterData?.customer ||
          (entityType === "customer" ? entityId : "")
        );

        const reason = afterData?.reason ? String(afterData.reason) : afterData?.notes ? String(afterData.notes) : undefined;
        const changes = extractAuditChanges(action, beforeData, afterData);
        const category = classifyAuditCategory(action, entityType, Object.values(afterData || {}).map(String).join(" "));

        let detail = [entityType, entityId, ...Object.values(afterData || {}).map(String)].filter(Boolean).join(" · ");
        if (/plan/i.test(action) && (beforeData || afterData)) {
          const oldP = beforeData?.planName || beforeData?.plan || "Basic";
          const newP = afterData?.planName || afterData?.plan || "Premium";
          const oldPr = beforeData?.formattedPrice || (beforeData?.monthlyPrice ? `₹${beforeData.monthlyPrice}/month` : "");
          const newPr = afterData?.formattedPrice || (afterData?.monthlyPrice ? `₹${afterData.monthlyPrice}/month` : "");
          detail = `${vendorName ? `${vendorName}: ` : ""}plan changed from ${oldP}${oldPr ? ` (${oldPr})` : ""} to ${newP}${newPr ? ` (${newPr})` : ""}`;
        }

        const createdAt = row.created_at ? String(row.created_at) : new Date().toISOString();
        const at = new Date(createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

        return {
          id: `db-${id}`,
          actor,
          actorName,
          actorEmail,
          actorRole,
          action,
          category,
          entityType,
          entityId,
          vendorName: vendorName || undefined,
          customerName: customerName || undefined,
          detail,
          at,
          timestamp: createdAt,
          beforeData,
          afterData,
          changes,
          reason,
          metadata: afterData || undefined,
        };
      });
    }
  } catch (err) {
    console.warn("RPC audit_trail failed, falling back to direct query:", err);
  }

  // Fallback to direct audit_logs query if RPC is not present
  const direct = await sb
    .from("audit_logs")
    .select("id, created_at, actor_id, actor_role, action, entity_type, entity_id, before_data, after_data")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (direct.error) throw new Error(friendly(direct.error.message));

  return (direct.data || []).map((row) => {
    const action = label(row.action);
    const beforeData = (row.before_data as Record<string, unknown>) || null;
    const afterData = (row.after_data as Record<string, unknown>) || null;
    const actorRole = row.actor_role === "admin" ? "Super Admin" : row.actor_role === "operations" ? "Operations" : String(row.actor_role || "");
    const actorName = String(afterData?.actorName || "System");
    const actorEmail = String(afterData?.actorEmail || "");
    const actor = `${actorName}${actorRole ? ` · ${actorRole}` : ""}`;
    const vendorName = String(afterData?.vendorName || beforeData?.vendorName || (row.entity_type === "vendor" ? row.entity_id : ""));
    const changes = extractAuditChanges(action, beforeData, afterData);
    const category = classifyAuditCategory(action, row.entity_type, Object.values(afterData || {}).map(String).join(" "));

    return {
      id: `db-${row.id}`,
      actor,
      actorName,
      actorEmail,
      actorRole,
      action,
      category,
      entityType: row.entity_type,
      entityId: row.entity_id,
      vendorName: vendorName || undefined,
      detail: [row.entity_type, row.entity_id, ...Object.values(afterData || {}).map(String)].filter(Boolean).join(" · "),
      at: new Date(row.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      timestamp: row.created_at,
      beforeData,
      afterData,
      changes,
      reason: afterData?.reason ? String(afterData.reason) : undefined,
      metadata: afterData || undefined,
    };
  });
}

/** Records that a staff member opened a customer's details. Best effort: viewing is never blocked by a logging failure. */
export async function logCustomerView(email: string, context: string): Promise<void> {
  const { sb, isLive } = await getSupabaseContext();
  if (!sb || !isLive) return;
  const res = await sb.rpc("log_customer_data_view", { p_customer: email, p_context: context });
  if (res.error) console.warn("Could not record the customer view", friendly(res.error.message));
}

export async function sendVendorNote(vendorId: string, note: string): Promise<void> {
  const { sb } = await getSupabaseContext();
  if (!sb) throw new Error("The live database is not connected");
  const res = await sb.rpc("send_vendor_note", { p_vendor: vendorId, p_note: note });
  if (res.error) throw new Error(friendly(res.error.message));
}

/** Operations and Super Admin: send a vendor an invitation email so they can set a password and onboard. */
export async function inviteVendorByEmail(input: { email: string; name: string; businessName: string }, accessToken: string): Promise<void> {
  const res = await fetch("/api/admin/invite-vendor", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(input) });
  const json = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(json.error || "The invitation could not be sent");
}
