/**
 * The documents a vendor signs online. The fingerprint (SHA-256) of the exact file is stored with every signature, so it is always
 * provable which text was signed. When the wording changes, add a new version here and put the new PDF in public/docs: every vendor
 * is then asked to sign again.
 */
export type AgreementDocument = { id: "partnership_agreement" | "terms_conditions"; title: string; version: string; file: string; url: string };

export const AGREEMENT_DOCUMENTS: AgreementDocument[] = [
  { id: "partnership_agreement", title: "Vendor Partnership Agreement", version: "1.0", file: "sheplates-vendor-partnership-agreement-v1.0.pdf", url: "/docs/sheplates-vendor-partnership-agreement-v1.0.pdf" },
  { id: "terms_conditions", title: "Terms & Conditions", version: "1.0", file: "sheplates-vendor-terms-v1.0.pdf", url: "/docs/sheplates-vendor-terms-v1.0.pdf" },
];

export const CONSENT_TEXT = "I have read the Vendor Partnership Agreement and the Terms & Conditions. I agree to be bound by both, and I understand that typing my name, drawing my signature and entering the code sent to my email is my electronic signature under the Information Technology Act, 2000.";
export const OTP_MINUTES = 10;
export const OTP_MAX_TRIES = 5;
export const OTP_MAX_SENDS_PER_HOUR = 5;
export const SIGNATURE_MAX_BYTES = 200_000;

export function signatoryForSheplates(env: Record<string, string | undefined> = process.env) {
  return { name: env.SHEPLATES_SIGNATORY_NAME || "Authorised Signatory", title: env.SHEPLATES_SIGNATORY_TITLE || "Sheplates", mode: "auto" as const };
}
