import type { SupabaseClient } from "@supabase/supabase-js";
import { insertOrderWithBilling, priceExistingSchedule } from "./schedule-billing.ts";

export const INDIA_TIMEZONE = "Asia/Kolkata";
export const PAUSE_WINDOW_DAYS = 15;

/**
 * Returns the current date and time formatted in India Standard Time (IST, UTC+5:30).
 */
export function getIndiaDate(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm:ss
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) partMap[p.type] = p.value;
  const year = Number(partMap.year);
  const month = Number(partMap.month);
  const day = Number(partMap.day);
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeStr = `${partMap.hour}:${partMap.minute}:${partMap.second}`;
  return { year, month, day, dateStr, timeStr };
}

/**
 * Calculates the Resume-By timestamp: exactly start + days at 23:59:59.999 IST.
 */
export function computeResumeByIST(fromDate: Date = new Date(), days: number = PAUSE_WINDOW_DAYS): Date {
  const ist = getIndiaDate(fromDate);
  // Construct date at 23:59:59 in IST (+05:30)
  // Add `days` calendar days in IST
  const targetDate = new Date(Date.UTC(ist.year, ist.month - 1, ist.day + days, 18, 29, 59, 999));
  // 18:29:59.999 UTC is 23:59:59.999 IST
  return targetDate;
}

/**
 * Formats a Date/ISO string nicely in IST, e.g. "3 Dec 2026".
 */
