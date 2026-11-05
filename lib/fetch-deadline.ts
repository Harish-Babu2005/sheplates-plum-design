/** fetch() that gives up after `ms` milliseconds, so a slow server ends in an error message instead of a spinner that never stops. */
export class DeadlineError extends Error {
  constructor(message = "This is taking longer than expected. Please try again.") { super(message); this.name = "DeadlineError"; }
}

export async function fetchWithDeadline(input: RequestInfo | URL, init: RequestInit = {}, ms = 60000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const outer = init.signal;
  if (outer) { if (outer.aborted) controller.abort(); else outer.addEventListener("abort", () => controller.abort(), { once: true }); }
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  catch (error) {
    if (controller.signal.aborted && !outer?.aborted) throw new DeadlineError();
    throw error;
  }
  finally { clearTimeout(timer); }
}
