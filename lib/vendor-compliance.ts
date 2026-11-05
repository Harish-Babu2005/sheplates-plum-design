/**
 * Vendor onboarding compliance documents: which documents exist, what each one asks for, and the checks that run
 * before anything is uploaded. Pure (no network, no React), so the rules are easy to test.
 *
 * Only the Food Safety Certificate (FSSAI) is mandatory. The other six are optional but Operations may ask for them.
 * Every document must be a PDF. The numbers a vendor types (PAN, bank account, registration) are stored with the
 * document in vendor_documents, which only the vendor and Operations/Super Admin can read, never on the public vendor row.
 */

export type VendorComplianceDocType = "food_certificate" | "pan" | "government_id" | "address_proof" | "bank_details" | "business_details" | "product_information";
export type OptionalComplianceKey = Exclude<VendorComplianceDocType, "food_certificate">;

export type VendorComplianceDocument = {
  id?: string;
  documentType: VendorComplianceDocType;
  title: string;
  documentNumber?: string;
  fileName?: string;
  fileSize?: number;
  storagePath?: string;
  expiryDate?: string;
  verificationStatus?: string;
  metadata?: Record<string, unknown>;
};

export const VENDOR_TERMS_VERSION = "1.0";
export const VENDOR_TERMS_PDF = "/docs/sheplates-vendor-terms-v1.0.pdf";
export const VENDOR_TERMS_EFFECTIVE = "7 October 2026";
export const MAX_COMPLIANCE_PDF_BYTES = 15 * 1024 * 1024;

export const GOV_ID_TYPES = ["Aadhaar Card", "Voter ID", "Passport", "Driving License"] as const;
export const ADDRESS_PROOF_TYPES = ["Electricity Bill", "Water Bill", "Rent Agreement", "Property Tax Receipt", "Aadhaar Card"] as const;
export const BUSINESS_REG_TYPES = ["GSTIN Certificate", "Udyam / MSME Registration", "Shop & Establishment Act", "Trade License", "Partnership Deed / Incorporation"] as const;

export type ComplianceFields = {
  panNumber: string;
  govIdType: string; govIdNumber: string;
  addressProofType: string; addressProofRef: string;
  bankName: string; bankAccountNumber: string; bankIfsc: string;
  businessRegType: string; businessRegNumber: string;
  productInfoTitle: string;
};

export const EMPTY_COMPLIANCE_FIELDS: ComplianceFields = {
  panNumber: "", govIdType: GOV_ID_TYPES[0], govIdNumber: "", addressProofType: ADDRESS_PROOF_TYPES[0], addressProofRef: "",
  bankName: "", bankAccountNumber: "", bankIfsc: "", businessRegType: BUSINESS_REG_TYPES[0], businessRegNumber: "", productInfoTitle: "",
};

export const COMPLIANCE_DOCS: Array<{ key: OptionalComplianceKey; order: number; title: string; short: string; hint: string; inputId: string; uploadLabel: string }> = [
  { key: "pan", order: 1, title: "PAN Card", short: "PAN Card", hint: "Permanent Account Number card of the proprietor or business", inputId: "pan-file-input", uploadLabel: "Upload PAN PDF" },
  { key: "government_id", order: 2, title: "Government Identity Proof", short: "Govt ID", hint: "Official government issued identity card", inputId: "govid-file-input", uploadLabel: "Upload ID PDF" },
  { key: "address_proof", order: 3, title: "Address Proof", short: "Address Proof", hint: "Utility bill, rent agreement or property tax receipt", inputId: "addressproof-file-input", uploadLabel: "Upload address proof PDF" },
  { key: "bank_details", order: 4, title: "Bank Details (Cheque / Passbook)", short: "Bank Details", hint: "Bank account and cancelled cheque or passbook, used for payouts", inputId: "bank-file-input", uploadLabel: "Upload bank proof PDF" },
  { key: "business_details", order: 5, title: "Business Details (GSTIN / MSME)", short: "Business Reg", hint: "GST certificate, MSME Udyam, Shop & Establishment or trade licence", inputId: "business-file-input", uploadLabel: "Upload registration PDF" },
  { key: "product_information", order: 6, title: "Product Information / Catalogue", short: "Product Info", hint: "Menu, product descriptions or a pricing sheet", inputId: "productinfo-file-input", uploadLabel: "Upload catalogue PDF" },
];

