export const PRODUCT_DESCRIPTION_MAX_LENGTH = 200;

/**
 * Strips HTML tags and script/style contents from description text,
 * while preserving Tamil, Unicode characters, emojis, punctuation, commas and newlines.
 */
export function sanitizeProductDescription(input: string | null | undefined): string {
  if (!input) return "";

  // 1. Remove script and style elements with content
  let text = String(input)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // 2. Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // 3. Decode common basic HTML entities safely
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Re-strip if entity decoding produced any new tags
  text = text.replace(/<[^>]+>/g, "");

  // 4. Normalize CRLF to LF, trim surrounding whitespace
  text = text.replace(/\r\n/g, "\n").trim();

  // 5. Clamp to maximum character length
  if (text.length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
    text = text.slice(0, PRODUCT_DESCRIPTION_MAX_LENGTH);
  }

  return text;
}

/**
 * Validates product description against max length and schema rules.
 */
export function validateProductDescription(input: string | null | undefined): {
  valid: boolean;
  error?: string;
  sanitized: string;
} {
  if (!input) {
    return { valid: true, sanitized: "" };
  }

  const raw = String(input);
  if (raw.length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
    return {
      valid: false,
      error: `Description must be ${PRODUCT_DESCRIPTION_MAX_LENGTH} characters or fewer (currently ${raw.length}).`,
      sanitized: sanitizeProductDescription(raw),
    };
  }

  const sanitized = sanitizeProductDescription(raw);
  return { valid: true, sanitized };
}
