/**
 * URUV AI Client
 * Unified, resilient integration for the URUV AI platform:
 * - /chat/completions (structured commerce reasoning, catalogue import, taste classification, multimodal vision)
 * - /images/generations (product image generation)
 * - /images/edits (truthful product image enhancement)
 * - /moderations (content moderation)
 *
 * Resilience & Guardrails:
 * - Never logs API keys (logs only status, error code, request ID)
 * - Retries provider 502/503 once before failing over
 * - Honors Retry-After headers on 429 rate limits
 * - Alerts admin for budget / credit / quota exhaustion errors (HTTP 402 / insufficient_quota)
 * - Clear, user-friendly messages for invalid or oversize (>10MB) images
 * - Preserves non-AI fallbacks across all calling surfaces
 */

export class UruvAiError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  retryAfter?: number;

  constructor(status: number, message: string, code?: string, requestId?: string, retryAfter?: number) {
    super(message);
    this.name = "UruvAiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }
}

export const uruvBaseUrl = () =>
  (process.env.AI_API_BASE || process.env.URUV_API_BASE || "https://api.uruv.ai/v1").replace(/\/$/, "");

export const uruvApiKey = () =>
  process.env.URUV_API_KEY || process.env.URV_API_KEY || process.env.AI_API_KEY || "";

export async function alertAdminBudgetCredit(err: { code?: string; requestId?: string; message?: string }) {
  // Always log structured error without any API keys
  console.error("[ADMIN ALERT: URUV AI Budget/Credit Exceeded]", {
    code: err.code || "insufficient_quota",
    requestId: err.requestId || "N/A",
    message: err.message || "URUV AI budget or credit limit reached.",
  });

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && service) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: adminProfiles } = await admin
        .from("profiles")
        .select("id")
        .in("role", ["admin", "operations"])
        .limit(10);

      if (adminProfiles?.length) {
        await admin.from("notifications").insert(
          adminProfiles.map((p) => ({
            recipient_id: p.id,
            kind: "ai_budget_alert",
            title: "URUV AI Budget / Credit Alert",
            body: `URUV AI credits or budget limit reached. Code: ${err.code || "insufficient_quota"}. Request ID: ${err.requestId || "N/A"}.`,
          }))
        );
      }
    }
  } catch {
    // Non-blocking: alert failure never masks the root cause
  }
}

export async function uruvFetch(path: string, init: RequestInit & { timeoutMs?: number }, isRetry = false): Promise<any> {
  const key = uruvApiKey();
  if (!key) {
    throw new UruvAiError(503, "URUV_API_KEY is not configured", "missing_api_key");
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${uruvBaseUrl()}${path}`, {
      ...init,
      headers: { ...headers, ...((init.headers as Record<string, string>) || {}) },
      signal: init.signal ?? AbortSignal.timeout(init.timeoutMs ?? 60_000),
    });
  } catch (netErr: any) {
    if (!isRetry && (netErr.name === "TimeoutError" || netErr.name === "AbortError" || netErr.code === "ECONNRESET")) {
      console.warn(`[URUV AI Network Retry] ${netErr.message || "Network glitch"}, retrying once...`);
      return uruvFetch(path, init, true);
    }
    console.error("[URUV AI Network Error]", { error: netErr.message, path });
    throw new UruvAiError(504, "URUV AI service timeout or network error", "network_error");
  }

  // Handle 502/503: retry once, then fall back
  if ((res.status === 502 || res.status === 503) && !isRetry) {
    console.warn(`[URUV AI ${res.status}] Retrying provider 502/503 once before falling back...`, { path });
    await new Promise((r) => setTimeout(r, 400));
    return uruvFetch(path, init, true);
  }

  // Handle 429 Rate Limit: honor Retry-After
  if (res.status === 429 && !isRetry) {
    const retryHeader = res.headers.get("retry-after");
    const delaySec = retryHeader ? Number(retryHeader) : NaN;
    if (Number.isFinite(delaySec) && delaySec > 0 && delaySec <= 2) {
      console.warn(`[URUV AI 429 Rate Limit] Honoring Retry-After: waiting ${delaySec}s before retrying...`);
      await new Promise((r) => setTimeout(r, delaySec * 1000));
      return uruvFetch(path, init, true);
    }
  }

  const data: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    const code = data?.error?.code || (res.status === 429 ? "rate_limit_exceeded" : res.status === 402 ? "insufficient_quota" : undefined);
    const requestId = data?.error?.request_id || res.headers.get("x-request-id") || undefined;
    const retryAfter = res.headers.get("retry-after") ? Number(res.headers.get("retry-after")) : undefined;

    // Log error code and request ID, NEVER the API key
    console.error("[URUV AI Error]", {
      status: res.status,
      code,
      requestId,
      message: data?.error?.message,
    });

    // Alert admin for budget / credit errors
    if (res.status === 402 || code === "insufficient_quota" || code === "budget_exceeded" || code === "credit_exhausted" || /quota|credit|balance|budget/i.test(data?.error?.message || "")) {
      void alertAdminBudgetCredit({ code, requestId, message: data?.error?.message });
    }

    // Friendly messages for bad image / oversize
    let message = data?.error?.message || `URUV AI request failed with ${res.status}`;
    if (res.status === 413 || /file too large|image too large|size exceeds/i.test(message)) {
      message = "Image must be under 10 MB. Please upload a smaller photo.";
    } else if (res.status === 400 && /image|format|corrupt|unsupported/i.test(message)) {
      message = "The image could not be processed. Please upload a clear JPEG, PNG, or WebP photo under 10 MB.";
    }

    throw new UruvAiError(res.status, message, code, requestId, retryAfter);
  }

  return data;
}

export const uruvChat = (body: Record<string, unknown>, opts: { timeoutMs?: number; signal?: AbortSignal } = {}) =>
  uruvFetch("/chat/completions", { method: "POST", body: JSON.stringify(body), ...opts });

export const uruvImage = (body: Record<string, unknown>, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}) => {
  if (opts.fetchImpl) {
    // Allows custom fetch override in tests
    return opts.fetchImpl(`${uruvBaseUrl()}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${uruvApiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return uruvFetch("/images/generations", { method: "POST", body: JSON.stringify(body), timeoutMs: opts.timeoutMs ?? 180_000 });
};

export const uruvImageEdit = (form: FormData, opts: { timeoutMs?: number } = {}) =>
  uruvFetch("/images/edits", { method: "POST", body: form, timeoutMs: opts.timeoutMs ?? 180_000 });

export const uruvModerate = (input: unknown, opts: { fetchImpl?: typeof fetch } = {}) => {
  if (opts.fetchImpl) {
    return opts.fetchImpl(`${uruvBaseUrl()}/moderations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${uruvApiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.AI_MODERATION_MODEL || process.env.URUV_MODERATION_MODEL || "uruv-moderate", input }),
    });
  }
  return uruvFetch("/moderations", {
    method: "POST",
    body: JSON.stringify({ model: process.env.AI_MODERATION_MODEL || process.env.URUV_MODERATION_MODEL || "uruv-moderate", input }),
  });
};
