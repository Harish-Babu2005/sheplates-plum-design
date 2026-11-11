import 'server-only';

const base = () => (process.env.AI_API_BASE || process.env.URUV_API_BASE || 'https://api.uruv.ai/v1').replace(/\/$/, '');

async function uruvFetch(path: string, init: RequestInit & { timeoutMs?: number }) {
  const key = process.env.URUV_API_KEY || process.env.URV_API_KEY;
  if (!key) throw new Error('URUV_API_KEY is not configured');

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(init.timeoutMs ?? 60_000),
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e: any = new Error(data?.error?.message || `URUV AI error ${res.status}`);
    e.status = res.status;
    e.code = data?.error?.code;
    e.requestId = data?.error?.request_id || res.headers.get('x-request-id');
    throw e;
  }

  return data;
}

export const uruvChat = (body: Record<string, unknown>, opts: { timeoutMs?: number; signal?: AbortSignal } = {}) =>
  uruvFetch('/chat/completions', { method: 'POST', body: JSON.stringify(body), ...opts });

export const uruvImage = (body: Record<string, unknown>, opts: { timeoutMs?: number } = {}) =>
  uruvFetch('/images/generations', { method: 'POST', body: JSON.stringify(body), timeoutMs: opts.timeoutMs ?? 180_000 });

export const uruvImageEdit = (form: FormData, opts: { timeoutMs?: number } = {}) =>
  uruvFetch('/images/edits', { method: 'POST', body: form, timeoutMs: opts.timeoutMs ?? 180_000 });

export const uruvModerate = (input: unknown) =>
  uruvFetch('/moderations', { method: 'POST', body: JSON.stringify({ model: process.env.AI_MODERATION_MODEL || 'uruv-moderate', input }) });
