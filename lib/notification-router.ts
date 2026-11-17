/**
 * Shared Notification Routing and Navigation
 *
 * Provides a single centralized routing function across all 4 modules (Customer, Vendor, Operations, Admin)
 * and platforms (Web, Android, iOS).
 */

export type Role = "customer" | "vendor" | "operations" | "admin";

export interface NotificationItem {
  id: string;
  recipient: string;
  recipientRole: Role;
  title: string;
  body: string;
  at?: string;
  read?: boolean;
  type?: string;
  kind?: string;
  entityType?: string | null;
  entityId?: string | null;
  href?: string;
  metadata?: Record<string, any>;
}

export interface NotificationRoute {
  module: Role;
  view: string;
  queryParams?: Record<string, string>;
  targetId?: string;
  targetType?: string;
  message?: string;
  url: string;
  accessDenied?: boolean;
}

export interface NavigationSession {
  email: string;
  role: Role;
  name?: string;
  userId?: string;
  vendorId?: string;
}

/**
 * Extracts normalized notification type from type, kind, entityType, or title/body.
 */
export function extractNotificationType(item: NotificationItem): string {
  if (item.type) return item.type.toLowerCase();
  if (item.kind && item.kind !== "general") return item.kind.toLowerCase();
  if (item.entityType) {
    const et = item.entityType.toLowerCase();
    if (et === "customer_follow_request") return "customer_follow_request";
    if (et === "order") return "order_status_changed";
    if (et === "rfq" || et === "quotation" || et === "requirement") return "rfq_quote_submitted";
    if (et === "ticket") return "ticket_updated";
    if (et === "food_drop") return "food_drop_available";
  }

  const text = `${item.title} ${item.body}`.toLowerCase();

  if (text.includes("delivery person assigned") || text.includes("delivery partner assigned")) {
    return "order_assigned";
  }
  if (text.includes("live location updated")) {
    return "delivery_location_updated";
  }
  if (text.includes("quality complaint") || text.includes("cancellation review") || text.includes("cancellation requested")) {
    return "cancellation_review";
  }
  if (text.includes("complete payment") || text.includes("quotation selected") || text.includes("order created")) {
    return "rfq_payment_due";
  }
  if (text.includes("a vendor sent a quotation") || text.includes("new quote opportunity") || text.includes("requirement sent")) {
    return "rfq_received";
  }
  if (text.includes("food drop confirmed") || text.includes("new food drop order") || text.includes("pickup verification code")) {
    return "food_drop_claimed";
  }
  if (text.includes("food drop") && (text.includes("available") || text.includes("live") || text.includes("special batches"))) {
    return "food_drop_posted";
  }
  if (text.includes("schedule ready for payment") || text.includes("schedule created")) {
    return "schedule_payment_due";
  }
  if (text.includes("payout sent") || text.includes("marked paid")) {
    return "payout_sent";
  }
  if (text.includes("support request") || text.includes("support ticket") || text.includes("ticket created")) {
    return "ticket_updated";
  }
  if (text.includes("vendor verified") || text.includes("vendor rejected") || text.includes("vendor application") || text.includes("plan changed")) {
    return "vendor_verification_update";
  }
  if (text.includes("order confirmed") || text.includes("order preparing") || text.includes("order ready") || text.includes("order on the way") || text.includes("order delivered")) {
    return "order_status_changed";
  }
  if (text.includes("order #") || text.includes("new order")) {
    return "order_new";
  }

  return "unknown";
}

/**
 * Extracts target entity ID from explicit field or regex on title/body.
 */
export function extractTargetId(item: NotificationItem, type?: string): string | undefined {
  if (item.entityId) return item.entityId;

  const text = `${item.title} ${item.body}`;

  // Order ID
  const ordMatch = text.match(/\b(ORD-[A-Za-z0-9_-]+)\b/i) || text.match(/order\s+#?([A-Za-z0-9_-]+)/i);
  if (ordMatch) return ordMatch[1];

  // RFQ / Requirement ID
  const rfqMatch = text.match(/\b(RFQ-[A-Za-z0-9_-]+)\b/i);
  if (rfqMatch) return rfqMatch[1];

  // Ticket ID
  const tktMatch = text.match(/\b(TKT-[A-Za-z0-9_-]+)\b/i);
  if (tktMatch) return tktMatch[1];

  // Cancellation ID
  const canMatch = text.match(/\b(CAN-[A-Za-z0-9_-]+)\b/i);
  if (canMatch) return canMatch[1];

  // Food Drop ID
  const dropMatch = text.match(/\b(DRP-[A-Za-z0-9_-]+)\b/i);
  if (dropMatch) return dropMatch[1];

  // Schedule ID
  const schMatch = text.match(/\b(SCH-[A-Za-z0-9_-]+)\b/i);
  if (schMatch) return schMatch[1];

  // Vendor ID
  const vndMatch = text.match(/\b(VND-[A-Za-z0-9_-]+)\b/i);
  if (vndMatch) return vndMatch[1];

  return undefined;
}

/**
 * Builds the URL with ?view= and query parameters.
 */
export function buildNotificationUrl(view: string, queryParams?: Record<string, string>): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v) params.set(k, v);
    }
  }
  return `/?${params.toString()}`;
}

