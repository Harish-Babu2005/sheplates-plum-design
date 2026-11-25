import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_DIGITS = 6;
export const MAX_ATTEMPTS = 5;

/**
 * Generates a random 6-digit verification code (e.g., "048291").
 * Matches Food Drops and Third-party delivery.
 */
export function generateOrderVerificationCode() {
  return randomInt(0, 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, "0");
}

/**
 * Computes an HMAC-SHA256 hex digest for an order and code.
 * Ensures the code is verified in constant time without storing plain text.
 */
export function hashOrderVerificationCode(orderId, code, secret) {
  if (!orderId || !code || !secret) {
    throw new Error("orderId, code, and secret are required to generate verification hash.");
  }
  return createHmac("sha256", secret).update(`${orderId}:${String(code).trim()}`).digest("hex");
}

/**
 * Encrypts the 6-digit code with AES-256-GCM using the server secret and orderId as AAD.
 * Stored in database so only customer-authenticated API calls can decrypt and view it.
 */
export function encryptOrderVerificationCode(orderId, code, secret) {
  if (!orderId || !code || !secret) {
    throw new Error("orderId, code, and secret are required for encryption.");
  }
  const key = createHash("sha256").update(`${secret}:order-verification-encryption`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(String(orderId), "utf8"));
  let encrypted = cipher.update(String(code).trim(), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts the 6-digit code. Fails safely if corrupted or unauthorized.
 */
export function decryptOrderVerificationCode(orderId, encryptedData, secret) {
  if (!orderId || !encryptedData || !secret) return null;
  try {
    const parts = String(encryptedData).split(":");
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, encHex] = parts;
    const key = createHash("sha256").update(`${secret}:order-verification-encryption`).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAAD(Buffer.from(String(orderId), "utf8"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    let decrypted = decipher.update(encHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return /^\d{6}$/.test(decrypted) ? decrypted : null;
  } catch {
    return null;
  }
}

/**
 * Timing-safe comparison of verification code against expected HMAC hash.
 */
export function verifyOrderVerificationCode(orderId, code, expectedHash, secret) {
  if (!code || typeof code !== "string" || !/^\d{6}$/.test(code.trim())) return false;
  if (!expectedHash || typeof expectedHash !== "string" || !/^[a-f\d]{64}$/i.test(expectedHash)) return false;
  if (!secret) return false;

  const actual = Buffer.from(hashOrderVerificationCode(orderId, code.trim(), secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Helper to get user-facing instruction label for customer view.
 */
export function getCustomerCodeLabel(fulfilmentMode) {
  const mode = String(fulfilmentMode || "").toLowerCase();
  if (mode.includes("pickup") || mode === "self_pickup") {
    return "Show this code at the store";
  }
  return "Share this code only when you receive your order";
}

/**
 * Determines whether the verification code should be displayed to the customer
 * based on order status and fulfilment mode.
 */
export function isCodeVisibleToCustomer(status, fulfilmentMode) {
  const normStatus = String(status || "").toLowerCase().replace(/[ -]+/g, "_");
  const normMode = String(fulfilmentMode || "").toLowerCase();

  if (["completed", "delivered", "cancelled", "payment_failed", "expired"].includes(normStatus)) {
    return false;
  }

  if (normMode.includes("pickup") || modeIsPickup(normMode)) {
    // Pickup orders show code when ready for pickup (or confirmed)
    return normStatus === "ready_for_pickup" || normStatus === "ready" || normStatus === "confirmed";
  }

  // Delivery orders show code when out for delivery
  return normStatus === "out_for_delivery" || normStatus === "ready";
}

function modeIsPickup(mode) {
  return mode === "self_pickup" || mode === "pickup" || mode === "pickup_from_store";
}