export function isPdfFile(file: Pick<File, "name" | "type">): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/** The message to show when a file cannot be used, or null when it is fine. */
export function pdfProblem(file: Pick<File, "name" | "type" | "size">, label: string): string | null {
  if (!isPdfFile(file)) return `"${file.name}" is not a PDF. ${label} must be in PDF format (.pdf) only.`;
  if (file.size <= 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_COMPLIANCE_PDF_BYTES) return `"${file.name}" is larger than 15 MB.`;
  return null;
}

export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const BANK_ACCOUNT_PATTERN = /^\d{9,18}$/;

/** Format checks for whatever the vendor typed. Empty values are fine because these fields are optional. */
export function complianceFieldProblems(fields: ComplianceFields): string[] {
  const problems: string[] = [];
  const pan = fields.panNumber.trim().toUpperCase();
  if (pan && !PAN_PATTERN.test(pan)) problems.push("PAN must be 10 characters like ABCDE1234F.");
  const ifsc = fields.bankIfsc.trim().toUpperCase();
  if (ifsc && !IFSC_PATTERN.test(ifsc)) problems.push("IFSC must be 11 characters like HDFC0001234.");
  const account = fields.bankAccountNumber.replace(/\s+/g, "");
  if (account && !BANK_ACCOUNT_PATTERN.test(account)) problems.push("Bank account number must be 9 to 18 digits.");
  if ((account && !ifsc) || (!account && ifsc)) problems.push("Enter both the bank account number and the IFSC code.");
  return problems;
}

/** What is stored as the document's number and extra details, per document. Returns nothing the vendor did not type. */
export function documentEntry(key: OptionalComplianceKey, fields: ComplianceFields): { documentNumber?: string; metadata?: Record<string, unknown>; title: string } {
  const clean = (value: string) => value.trim() || undefined;
  switch (key) {
    case "pan": return { title: "PAN Card", documentNumber: clean(fields.panNumber.toUpperCase()) };
    case "government_id": return { title: `Government ID (${fields.govIdType})`, documentNumber: clean(fields.govIdNumber), metadata: { idType: fields.govIdType } };
    case "address_proof": return { title: `Address Proof (${fields.addressProofType})`, documentNumber: clean(fields.addressProofRef), metadata: { proofType: fields.addressProofType } };
    case "bank_details": {
      const account = fields.bankAccountNumber.replace(/\s+/g, "");
      return {
        title: "Bank Details (Cheque / Passbook)",
        documentNumber: account ? `A/C ${account} · ${fields.bankIfsc.trim().toUpperCase()}` : undefined,
        metadata: { bankName: clean(fields.bankName) ?? null, ifsc: clean(fields.bankIfsc.toUpperCase()) ?? null },
      };
    }
    case "business_details": return { title: `Business Details (${fields.businessRegType})`, documentNumber: clean(fields.businessRegNumber), metadata: { regType: fields.businessRegType } };
    case "product_information": return { title: "Product Information / Catalogue", documentNumber: clean(fields.productInfoTitle) };
  }
}

/** A title for a stored document, for lists that only have its type and number. */
export function documentTitle(type: string, metadata?: Record<string, unknown>): string {
  const detail = (key: string) => (typeof metadata?.[key] === "string" ? ` (${metadata[key] as string})` : "");
  switch (type) {
    case "food_certificate": return "Food Safety Certificate (FSSAI)";
    case "pan": return "PAN Card";
    case "government_id": return `Government ID${detail("idType")}`;
    case "address_proof": return `Address Proof${detail("proofType")}`;
    case "bank_details": return "Bank Details (Cheque / Passbook)";
    case "business_details": return `Business Details${detail("regType")}`;
    case "product_information": return "Product Information / Catalogue";
    default: return type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }
}

/** Hides all but the last four characters, for places that only need to recognise a number. */
export function maskNumber(value: string | undefined): string {
  if (!value) return "";
  const text = value.trim();
  return text.length <= 4 ? text : `${"•".repeat(Math.min(8, text.length - 4))}${text.slice(-4)}`;
}