export function formatISTDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return "";
  return dateObj.toLocaleDateString("en-IN", {
    timeZone: INDIA_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Calculates days remaining until the resume deadline (IST).
 */
export function getDaysRemainingIST(resumeBy: string | Date | null | undefined, now: Date = new Date()): number {
  if (!resumeBy) return 0;
  const target = typeof resumeBy === "string" ? new Date(resumeBy) : resumeBy;
  const nowIST = getIndiaDate(now);
  const targetIST = getIndiaDate(target);
  const nowDate = new Date(Date.UTC(nowIST.year, nowIST.month - 1, nowIST.day));
  const targetDate = new Date(Date.UTC(targetIST.year, targetIST.month - 1, targetIST.day));
  const diffDays = Math.round((targetDate.getTime() - nowDate.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

/**
 * Returns true if the pause deadline has passed in IST.
 */
export function isPauseWindowExpiredIST(resumeBy: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!resumeBy) return false;
  const target = typeof resumeBy === "string" ? new Date(resumeBy) : resumeBy;
  return now.getTime() > target.getTime();
}

/**
 * Helper to generate order number
 */
function orderNumber() {
  return `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Safe DB column check helper.
 */
const isMissingColumnError = (e: { code?: string; message?: string } | null | undefined) =>
  Boolean(e && (e.code === "42703" || e.code === "PGRST204" || /column .* (does not exist|of relation)|schema cache/i.test(e.message || "")));

/**
 * Safe DB check constraint error helper.
 */
const isCheckConstraintError = (e: { code?: string; message?: string } | null | undefined) =>
  Boolean(e && (e.code === "23514" || /violates check constraint/i.test(e.message || "")));

/**
 * Logs an event in product_schedule_history and audit_log safely.
 */
export async function logScheduleHistory(
  admin: SupabaseClient,
  params: {
    scheduleId: string;
    action: "pause" | "resume" | "auto_close" | "admin_close" | "admin_reopen" | "reminder_sent";
    previousStatus: string;
    newStatus: string;
    actorId?: string | null;
    actorEmail?: string | null;
    actorRole?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await admin.from("product_schedule_history").insert({
      schedule_id: params.scheduleId,
      action: params.action,
      previous_status: params.previousStatus,
      new_status: params.newStatus,
      actor_id: params.actorId || null,
      actor_email: params.actorEmail || null,
      actor_role: params.actorRole || null,
      reason: params.reason || null,
      metadata: params.metadata || {},
    });
  } catch {
    // Graceful fallback if table is not yet created in live DB
  }

  try {
    await admin.from("audit_log").insert({
      actor_id: params.actorId || null,
      actor_email: params.actorEmail || "system",
      actor_role: params.actorRole || "system",
      action: `schedule_${params.action}`,
      target_type: "schedule",
      target_id: params.scheduleId,
      summary: `Schedule ${params.scheduleId} ${params.action} (${params.previousStatus} -> ${params.newStatus})${params.reason ? `: ${params.reason}` : ""}`,
      metadata: {
        scheduleId: params.scheduleId,
        action: params.action,
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        reason: params.reason,
        ...params.metadata,
      },
    });
  } catch {
    // Keep resilient
  }
}

/**
 * Pause a schedule: starts 15-day pause window, skips upcoming slots without refund,
 * logs history and notifies customer.
 */
export async function pauseScheduleServer(
  admin: SupabaseClient,
  scheduleId: string,
  actor: { id: string; email: string; role: string }
): Promise<{ ok: boolean; error?: string; status?: number; pausedAt?: string; resumeBy?: string }> {
  const { data: schedule, error } = await admin
    .from("product_schedules")
    .select("id,customer_id,vendor_id,menu_item_id,status,start_date,end_date,recurrence,weekdays,scheduled_slot,quantity,unit,fulfilment_mode")
    .eq("id", scheduleId)
    .maybeSingle();

  if (error || !schedule) return { ok: false, error: "Schedule not found.", status: 404 };

  if (actor.role === "customer" && schedule.customer_id !== actor.id) {
    return { ok: false, error: "Not authorised to modify this schedule.", status: 403 };
  }

  if (schedule.status === "paused") {
    return { ok: false, error: "This schedule is already paused.", status: 400 };
  }
  if (schedule.status === "closed") {
    return { ok: false, error: "This schedule is closed and cannot be paused.", status: 400 };
  }
  if (schedule.status !== "active") {
    return { ok: false, error: `Only active schedules can be paused. Current status is ${schedule.status}.`, status: 400 };
  }

  const now = new Date();
  const pausedAt = now.toISOString();
  const resumeByDate = computeResumeByIST(now, PAUSE_WINDOW_DAYS);
  const resumeBy = resumeByDate.toISOString();
  const istToday = getIndiaDate(now).dateStr;

  // 1. Update product_schedules
  let updateResult = await admin
    .from("product_schedules")
    .update({
      status: "paused",
      paused_at: pausedAt,
      resume_by: resumeBy,
      updated_at: pausedAt,
    })
    .eq("id", scheduleId);

  if (updateResult.error && isMissingColumnError(updateResult.error)) {
    // If resume_by column not migrated yet, fallback to paused_at only
    updateResult = await admin
      .from("product_schedules")
      .update({
        status: "paused",
        paused_at: pausedAt,
        updated_at: pausedAt,
      })
      .eq("id", scheduleId);
  }

  if (updateResult.error) {
    return { ok: false, error: updateResult.error.message || "Failed to pause schedule.", status: 500 };
  }

  // 2. Hide / cancel upcoming unfulfilled orders for this schedule from today onwards
  // Slots that fall during the pause are skipped, NOT refunded
  const { data: futureOrders } = await admin
    .from("orders")
    .select("id,order_number,status,scheduled_date")
    .eq("schedule_id", scheduleId)
    .gte("scheduled_date", istToday)
    .in("status", ["awarded", "confirmed"]);

  if (futureOrders && futureOrders.length > 0) {
    const futureOrderIds = futureOrders.map((o) => o.id);
    await admin
      .from("orders")
      .update({
        status: "cancelled",
        cancellation_fee: 0,
        updated_at: pausedAt,
      })
      .in("id", futureOrderIds);
  }

  // 3. Log history
  await logScheduleHistory(admin, {
    scheduleId,
    action: "pause",
    previousStatus: "active",
    newStatus: "paused",
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    reason: "Paused by customer (15-day pause window started)",
    metadata: { pausedAt, resumeBy, istToday, skippedOrdersCount: futureOrders?.length || 0 },
  });

  // 4. Notify customer
  const resumeFormatted = formatISTDate(resumeByDate);
  await admin.from("notifications").insert({
    recipient_id: schedule.customer_id,
    kind: "schedule",
    title: "Schedule paused",
    body: `Your schedule is paused until ${resumeFormatted}. Resume by ${resumeFormatted} to keep your remaining deliveries. Unresumed schedules will be closed without refund.`,
    entity_type: "schedule",
    entity_id: scheduleId,
  });

  // 5. Notify vendor
  const { data: vendor } = await admin.from("vendors").select("owner_id,name").eq("id", schedule.vendor_id).maybeSingle();
  if (vendor?.owner_id) {
    await admin.from("notifications").insert({
      recipient_id: vendor.owner_id,
      kind: "schedule",
      title: "Schedule paused by customer",
      body: `A customer has paused their subscription schedule until ${resumeFormatted}. Upcoming deliveries are suspended.`,
      entity_type: "schedule",
      entity_id: scheduleId,
    });
  }

  // 6. Pre-schedule reminders in communication_outbox for Day 7, Day 13, and Day 14
  const day7Date = computeResumeByIST(now, 7);
  const day13Date = computeResumeByIST(now, 13);
  const day14Date = computeResumeByIST(now, 14);

  const outboxReminders = [
    {
      recipient_id: schedule.customer_id,
      channel: "in_app",
      template_key: "schedule_pause_reminder_day7",
      payload: { scheduleId, resumeBy, resumeFormatted, daysLeft: 8 },
      scheduled_for: day7Date.toISOString(),
    },
    {
      recipient_id: schedule.customer_id,
      channel: "in_app",
      template_key: "schedule_pause_reminder_day13",
      payload: { scheduleId, resumeBy, resumeFormatted, daysLeft: 2 },
      scheduled_for: day13Date.toISOString(),
    },
    {
      recipient_id: schedule.customer_id,
      channel: "in_app",
      template_key: "schedule_pause_reminder_day14",
      payload: { scheduleId, resumeBy, resumeFormatted, daysLeft: 1 },
      scheduled_for: day14Date.toISOString(),
    },
  ];

  try {
    await admin.from("communication_outbox").insert(outboxReminders);
  } catch {
    // Non-fatal
  }

  return { ok: true, pausedAt, resumeBy };
}

/**
 * Resume a schedule:
 * - Checks if within 15-day window (blocks if customer tries to resume after deadline).
 * - Restores schedule to active.
 * - Places orders again from the next scheduled slot (slots that fell during the pause are skipped).
 * - Fresh 15-day window will be granted on any future pause.
 */
export async function resumeScheduleServer(
  admin: SupabaseClient,
  scheduleId: string,
  actor: { id: string; email: string; role: string },
  adminReason?: string
): Promise<{ ok: boolean; error?: string; status?: number; nextDeliveryDate?: string }> {
  const { data: schedule, error } = await admin
    .from("product_schedules")
    .select("id,customer_id,vendor_id,menu_item_id,status,start_date,end_date,recurrence,weekdays,scheduled_slot,quantity,unit,fulfilment_mode,paused_at,resume_by")
    .eq("id", scheduleId)
    .maybeSingle();

  if (error || !schedule) return { ok: false, error: "Schedule not found.", status: 404 };

  const isStaff = actor.role === "admin" || actor.role === "operations";
  if (actor.role === "customer" && schedule.customer_id !== actor.id) {
    return { ok: false, error: "Not authorised to modify this schedule.", status: 403 };
  }

  const previousStatus = schedule.status;
  const isReopen = isStaff && (previousStatus === "closed" || previousStatus === "completed");

  if (schedule.status === "active") {
    return { ok: false, error: "Schedule is already active.", status: 400 };
  }

  const now = new Date();

  // If customer is attempting to resume, verify 15-day deadline strictly
  if (!isStaff) {
    if (schedule.status === "closed") {
      return { ok: false, error: "This schedule was closed because the 15-day pause window expired and cannot be resumed.", status: 409 };
    }
    if (schedule.status !== "paused") {
      return { ok: false, error: `Only paused schedules can be resumed. Current status is ${schedule.status}.`, status: 400 };
    }
    if (schedule.resume_by && isPauseWindowExpiredIST(schedule.resume_by, now)) {
      // Auto-close it now and refuse
      await closeScheduleServer(admin, scheduleId, { id: "system", email: "system", role: "system" }, "Not resumed within 15 days");
      return {
        ok: false,
        error: `The 15-day pause window expired on ${formatISTDate(schedule.resume_by)}. This schedule is now closed and cannot be resumed.`,
        status: 409,
      };
    }
  }

  // Update schedule status to active and clear pause window
  const updatePayload: Record<string, unknown> = {
    status: "active",
    paused_at: null,
    resume_by: null,
    closed_at: null,
    closure_reason: null,
    updated_at: now.toISOString(),
  };

  let updateResult = await admin.from("product_schedules").update(updatePayload).eq("id", scheduleId);
  if (updateResult.error && isMissingColumnError(updateResult.error)) {
    updateResult = await admin
      .from("product_schedules")
      .update({
        status: "active",
        paused_at: null,
        updated_at: now.toISOString(),
      })
      .eq("id", scheduleId);
  }
  if (updateResult.error) {
    return { ok: false, error: updateResult.error.message || "Failed to resume schedule.", status: 500 };
  }

  // Cancel any pending outbox pause reminders
  try {
    await admin
      .from("communication_outbox")
      .update({ status: "cancelled" })
      .eq("recipient_id", schedule.customer_id)
      .in("template_key", [
        "schedule_pause_reminder_day7",
        "schedule_pause_reminder_day13",
        "schedule_pause_reminder_day14",
      ])
      .eq("status", "queued");
  } catch {
    // Non-fatal
  }

  // Generate upcoming orders starting from tomorrow (slots during pause were skipped)
  const istToday = getIndiaDate(now).dateStr;
  const tomorrow = getIndiaDate(new Date(now.getTime() + 24 * 60 * 60 * 1000)).dateStr;
  const rawDates = generateUpcomingDates({
    start_date: tomorrow,
    end_date: schedule.end_date,
    recurrence: schedule.recurrence,
    weekdays: schedule.weekdays,
  });

  let nextDeliveryDate: string | undefined = rawDates[0];

  // Retrieve priced deliveries for remaining dates
  try {
    if (rawDates.length > 0) {
      const priced = await priceExistingSchedule(admin, scheduleId, rawDates);
      if (priced && priced.deliveries.length > 0) {
        nextDeliveryDate = priced.deliveries[0].date;
        for (const delivery of priced.deliveries) {
          // Ensure duplicate check
          const { data: existing } = await admin
            .from("orders")
            .select("id")
            .eq("schedule_id", scheduleId)
            .eq("scheduled_date", delivery.date)
            .maybeSingle();

          if (existing?.id) continue;

          const orderRow = {
            order_number: orderNumber(),
            schedule_id: scheduleId,
            customer_id: schedule.customer_id,
            vendor_id: schedule.vendor_id,
            fulfilment_mode: schedule.fulfilment_mode,
            scheduled_date: delivery.date,
            scheduled_slot: schedule.scheduled_slot,
            status: "confirmed",
          };

          const insertedOrder = await insertOrderWithBilling(admin, orderRow, delivery);
          if (insertedOrder.data?.id) {
            // Pre-paid coverage record
            await admin.from("payments").insert({
              order_id: insertedOrder.data.id,
              customer_id: schedule.customer_id,
              amount: 0,
              status: "paid",
              provider: "schedule_prepaid",
              provider_reference: `RESUMED-${scheduleId}`,
            });

            // Order item
            const { data: menuItem } = await admin
              .from("vendor_menu_items")
              .select("id,name,vendor_base_price")
              .eq("id", schedule.menu_item_id)
              .maybeSingle();

            await admin.from("order_items").insert({
              order_id: insertedOrder.data.id,
              product_name: delivery.label || menuItem?.name || "Scheduled meal",
              quantity: Number(schedule.quantity || 1),
              unit: String(schedule.unit || "pack"),
              vendor_base_price: delivery.baseUnit,
              markup_percent: delivery.baseUnit > 0 ? Math.max(0, (delivery.customerUnit / delivery.baseUnit - 1) * 100) : 0,
              customer_price: delivery.customerUnit,
            });
          }
        }
      }
    }
  } catch {
    // Non-fatal if pricing calculation fails; schedule remains resumed
  }

  // Log history
  await logScheduleHistory(admin, {
    scheduleId,
    action: isReopen ? "admin_reopen" : "resume",
    previousStatus,
    newStatus: "active",
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    reason: isStaff ? adminReason || "Reopened by administrator" : "Resumed by customer within 15-day window",
    metadata: { nextDeliveryDate, istToday },
  });

  // Notify customer
  await admin.from("notifications").insert({
    recipient_id: schedule.customer_id,
    kind: "schedule",
    title: "Schedule resumed",
    body: nextDeliveryDate
      ? `Your schedule is now active. Your next delivery will arrive on ${formatISTDate(nextDeliveryDate)}.`
      : "Your schedule is now active.",
    entity_type: "schedule",
    entity_id: scheduleId,
  });

  // Notify vendor
  const { data: vendor } = await admin.from("vendors").select("owner_id,name").eq("id", schedule.vendor_id).maybeSingle();
  if (vendor?.owner_id) {
    await admin.from("notifications").insert({
      recipient_id: vendor.owner_id,
      kind: "schedule",
      title: "Schedule resumed by customer",
      body: nextDeliveryDate
        ? `Customer resumed their schedule. Deliveries resume on ${formatISTDate(nextDeliveryDate)}.`
        : "Customer resumed their subscription schedule.",
      entity_type: "schedule",
      entity_id: scheduleId,
    });
  }

  return { ok: true, nextDeliveryDate };
}

/**
 * Close a schedule (automatic after 15 days or by admin).
 * Idempotent: running twice will NOT double-close or double-notify.
 * No refund is created; payments and settlements remain unchanged.
 */
export async function closeScheduleServer(
  admin: SupabaseClient,
  scheduleId: string,
  actor: { id: string; email: string; role: string },
  closureReason: string = "Closed: not resumed within 15 days"
): Promise<{ ok: boolean; error?: string; status?: number; alreadyClosed?: boolean }> {
  const { data: schedule, error } = await admin
    .from("product_schedules")
    .select("id,customer_id,vendor_id,status,paused_at,resume_by,closed_at")
    .eq("id", scheduleId)
    .maybeSingle();

  if (error || !schedule) return { ok: false, error: "Schedule not found.", status: 404 };

  if (schedule.status === "closed") {
    // Idempotent: already closed
    return { ok: true, alreadyClosed: true };
  }

  const now = new Date().toISOString();

  let updateResult = await admin
    .from("product_schedules")
    .update({
      status: "closed",
      closed_at: now,
      closure_reason: closureReason,
      updated_at: now,
    })
    .eq("id", scheduleId)
    .neq("status", "closed"); // Optimistic concurrency check

  if (updateResult.error && isMissingColumnError(updateResult.error)) {
    updateResult = await admin
      .from("product_schedules")
      .update({
        status: "closed",
        updated_at: now,
      })
      .eq("id", scheduleId)
      .neq("status", "closed");
  }

  if (updateResult.error && isCheckConstraintError(updateResult.error)) {
    // If 'closed' is not yet in the status check constraint, fallback to 'completed' with metadata
    updateResult = await admin
      .from("product_schedules")
      .update({
        status: "completed",
        updated_at: now,
      })
      .eq("id", scheduleId);
  }

  if (updateResult.error) {
    return { ok: false, error: updateResult.error.message || "Failed to close schedule.", status: 500 };
  }

  // Cancel any remaining future unfulfilled orders without refund
  const istToday = getIndiaDate().dateStr;
  await admin
    .from("orders")
    .update({
      status: "cancelled",
      cancellation_fee: 0,
      updated_at: now,
    })
    .eq("schedule_id", scheduleId)
    .gte("scheduled_date", istToday)
    .in("status", ["awarded", "confirmed"]);

  // Cancel any pending outbox reminders
  try {
    await admin
      .from("communication_outbox")
      .update({ status: "cancelled" })
      .eq("recipient_id", schedule.customer_id)
      .in("template_key", [
        "schedule_pause_reminder_day7",
        "schedule_pause_reminder_day13",
        "schedule_pause_reminder_day14",
      ])
      .eq("status", "queued");
  } catch {
    // Non-fatal
  }

  // Log history
  await logScheduleHistory(admin, {
    scheduleId,
    action: actor.role === "system" ? "auto_close" : "admin_close",
    previousStatus: schedule.status,
    newStatus: "closed",
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    reason: closureReason,
    metadata: { closedAt: now, noRefundPolicyEnforced: true },
  });

  // Notify customer only once
  await admin.from("notifications").insert({
    recipient_id: schedule.customer_id,
    kind: "schedule",
    title: "Schedule closed",
    body: "Your schedule has been closed as it was not resumed within the 15-day pause window. Unused deliveries are non-refundable as per policy.",
    entity_type: "schedule",
    entity_id: scheduleId,
  });

  return { ok: true, alreadyClosed: false };
}

/**
 * Scheduled job to check all paused schedules:
 * 1. Closes any whose 15-day window has expired (resume_by <= now in IST).
 * 2. Sends day 7, 13, and 14 reminders if not already sent.
 * Safe to run repeatedly (idempotent).
 */
export async function processScheduleDeadlines(
  admin: SupabaseClient
): Promise<{ checked: number; closed: number; remindersSent: number }> {
  const now = new Date();
  let closedCount = 0;
  let remindersSent = 0;

  // 1. Fetch all paused schedules
  const { data: pausedSchedules, error } = await admin
    .from("product_schedules")
    .select("id,customer_id,vendor_id,status,paused_at,resume_by")
    .eq("status", "paused");

  if (error || !pausedSchedules) return { checked: 0, closed: 0, remindersSent: 0 };

  for (const item of pausedSchedules) {
    const resumeBy = item.resume_by || (item.paused_at ? computeResumeByIST(new Date(item.paused_at), PAUSE_WINDOW_DAYS).toISOString() : null);
    if (!resumeBy) continue;

    // A. Check if 15-day window has expired
    if (isPauseWindowExpiredIST(resumeBy, now)) {
      const res = await closeScheduleServer(
        admin,
        item.id,
        { id: "system", email: "system@sheplates.internal", role: "system" },
        "Closed: not resumed within 15 days"
      );
      if (res.ok && !res.alreadyClosed) closedCount++;
      continue;
    }

    // B. Check if reminders need to be sent
    if (item.paused_at) {
      const pausedDate = new Date(item.paused_at);
      const daysElapsed = Math.floor((now.getTime() - pausedDate.getTime()) / (24 * 60 * 60 * 1000));
      const daysRemaining = getDaysRemainingIST(resumeBy, now);
      const resumeFormatted = formatISTDate(resumeBy);

      // Check existing history to prevent double notification
      const { data: history } = await admin
        .from("product_schedule_history")
        .select("action,metadata")
        .eq("schedule_id", item.id)
        .eq("action", "reminder_sent");

      const sentMilestones = new Set(
        (history || []).map((h) => String((h.metadata as Record<string, unknown>)?.milestone || ""))
      );

      // Milestone Day 7 (approx 8 days remaining)
      if (daysElapsed >= 7 && daysElapsed < 13 && !sentMilestones.has("day_7")) {
        await sendPauseReminderNotification(admin, item.id, item.customer_id, "day_7", 7, daysRemaining, resumeFormatted);
        remindersSent++;
      }
      // Milestone Day 13 (approx 2 days remaining)
      else if (daysElapsed >= 13 && daysElapsed < 14 && !sentMilestones.has("day_13")) {
        await sendPauseReminderNotification(admin, item.id, item.customer_id, "day_13", 13, daysRemaining, resumeFormatted);
        remindersSent++;
      }
      // Milestone Day 14 (1 day remaining / final day)
      else if (daysElapsed >= 14 && !sentMilestones.has("day_14")) {
        await sendPauseReminderNotification(admin, item.id, item.customer_id, "day_14", 14, daysRemaining, resumeFormatted);
        remindersSent++;
      }
    }
  }

  return { checked: pausedSchedules.length, closed: closedCount, remindersSent };
}

async function sendPauseReminderNotification(
  admin: SupabaseClient,
  scheduleId: string,
  customerId: string,
  milestone: "day_7" | "day_13" | "day_14",
  daysElapsed: number,
  daysRemaining: number,
  resumeFormatted: string
) {
  let title = "Resume your schedule";
  let body = `Your schedule has been paused for ${daysElapsed} days. You have ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left to resume before ${resumeFormatted}.`;

  if (milestone === "day_14") {
    title = "Final day to resume your schedule";
    body = `Tomorrow is the final day of your 15-day pause window. Resume by ${resumeFormatted} to avoid losing remaining deliveries.`;
  }

  await admin.from("notifications").insert({
    recipient_id: customerId,
    kind: "schedule",
    title,
    body,
    entity_type: "schedule",
    entity_id: scheduleId,
  });

  await logScheduleHistory(admin, {
    scheduleId,
    action: "reminder_sent",
    previousStatus: "paused",
    newStatus: "paused",
    actorId: null,
    actorEmail: "system",
    actorRole: "system",
    reason: `Automated pause reminder (${milestone})`,
    metadata: { milestone, daysElapsed, daysRemaining, resumeFormatted },
  });
}

/**
 * Date calculation utility for upcoming recurrence slots
 */
function generateUpcomingDates(input: {
  start_date: string;
  end_date?: string | null;
  recurrence: string;
  weekdays?: number[] | null;
}): string[] {
  const start = String(input.start_date);
  const mode = String(input.recurrence || "once").toLowerCase();
  const maxHorizon = 60;
  const out: string[] = [];
  const end = input.end_date ? String(input.end_date) : addDaysString(start, maxHorizon);

  let cursor = start;
  while (cursor <= end && out.length < maxHorizon) {
    const day = new Date(`${cursor}T12:00:00Z`).getUTCDay();
    if (
      mode === "once" ||
      mode === "daily" ||
      (mode === "weekly" && day === new Date(`${start}T12:00:00Z`).getUTCDay()) ||
      (mode === "custom" && (input.weekdays || []).includes(day))
    ) {
      out.push(cursor);
    }
    cursor = addDaysString(cursor, 1);
  }
  return out;
}

function addDaysString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
