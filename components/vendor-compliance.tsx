"use client";
// Vendor onboarding, step 4: the Food Safety Certificate, six optional compliance documents (PDF only), and the Terms &
// Conditions with a built-in viewer. Also exports the viewer and a PDF preview so the vendor's Verification page can reuse them.
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Eye, FileText, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";
import { signedVendorDocumentUrl } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ADDRESS_PROOF_TYPES, BUSINESS_REG_TYPES, COMPLIANCE_DOCS, GOV_ID_TYPES, VENDOR_TERMS_EFFECTIVE, VENDOR_TERMS_PDF, VENDOR_TERMS_VERSION,
  pdfProblem, type ComplianceFields, type OptionalComplianceKey, type VendorComplianceDocument,
} from "@/lib/vendor-compliance";

const fieldInput = "h-11 w-full min-w-0 rounded-xl border border-stone-200 bg-white px-3.5 text-sm outline-none focus:border-[#155F65] focus:ring-2 focus:ring-[#155F65]/10";

function Labelled({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return <div className="min-w-0"><label htmlFor={htmlFor} className="mb-1.5 block text-xs font-black uppercase tracking-[.12em] text-stone-500">{label}</label>{children}</div>;
}

/** Shows a PDF held in the browser (an upload the vendor just chose) or one with a web address. */
export function PdfPreviewDialog({ doc, onClose }: { doc: { title: string; fileName: string; url: string } | null; onClose: () => void }) {
  return <Dialog open={Boolean(doc)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[94vh] w-[95vw] max-w-4xl overflow-hidden rounded-[28px] p-0 sm:max-w-4xl">
      <div className="flex h-[85vh] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-4 pr-14">
          <div className="min-w-0"><DialogTitle className="truncate text-lg font-black text-[#202827]">{doc?.title || "Document preview"}</DialogTitle><DialogDescription className="truncate font-mono text-xs text-stone-500">{doc?.fileName || "document.pdf"}</DialogDescription></div>
          {doc?.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-bold text-[#202827] hover:bg-stone-50"><ExternalLink className="size-3.5 text-[#155F65]" />Open in new tab</a>}
        </div>
        <div className="min-h-0 flex-1 bg-stone-100">{doc?.url ? <iframe src={`${doc.url}#toolbar=1&navpanes=0`} title={doc.title || "PDF document"} className="h-full w-full border-0" /> : <div className="grid h-full place-items-center p-8 text-center"><div><FileText className="mx-auto size-14 text-red-500" /><p className="mt-3 font-black text-[#202827]">{doc?.title}</p><p className="mx-auto mt-2 max-w-sm text-sm text-stone-600">Uploaded files are kept on the live site only. In the live app this opens the vendor’s PDF here.</p></div></div>}</div>
      </div>
    </DialogContent>
  </Dialog>;
}

/** The Vendor Terms & Conditions PDF, readable before accepting. `onAccept` adds an "Accept & close" button. */
export function TermsViewerDialog({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept?: () => void }) {
  return <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
    <DialogContent data-testid="terms-viewer" className="max-h-[94vh] w-[95vw] max-w-4xl overflow-hidden rounded-[28px] p-0 sm:max-w-4xl">
      <div className="flex h-[85vh] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-4 pr-14">
          <div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF4F2] text-[#155F65]"><FileText className="size-5" /></div>
            <div className="min-w-0"><DialogTitle className="text-lg font-black text-[#202827]">ShePlates Vendor Terms & Conditions</DialogTitle><DialogDescription className="text-xs text-stone-500">Version {VENDOR_TERMS_VERSION} · Effective Date: {VENDOR_TERMS_EFFECTIVE}</DialogDescription></div></div>
          <a href={VENDOR_TERMS_PDF} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-bold text-[#202827] hover:bg-stone-50"><ExternalLink className="size-3.5 text-[#155F65]" />Open in new tab</a>
        </div>
        <div className="min-h-0 flex-1 bg-stone-100"><iframe src={`${VENDOR_TERMS_PDF}#toolbar=1&navpanes=0`} title="ShePlates Vendor Terms & Conditions" className="h-full w-full border-0" /></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 bg-white px-5 py-3">
          <span className="text-xs text-stone-500">Document: <span className="font-mono text-[11px]">sheplates-vendor-terms-v1.0.pdf</span></span>
          <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-xl font-bold">Close</Button>
            {onAccept && <Button type="button" size="sm" onClick={onAccept} className="rounded-xl bg-[#155F65] font-bold text-white hover:bg-[#0F4A4F]"><Check className="size-4" />Accept &amp; close</Button>}</div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

type UploadProps = { inputId: string; label: string; file: File | null; setFile: (file: File | null) => void; uploadLabel: string; onPreview: (file: File, title: string) => void; previewTitle: string };

function PdfUpload({ inputId, label, file, setFile, uploadLabel, onPreview, previewTitle }: UploadProps) {
  function choose(next: File | null) {
    if (!next) return;
    const problem = pdfProblem(next, label);
    if (problem) return void toast.error(problem);
    setFile(next);
    toast.success(`${label} attached in PDF format`);
  }
  if (file) return <div className="flex items-center justify-between gap-2 rounded-xl border border-[#C5E3E4] bg-[#EAF4F2] p-3">
    <div className="flex min-w-0 items-center gap-2"><span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-red-700">PDF</span><span className="truncate text-xs font-bold text-[#202827]">{file.name}</span><span className="shrink-0 font-mono text-[10px] text-stone-500">({(file.size / 1024).toFixed(1)} KB)</span></div>
    <div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={`Preview ${file.name}`} onClick={() => onPreview(file, previewTitle)} className="grid size-8 place-items-center rounded-lg text-stone-600 hover:bg-white"><Eye className="size-4" /></button><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFile(null)} className="grid size-8 place-items-center rounded-lg text-red-600 hover:bg-white"><Trash2 className="size-4" /></button></div>
  </div>;
  return <label htmlFor={inputId} className="grid min-h-20 cursor-pointer place-items-center rounded-xl border border-dashed border-stone-300 bg-white p-3 text-center transition hover:border-[#155F65]">
    <input id={inputId} type="file" accept=".pdf,application/pdf" className="sr-only" onChange={(event) => { choose(event.target.files?.[0] || null); event.target.value = ""; }} />
    <span className="flex items-center gap-1.5 text-xs font-bold text-stone-700"><Upload className="size-3.5 text-stone-400" />{uploadLabel}</span>
  </label>;
}

export type ComplianceStepProps = {
  fssai: string; setFssai: (value: string) => void;
  expiry: string; setExpiry: (value: string) => void; minExpiry: string;
  certificate: File | null; setCertificate: (file: File | null) => void;
  fields: ComplianceFields; setField: <K extends keyof ComplianceFields>(key: K, value: ComplianceFields[K]) => void;
  files: Partial<Record<OptionalComplianceKey, File | null>>; setFile: (key: OptionalComplianceKey, file: File | null) => void;
  termsAccepted: boolean; setTermsAccepted: (value: boolean) => void;
};

export function ComplianceStep(p: ComplianceStepProps) {
  const [preview, setPreview] = useState<{ title: string; fileName: string; url: string } | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [activeDocKey, setActiveDocKey] = useState<OptionalComplianceKey>("pan");
  useEffect(() => () => { if (preview?.url.startsWith("blob:")) URL.revokeObjectURL(preview.url); }, [preview]);
  const openPreview = (file: File, title: string) => setPreview({ title, fileName: file.name, url: URL.createObjectURL(file) });
  const uploaded = COMPLIANCE_DOCS.filter((doc) => p.files[doc.key]).length;

  const select = (id: string, value: string, options: readonly string[], onChange: (value: string) => void) => <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldInput}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  const text = (id: string, value: string, onChange: (value: string) => void, placeholder: string, extra?: { maxLength?: number; inputMode?: "numeric" | "text" }) => <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={extra?.maxLength} inputMode={extra?.inputMode} className={fieldInput} />;

  const body: Record<OptionalComplianceKey, ReactNode> = {
    pan: <Labelled label="PAN Number" htmlFor="pan-number-input">{text("pan-number-input", p.fields.panNumber, (v) => p.setField("panNumber", v.toUpperCase()), "ABCDE1234F", { maxLength: 10 })}</Labelled>,
    government_id: <div className="grid gap-3 sm:grid-cols-2"><Labelled label="ID Type" htmlFor="govid-type-input">{select("govid-type-input", p.fields.govIdType, GOV_ID_TYPES, (v) => p.setField("govIdType", v))}</Labelled><Labelled label="ID Number" htmlFor="govid-number-input">{text("govid-number-input", p.fields.govIdNumber, (v) => p.setField("govIdNumber", v), "e.g. 1234 5678 9012")}</Labelled></div>,
    address_proof: <div className="grid gap-3 sm:grid-cols-2"><Labelled label="Document Type" htmlFor="addressproof-type-input">{select("addressproof-type-input", p.fields.addressProofType, ADDRESS_PROOF_TYPES, (v) => p.setField("addressProofType", v))}</Labelled><Labelled label="Bill / Doc Ref" htmlFor="addressproof-ref-input">{text("addressproof-ref-input", p.fields.addressProofRef, (v) => p.setField("addressProofRef", v), "Optional reference #")}</Labelled></div>,
    bank_details: <div className="grid gap-3 sm:grid-cols-2"><Labelled label="Bank Name" htmlFor="bank-name-input">{text("bank-name-input", p.fields.bankName, (v) => p.setField("bankName", v), "e.g. HDFC Bank")}</Labelled><Labelled label="Account Number" htmlFor="bank-account-input">{text("bank-account-input", p.fields.bankAccountNumber, (v) => p.setField("bankAccountNumber", v.replace(/[^\d ]/g, "")), "Bank Account Number", { inputMode: "numeric", maxLength: 22 })}</Labelled><Labelled label="IFSC Code" htmlFor="bank-ifsc-input">{text("bank-ifsc-input", p.fields.bankIfsc, (v) => p.setField("bankIfsc", v.toUpperCase()), "e.g. HDFC0001234", { maxLength: 11 })}</Labelled></div>,
    business_details: <div className="grid gap-3 sm:grid-cols-2"><Labelled label="Registration Type" htmlFor="business-type-input">{select("business-type-input", p.fields.businessRegType, BUSINESS_REG_TYPES, (v) => p.setField("businessRegType", v))}</Labelled><Labelled label="Reg Number / GSTIN" htmlFor="business-reg-input">{text("business-reg-input", p.fields.businessRegNumber, (v) => p.setField("businessRegNumber", v.toUpperCase()), "Registration Number")}</Labelled></div>,
    product_information: <Labelled label="Catalogue / Menu Name" htmlFor="productinfo-title-input">{text("productinfo-title-input", p.fields.productInfoTitle, (v) => p.setField("productInfoTitle", v), "e.g. Signature Meals & Daily Specials Menu")}</Labelled>,
  };

  return <div className="mt-7 space-y-6">
    <div className="flex items-start gap-3 rounded-2xl border border-[#C5E3E4] bg-[#EAF4F2] p-4 text-xs font-semibold text-[#202827]">
      <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-[#155F65]"><FileText className="size-4" /></div>
      <div><p className="font-bold">Strict Document Format Requirement: PDF Only</p><p className="font-normal text-[#55656A]">All onboarding certificates and proofs must be uploaded as a PDF (.pdf). Save scanned images or photos as a PDF first. Documents are private: only you and ShePlates Operations can open them.</p></div>
    </div>

    <section aria-label="Food Safety Certificate" className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2"><div className="grid size-8 place-items-center rounded-lg bg-[#EAF4F2] text-[#155F65]"><ShieldCheck className="size-4" /></div><div><h3 className="text-sm font-black text-[#202827]">Food Safety Certificate (FSSAI)</h3><p className="text-xs text-stone-500">Government food hygiene and licence certificate</p></div></div>
        <div className="flex items-center gap-1.5"><span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-black text-red-700">Required</span><span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">PDF only</span></div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Labelled label="Food certificate / FSSAI number" htmlFor="fssai-number-input">{text("fssai-number-input", p.fssai, p.setFssai, "14-digit FSSAI Licence Number")}</Labelled>
        <Labelled label="Expiry date" htmlFor="fssai-expiry-input"><input id="fssai-expiry-input" type="date" min={p.minExpiry} value={p.expiry} onChange={(event) => p.setExpiry(event.target.value)} className={fieldInput} /></Labelled>
        <div className="md:col-span-2"><PdfUpload inputId="fssai-file-input" label="Food Safety Certificate" file={p.certificate} setFile={p.setCertificate} uploadLabel="Upload FSSAI certificate PDF" onPreview={openPreview} previewTitle="Food Safety Certificate (FSSAI)" /></div>
      </div>
    </section>

    <section aria-label="Other compliance documents" className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-stone-100 pb-3">
        <div>
          <h3 className="text-sm font-black text-[#202827]">
            Other documents <span className="font-semibold text-stone-500">(optional now, Operations may ask for them)</span>
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">Select a document from the dropdown below to fill details and attach your PDF.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#EAF4F2] px-3 py-1 text-xs font-bold text-[#155F65]">
            {uploaded} of {COMPLIANCE_DOCS.length} attached
          </span>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl bg-[#F7FAFA] p-4 border border-stone-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="compliance-doc-select" className="mb-1 block text-xs font-black uppercase tracking-[.12em] text-stone-600">
              Select Document to Fill &amp; Upload
            </label>
            <div className="relative">
              <select
                id="compliance-doc-select"
                aria-label="Select document to upload"
                value={activeDocKey}
                onChange={(e) => setActiveDocKey(e.target.value as OptionalComplianceKey)}
                className="h-11 w-full rounded-xl border border-stone-300 bg-white px-3.5 pr-8 text-sm font-bold text-[#202827] outline-none transition focus:border-[#155F65] focus:ring-2 focus:ring-[#155F65]/10"
              >
                {COMPLIANCE_DOCS.map((doc) => {
                  const hasFile = Boolean(p.files[doc.key]);
                  return (
                    <option key={doc.key} value={doc.key}>
                      {doc.order}. {doc.title} {hasFile ? "✓ (Attached)" : "— (Optional)"}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1 md:pt-4">
            {COMPLIANCE_DOCS.map((doc) => {
              const isSelected = activeDocKey === doc.key;
              const hasFile = Boolean(p.files[doc.key]);
              return (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => setActiveDocKey(doc.key)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${
                    isSelected
                      ? "bg-[#155F65] text-white shadow-sm"
                      : hasFile
                      ? "bg-[#EAF4F2] text-[#155F65] border border-[#C5E3E4]"
                      : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  <span>{doc.short}</span>
                  {hasFile && <Check className="size-3 text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {COMPLIANCE_DOCS.map((doc, idx) => {
            const isActive = doc.key === activeDocKey;
            const prevDoc = idx > 0 ? COMPLIANCE_DOCS[idx - 1] : null;
            const nextDoc = idx < COMPLIANCE_DOCS.length - 1 ? COMPLIANCE_DOCS[idx + 1] : null;

            return (
              <article
                key={doc.key}
                data-doc={doc.key}
                className={isActive ? "min-w-0 space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" : "hidden"}
              >
                <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#155F65] text-xs font-black text-white">
                      {doc.order}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-[#202827]">{doc.title}</h4>
                        {p.files[doc.key] && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <Check className="size-3" /> Attached
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">{doc.hint}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold text-stone-700">
                    PDF only
                  </span>
                </div>

                {body[doc.key]}

                <div className="pt-1">
                  <PdfUpload
                    inputId={doc.inputId}
                    label={doc.title}
                    file={p.files[doc.key] ?? null}
                    setFile={(file) => p.setFile(doc.key, file)}
                    uploadLabel={doc.uploadLabel}
                    onPreview={openPreview}
                    previewTitle={doc.title}
                  />
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
                  {prevDoc ? (
                    <button
                      type="button"
                      onClick={() => setActiveDocKey(prevDoc.key)}
                      className="inline-flex items-center gap-1 font-bold text-stone-600 hover:text-[#155F65]"
                    >
                      <ChevronLeft className="size-3.5" /> Previous: {prevDoc.short}
                    </button>
                  ) : <span />}
                  {nextDoc && (
                    <button
                      type="button"
                      onClick={() => setActiveDocKey(nextDoc.key)}
                      className="inline-flex items-center gap-1 font-bold text-[#155F65] hover:underline"
                    >
                      Next: {nextDoc.short} <ChevronRight className="size-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>

    <section aria-label="Terms and Conditions" className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><div className="flex items-center gap-2"><h3 className="text-base font-black text-[#202827]">Terms &amp; Conditions</h3><span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] font-bold text-stone-700">Version {VENDOR_TERMS_VERSION}</span></div><p className="mt-1 text-xs text-stone-500">Review the ShePlates Vendor Terms &amp; Conditions before completing onboarding.</p></div>
        <Button type="button" variant="outline" size="sm" onClick={() => setTermsOpen(true)} className="shrink-0 rounded-xl border-stone-300 bg-white font-bold"><FileText className="size-4 text-[#155F65]" />View Terms &amp; Conditions</Button>
      </div>
      <div className="mt-4 flex items-start gap-3 border-t border-stone-200 pt-4">
        <input type="checkbox" id="vendor-terms-checkbox" checked={p.termsAccepted} onChange={(event) => p.setTermsAccepted(event.target.checked)} className="mt-1 size-5 shrink-0 cursor-pointer rounded accent-[#155F65]" />
        <label htmlFor="vendor-terms-checkbox" className="cursor-pointer select-none text-sm font-medium leading-relaxed text-[#202827]">I have read and agree to the <button type="button" onClick={(event) => { event.preventDefault(); setTermsOpen(true); }} className="font-bold text-[#155F65] underline hover:text-[#0F4A4F]">ShePlates Vendor Terms &amp; Conditions</button>. I understand my application is reviewed by Operations before my store goes live.</label>
      </div>
    </section>

    <PdfPreviewDialog doc={preview} onClose={() => setPreview(null)} />
    <TermsViewerDialog open={termsOpen} onClose={() => setTermsOpen(false)} onAccept={() => { p.setTermsAccepted(true); setTermsOpen(false); toast.success("Terms & Conditions accepted"); }} />
  </div>;
}

/** Operations / Super Admin: the documents a vendor submitted, each openable as a real PDF (a short-lived private link). */
export function ComplianceDocumentList({ vendor }: { vendor: { documents?: VendorComplianceDocument[]; certificateName?: string; fssaiNumber?: string; expiryDate?: string } }) {
  const [open, setOpen] = useState<{ title: string; fileName: string; url: string } | null>(null);
  const [busyId, setBusyId] = useState("");
  // A vendor saved before documents were listed (or in the demo) still has its certificate details on the vendor row.
  const certificateOnly: VendorComplianceDocument[] = vendor.fssaiNumber || vendor.certificateName
    ? [{ documentType: "food_certificate", title: "Food Safety Certificate (FSSAI)", documentNumber: vendor.fssaiNumber && !/^(verified|submitted)$/i.test(vendor.fssaiNumber) ? vendor.fssaiNumber : undefined, fileName: vendor.certificateName && !/^private/i.test(vendor.certificateName) ? vendor.certificateName : "fssai-certificate.pdf", expiryDate: vendor.expiryDate && vendor.expiryDate !== "—" ? vendor.expiryDate : undefined }]
    : [];
  const docs = vendor.documents?.length ? vendor.documents : certificateOnly;
  async function inspect(doc: VendorComplianceDocument, key: string) {
    if (!doc.storagePath) return void setOpen({ title: doc.title, fileName: doc.fileName || "document.pdf", url: "" });
    setBusyId(key);
    try { setOpen({ title: doc.title, fileName: doc.fileName || doc.storagePath.split("/").pop() || "document.pdf", url: await signedVendorDocumentUrl(doc.storagePath) }); }
    catch (error) { toast.error(errorMessage(error, "The document could not be opened")); }
    finally { setBusyId(""); }
  }
  return <section aria-label="Submitted compliance documents" data-testid="compliance-documents" className="rounded-2xl bg-white p-4">
    <div className="mb-2 flex items-center gap-2"><FileText className="size-4 text-[#155F65]" /><span className="text-xs font-black uppercase tracking-wider text-[#202827]">Submitted Compliance Documents (PDF) · {docs.length}</span></div>
    {docs.length ? <div className="grid gap-2 sm:grid-cols-2">{docs.map((doc, index) => { const key = doc.id || `${doc.documentType}-${index}`; return <div key={key} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-[#F7FAFA] p-2.5 text-xs">
      <div className="min-w-0"><div className="flex items-center gap-1.5"><span className="rounded bg-red-100 px-1 font-mono text-[10px] font-black text-red-700">PDF</span><span className="truncate font-black text-[#202827]">{doc.title}</span></div>{doc.documentNumber && <div className="mt-0.5 truncate font-mono text-[11px] text-stone-600">{doc.documentNumber}</div>}{doc.expiryDate && <div className="text-[10px] text-stone-500">Expires {doc.expiryDate}</div>}{doc.fileName && <div className="truncate text-[10px] text-stone-400">{doc.fileName}</div>}</div>
      <Button type="button" variant="ghost" size="sm" disabled={busyId === key} onClick={() => void inspect(doc, key)} aria-label={`Inspect ${doc.title}`} className="h-8 shrink-0 rounded-lg px-2 text-xs font-bold"><Eye className="size-3.5 text-[#155F65]" />{busyId === key ? "Opening…" : "Inspect"}</Button>
    </div>; })}</div> : <p className="text-xs text-stone-500">No documents on record for this vendor{vendor.certificateName ? ` besides the certificate file (${vendor.certificateName})` : ""}.</p>}
    <PdfPreviewDialog doc={open} onClose={() => setOpen(null)} />
  </section>;
}