/**
 * Resolves the target screen, query parameters, and verifies existence and ownership.
 */
export function resolveNotificationTarget(
  item: NotificationItem,
  session: NavigationSession | null,
  state?: {
    orders?: Array<{ id: string; customerEmail: string; vendorId: string; [key: string]: any }>;
    requirements?: Array<{ id: string; customerEmail: string; [key: string]: any }>;
    tickets?: Array<{ id: string; creatorEmail: string; vendorId?: string; [key: string]: any }>;
    foodDrops?: Array<{ id: string; vendorId: string; [key: string]: any }>;
    schedules?: Array<{ id: string; customerEmail: string; [key: string]: any }>;
    vendors?: Array<{ id: string; ownerEmail: string; [key: string]: any }>;
  }
): NotificationRoute {
  const module = session?.role || item.recipientRole || "customer";
  const type = extractNotificationType(item);
  const targetId = extractTargetId(item, type);

  // Default fallback if type is unknown
  if (type === "unknown") {
    return {
      module,
      view: "Notifications",
      targetType: "unknown",
      message: "Opening notification list.",
      url: buildNotificationUrl("Notifications"),
    };
  }

  // 1. ORDERS & DELIVERY
  if (["order_assigned", "order_status_changed", "order_new", "delivery_location_updated"].includes(type)) {
    const view = "Orders";
    const queryParams: Record<string, string> = {};

    if (targetId) {
      if (state?.orders && state.orders.length > 0) {
        const order = state.orders.find((o) => o.id === targetId || o.id.toLowerCase() === targetId.toLowerCase());
        if (!order) {
          return {
            module,
            view,
            targetId,
            targetType: "order",
            message: `Order #${targetId} is no longer available. Showing your Orders list.`,
            url: buildNotificationUrl(view),
          };
        }

        // Verify ownership
        if (module === "customer" && session && order.customerEmail.toLowerCase() !== session.email.toLowerCase()) {
          return {
            module,
            view,
            targetId,
            targetType: "order",
            accessDenied: true,
            message: "Access denied: You do not have permission to view that order.",
            url: buildNotificationUrl(view),
          };
        }

        if (module === "vendor" && session?.vendorId && order.vendorId !== session.vendorId) {
          return {
            module,
            view,
            targetId,
            targetType: "order",
            accessDenied: true,
            message: "Access denied: That order does not belong to your kitchen.",
            url: buildNotificationUrl(view),
          };
        }
      }
      queryParams.orderId = targetId;
    }

    return {
      module,
      view,
      queryParams,
      targetId,
      targetType: "order",
      url: buildNotificationUrl(view, queryParams),
    };
  }

  // 2. QUOTATIONS / RFQ
  if (["rfq_received", "rfq_quote_submitted", "rfq_payment_due"].includes(type)) {
    let view = "My quotations";
    if (module === "vendor") view = "Quote opportunities";
    if (module === "operations") view = "RFQ desk";

    const queryParams: Record<string, string> = {};
    if (targetId) {
      if (state?.requirements && state.requirements.length > 0) {
        const req = state.requirements.find((r) => r.id === targetId);
        if (!req) {
          return {
            module,
            view,
            targetId,
            targetType: "rfq",
            message: `Quotation request #${targetId} is no longer available.`,
            url: buildNotificationUrl(view),
          };
        }

        if (module === "customer" && session && req.customerEmail.toLowerCase() !== session.email.toLowerCase()) {
          return {
            module,
            view,
            targetId,
            targetType: "rfq",
            accessDenied: true,
            message: "Access denied: You do not have permission to view that quotation request.",
            url: buildNotificationUrl(view),
          };
        }
      }
      queryParams.requirementId = targetId;
    }

    return {
      module,
      view,
      queryParams,
      targetId,
      targetType: "rfq",
      url: buildNotificationUrl(view, queryParams),
    };
  }

  // 3. FOOD DROPS
  if (["food_drop_posted", "food_drop_claimed"].includes(type)) {
    // If it's a confirmed drop order with an order id, go to Orders screen
    if (type === "food_drop_claimed" && targetId && targetId.startsWith("ORD-")) {
      return {
        module,
        view: "Orders",
        queryParams: { orderId: targetId },
        targetId,
        targetType: "order",
        url: buildNotificationUrl("Orders", { orderId: targetId }),
      };
    }

    const view = "Food Drops";
    const queryParams: Record<string, string> = {};
    if (targetId) {
      if (state?.foodDrops && state.foodDrops.length > 0) {
        const drop = state.foodDrops.find((d) => d.id === targetId);
        if (!drop) {
          return {
            module,
            view,
            targetId,
            targetType: "food_drop",
            message: "This Food Drop has expired or ended. Showing active Food Drops.",
            url: buildNotificationUrl(view),
          };
        }
      }
      queryParams.dropId = targetId;
    }

    return {
      module,
      view,
      queryParams,
      targetId,
      targetType: "food_drop",
      url: buildNotificationUrl(view, queryParams),
    };
  }

  // 4. SUBSCRIPTIONS / SCHEDULES
  if (type === "schedule_payment_due") {
    const view = module === "customer" ? "My schedule" : "Orders";
    const queryParams: Record<string, string> = {};
    if (targetId) {
      if (state?.schedules && state.schedules.length > 0) {
        const sch = state.schedules.find((s) => s.id === targetId);
        if (!sch) {
          return {
            module,
            view,
            targetId,
            targetType: "schedule",
            message: "This subscription schedule is no longer available.",
            url: buildNotificationUrl(view),
          };
        }
      }
      queryParams.scheduleId = targetId;
    }
    return {
      module,
      view,
      queryParams,
      targetId,
      targetType: "schedule",
      url: buildNotificationUrl(view, queryParams),
    };
  }

  // 5. SUPPORT TICKETS
  if (type === "ticket_updated") {
    const view = "Ticket centre";
    const queryParams: Record<string, string> = {};
    if (targetId) {
      if (state?.tickets && state.tickets.length > 0) {
        const ticket = state.tickets.find((t) => t.id === targetId);
        if (!ticket) {
          return {
            module,
            view,
            targetId,
            targetType: "ticket",
            message: `Support ticket #${targetId} is no longer available. Opening Ticket centre.`,
            url: buildNotificationUrl(view),
          };
        }

        if (module === "customer" && session && ticket.creatorEmail.toLowerCase() !== session.email.toLowerCase()) {
          return {
            module,
            view,
            targetId,
            targetType: "ticket",
            accessDenied: true,
            message: "Access denied: You do not have permission to view that ticket.",
            url: buildNotificationUrl(view),
          };
        }
      }
      queryParams.ticketId = targetId;
    }
    return {
      module,
      view,
      queryParams,
      targetId,
      targetType: "ticket",
      url: buildNotificationUrl(view, queryParams),
    };
  }

  // 6. CANCELLATIONS & QUALITY COMPLAINTS
  if (type === "cancellation_review") {
    const view = module === "operations" ? "Cancellations" : "Orders";
    const queryParams: Record<string, string> = {};
    if (targetId) queryParams.cancellationId = targetId;
    return {
      module,
      view,
      queryParams,
      targetId,
      targetType: "cancellation",
      url: buildNotificationUrl(view, queryParams),
    };
  }

  // 7. PAYOUTS & SETTLEMENTS
  if (type === "payout_sent") {
    const view = module === "vendor" ? "Settlements" : "Vendor payments";
    return {
      module,
      view,
      targetType: "payout",
      url: buildNotificationUrl(view),
    };
  }

  // 8. VENDOR VERIFICATION & ONBOARDING
  if (type === "vendor_verification_update") {
    const view = module === "operations" ? "Vendor verification" : "Verification";
    const queryParams: Record<string, string> = {};
    if (targetId) queryParams.vendorId = targetId;
    return {
      module,
      view,
      queryParams,
      targetId,
      targetType: "verification",
      url: buildNotificationUrl(view, queryParams),
    };
  }

  // 9. FOLLOW REQUEST
  if (type === "customer_follow_request") {
    return {
      module: "customer",
      view: "Stories",
      targetType: "follow_request",
      url: buildNotificationUrl("Stories"),
    };
  }

  // Fallback
  return {
    module,
    view: "Notifications",
    url: buildNotificationUrl("Notifications"),
  };
}

/**
 * Executes navigation to the resolved notification target across platforms.
 * Handles logged out redirect to pending storage, message toasts, and query params.
 */
export function executeNotificationNavigation(
  route: NotificationRoute,
  navigate: (view: string) => void,
  isLoggedIn: boolean,
  showToast?: (type: "info" | "warning" | "error" | "success", msg: string) => void
): void {
  if (!isLoggedIn) {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("sheplates_pending_notification_url", route.url);
      } catch {}
    }
    if (showToast) {
      showToast("info", "Please sign in to view this update.");
    }
    return;
  }

  if (route.message && showToast) {
    if (route.accessDenied) {
      showToast("error", route.message);
    } else {
      showToast("info", route.message);
    }
  }

  if (typeof window !== "undefined") {
    window.history.pushState({ page: route.view }, "", route.url);
  }

  navigate(route.view);
}
