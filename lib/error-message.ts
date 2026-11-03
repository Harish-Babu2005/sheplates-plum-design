/** Readable text for anything a catch block can receive. Supabase errors are plain objects, not Error instances. */
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const { message, details, hint } = error as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [message, details, hint].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length) return parts.join(" · ");
  }
  return fallback;
}
