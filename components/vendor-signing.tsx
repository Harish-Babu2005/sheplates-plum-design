"use client";
// Signing the Vendor Partnership Agreement and the Terms & Conditions, two ways:
//   1. online: read both, type your name, draw your signature, enter the code emailed to you (done at once, signed copies are emailed);
//   2. by hand: download, sign on paper, upload a scan or photo, which Operations then accepts or rejects.
// The server records who/when/where and the exact file.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Download, FileText, PenLine, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";
import { getAccessToken } from "@/lib/supabase";
import { AGREEMENT_DOCUMENTS, CONSENT_TEXT } from "@/lib/agreements";
import { STATE_LABEL, UPLOAD_MAX_BYTES, type DocState } from "@/lib/agreement-status";

export type SigningTab = "online" | "manual";
type Props = { open: boolean; initialTab?: SigningTab; onChanged?: () => void; onClose: () => void; vendorId: string; vendorName: string; defaultName?: string; defaultRole?: string; live: boolean; onSigned: () => void };
const input = "h-11 w-full rounded-2xl border border-stone-200 bg-white px-3.5 text-sm outline-none focus:border-[#155F65] focus:ring-2 focus:ring-[#155F65]/10";

async function call(method: "GET" | "POST", query: string, body?: unknown) {
  const token = await getAccessToken();
  const response = await fetch(`/api/vendor/sign${query}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => ({})) as { error?: string; sentTo?: string; expiresInMinutes?: number };
  if (!response.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}

export type DocView = { id: string; title: string; version: string; url: string; state: DocState; note?: string | null; signedPdfUrl?: string; upload?: { id: string; fileName: string; uploadedAt: string; status: string; note?: string | null; url?: string } };
export async function loadAgreementStatus(vendorId: string): Promise<{ documents: DocView[]; allDone: boolean }> {
  return await call("GET", `?vendorId=${encodeURIComponent(vendorId)}`) as unknown as { documents: DocView[]; allDone: boolean };
}
async function uploadSigned(vendorId: string, documentId: string, file: File) {
  const token = await getAccessToken();
  const form = new FormData(); form.set("vendorId", vendorId); form.set("documentId", documentId); form.set("file", file);
  const response = await fetch("/api/vendor/sign/upload", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  const json = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(json.error || "The upload failed. Please try again.");
}
const stateChip = (state: DocState) => state === "signed_online" || state === "upload_accepted" ? "bg-[#D9F5E7] text-[#21683b]" : state === "upload_pending" ? "bg-[#E4EEFB] text-[#1d4f91]" : state === "upload_rejected" ? "bg-[#FDE4E4] text-[#8a1f1f]" : "bg-[#FFF4CF] text-[#795900]";

export function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false), strokes = useRef(0);
  function pos(e: React.PointerEvent) { const r = canvas.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * canvas.current!.width, y: ((e.clientY - r.top) / r.height) * canvas.current!.height }; }
  function down(e: React.PointerEvent) { const c = canvas.current!.getContext("2d")!; canvas.current!.setPointerCapture(e.pointerId); drawing.current = true; const p = pos(e); c.beginPath(); c.moveTo(p.x, p.y); c.lineWidth = 3; c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#101a1b"; }
  function move(e: React.PointerEvent) { if (!drawing.current) return; const c = canvas.current!.getContext("2d")!, p = pos(e); c.lineTo(p.x, p.y); c.stroke(); strokes.current += 1; }
  function up() { if (!drawing.current) return; drawing.current = false; onChange(strokes.current > 12 ? canvas.current!.toDataURL("image/png") : null); }
  function clear() { canvas.current!.getContext("2d")!.clearRect(0, 0, 600, 200); strokes.current = 0; onChange(null); }
  return <div><canvas ref={canvas} width={600} height={200} aria-label="Draw your signature here" data-testid="signature-pad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} className="h-36 w-full touch-none select-none rounded-2xl border border-dashed border-[#155F65] bg-white" /><button type="button" onClick={clear} className="mt-1 text-xs font-bold text-[#155F65] underline">Clear and redraw</button></div>;
}

/** Mounted only while open, so every opening starts clean with the vendor's own name filled in. */
export function AgreementSigningDialog(props: Props) { return props.open ? <SigningForm {...props} /> : null; }

function SigningForm({ onClose, initialTab = "online", onChanged, vendorId, vendorName, defaultName = "", defaultRole = "Proprietor", live, onSigned }: Props) {
  const [tab, setTab] = useState<SigningTab>(initialTab);
  const [opened, setOpened] = useState<string[]>([]), [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState(defaultName), [role, setRole] = useState(defaultRole), [png, setPng] = useState<string | null>(null);
  const [consent, setConsent] = useState(false), [sentTo, setSentTo] = useState(""), [code, setCode] = useState(""), [busy, setBusy] = useState(false);
  const allRead = AGREEMENT_DOCUMENTS.every((d) => opened.includes(d.id));
  const ready = allRead && name.trim().length >= 3 && Boolean(png) && consent;

  async function sendCode() {
    setBusy(true);
    try {
      if (live) { const r = await call("POST", "", { action: "send_code", vendorId }); setSentTo(String(r.sentTo)); toast.success(`A code was sent to ${r.sentTo}. It works for ${r.expiresInMinutes} minutes.`); }
      else { setSentTo("your email (demo)"); toast.success("Demo: use code 123456."); }
    } catch (error) { toast.error(errorMessage(error, "The code could not be sent")); } finally { setBusy(false); }
  }
  async function sign() {
    setBusy(true);
    try {
      if (live) await call("POST", "", { action: "sign", vendorId, signerName: name, signerRole: role, code, signaturePng: png, consent, documents: AGREEMENT_DOCUMENTS.map((d) => d.id) });
      else if (code !== "123456") throw new Error("That code is not right.");
      toast.success("Signed. A copy of both documents is on its way to your email.");
      onSigned(); onClose();
    } catch (error) { toast.error(errorMessage(error, "Signing failed")); } finally { setBusy(false); }
  }

  return createPortal(<div role="dialog" aria-modal="true" aria-label="Sign your agreements" className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-3">
    <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[#F6FAFA] p-5 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black text-[#202827]">Sign your agreements</h2><p className="mt-1 text-sm text-[#55656A]">{vendorName} · both documents are signed together.</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white"><X className="size-5" /></button></div>

      <div role="tablist" aria-label="How to sign" className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1">
        {([["online", "Sign online"], ["manual", "Sign by hand and upload"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`h-10 rounded-xl text-sm font-bold ${tab === key ? "bg-[#155F65] text-white" : "text-[#202827] hover:bg-stone-50"}`}>{label}</button>)}</div>
      {tab === "manual" && <ManualUpload vendorId={vendorId} live={live} onChanged={() => { onChanged?.(); }} />}
      {tab === "online" && <>
      <h3 className="mt-5 text-sm font-black uppercase tracking-wide text-[#155F65]">1. Read both documents</h3>
      <ul className="mt-2 space-y-2">{AGREEMENT_DOCUMENTS.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 text-sm"><FileText className="size-4 text-[#155F65]" /><b className="flex-1">{d.title} <span className="font-normal text-[#55656A]">v{d.version}</span></b>
        <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => { setPreview(preview === d.id ? null : d.id); setOpened((o) => o.includes(d.id) ? o : [...o, d.id]); }}>{preview === d.id ? "Hide" : "Read here"}</Button>
        <a href={d.url} target="_blank" rel="noreferrer" onClick={() => setOpened((o) => o.includes(d.id) ? o : [...o, d.id])} className="text-xs font-bold text-[#155F65] underline">Open in new tab</a>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${opened.includes(d.id) ? "bg-[#D9F5E7] text-[#21683b]" : "bg-[#FFF4CF] text-[#795900]"}`}>{opened.includes(d.id) ? "Opened" : "Not opened yet"}</span>
        {preview === d.id && <iframe title={d.title} src={`${d.url}#view=FitH`} className="mt-2 h-[55vh] w-full rounded-xl border" />}</li>)}</ul>

      <h3 className="mt-6 text-sm font-black uppercase tracking-wide text-[#155F65]">2. Your details and signature</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Full name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={`${input} mt-1`} /></label><label className="text-sm font-semibold">Your role<input value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} className={`${input} mt-1`} /></label></div>
      <div className="mt-3"><p className="mb-1 text-sm font-semibold">Draw your signature <PenLine className="inline size-4" /></p><SignaturePad onChange={setPng} /></div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={!allRead} className="mt-1 size-5 shrink-0 accent-[#155F65]" /><span>{CONSENT_TEXT}{!allRead && <i className="block text-xs text-[#795900]">Open both documents first.</i>}</span></label>

      <h3 className="mt-6 text-sm font-black uppercase tracking-wide text-[#155F65]">3. Confirm with the code from your email</h3>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        {!sentTo ? <Button type="button" disabled={!ready || busy} onClick={() => void sendCode()} className="rounded-xl bg-[#155F65]">{busy ? "Sending…" : "Email me a code"}</Button> : <>
          <label className="text-sm font-semibold">6 digit code sent to {sentTo}<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" data-testid="signing-code" className={`${input} mt-1 w-40 text-center text-lg tracking-[0.3em]`} /></label>
          <Button type="button" disabled={code.length !== 6 || busy || !ready} onClick={() => void sign()} className="rounded-xl bg-[#155F65]">{busy ? "Signing…" : "Sign both documents"}</Button>
          <button type="button" disabled={busy} onClick={() => void sendCode()} className="text-xs font-bold text-[#155F65] underline">Send a new code</button></>}
      </div>
      <p className="mt-4 text-xs leading-5 text-[#55656A]">We record your name, the time, your device and network address, and a fingerprint of the exact documents. Sheplates countersigns automatically. You get a signed copy of each by email.</p>
      </>}
    </div></div>, document.body);
}

/** Sign on paper: download each document, sign it, then upload a scan or photo. Operations reviews every upload. */
function ManualUpload({ vendorId, live, onChanged }: { vendorId: string; live: boolean; onChanged: () => void }) {
  const [docs, setDocs] = useState<DocView[] | null>(null), [busy, setBusy] = useState<string | null>(null), [files, setFiles] = useState<Record<string, File | null>>({});
  const [demo, setDemo] = useState<Record<string, DocState>>({});
  const [tick, setTick] = useState(0);
  const refresh = useCallback(async () => { setTick((t) => t + 1); }, []);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    loadAgreementStatus(vendorId).then((r) => { if (alive) setDocs(r.documents); }).catch((error) => { if (alive) { toast.error(errorMessage(error, "Could not load your signing status")); setDocs([]); } });
    return () => { alive = false; };
  }, [vendorId, live, tick]);
  const view: DocView[] = live ? docs || [] : AGREEMENT_DOCUMENTS.map((d) => ({ id: d.id, title: d.title, version: d.version, url: d.url, state: demo[d.id] || "not_signed" }));

  async function upload(id: string) {
    const file = files[id];
    if (!file) return void toast.error("Choose the signed file first.");
    if (file.size > UPLOAD_MAX_BYTES) return void toast.error("The file must be under 10 MB.");
    setBusy(id);
    try {
      if (live) await uploadSigned(vendorId, id, file); else setDemo((cur) => ({ ...cur, [id]: "upload_pending" }));
      toast.success("Uploaded. Operations will review it and you will get an email.");
      setFiles((cur) => ({ ...cur, [id]: null }));
      await refresh(); onChanged();
    } catch (error) { toast.error(errorMessage(error, "The upload failed")); } finally { setBusy(null); }
  }

  return <div className="mt-5 space-y-3" data-testid="manual-signing">
    <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-[#2F3C3F]"><li>Download each document and print it.</li><li>Read it, then sign and date it by hand on every place marked for a signature.</li><li>Scan or photograph every page (a single PDF is best) and upload it below.</li></ol>
    <p className="text-xs text-[#55656A]">PDF, PNG, JPG or WebP, up to 10 MB each. Operations checks that it is signed and complete, usually within one working day. You can still sign online instead.</p>
    <ul className="space-y-2">{view.map((d) => { const done = d.state === "signed_online" || d.state === "upload_accepted"; return <li key={d.id} className="rounded-2xl bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><FileText className="size-4 text-[#155F65]" /><b className="flex-1">{d.title} <span className="font-normal text-[#55656A]">v{d.version}</span></b>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stateChip(d.state)}`}>{STATE_LABEL[d.state]}</span></div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a href={d.url} download className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#EEF2F2] px-3 text-xs font-bold text-[#155F65]"><Download className="size-4" />Download to sign</a>
        {!done && <>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-[#155F65] bg-white px-3 text-xs font-bold text-[#155F65]"><Upload className="size-4" />{files[d.id] ? "Change file" : "Choose signed file"}<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" aria-label={`Signed ${d.title}`} className="hidden" onChange={(e) => { const f = e.target.files?.[0] || null; setFiles((cur) => ({ ...cur, [d.id]: f })); e.target.value = ""; }} /></label>
          {files[d.id] && <span className="max-w-[12rem] truncate text-xs text-[#55656A]">{files[d.id]!.name}</span>}
          <Button type="button" size="sm" disabled={!files[d.id] || busy === d.id} onClick={() => void upload(d.id)} className="h-9 rounded-xl bg-[#155F65]">{busy === d.id ? "Uploading…" : "Upload signed copy"}</Button></>}
        {d.upload?.url && <a href={d.upload.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#155F65] underline">View my upload</a>}</div>
      {d.state === "upload_rejected" && <p className="mt-2 rounded-xl bg-[#FDE4E4] p-2 text-xs text-[#8a1f1f]"><b>Not accepted:</b> {d.note || "Please upload a clear, fully signed copy."} Upload it again above.</p>}</li>; })}</ul></div>;
}

/** The agreement card on the vendor's Verification page: what is signed, what is waiting, and the two ways to sign. */
export function AgreementPanel({ vendor, live, onViewTerms, onSigned }: { vendor: { id: string; businessName: string; ownerName?: string; ownerRole?: string; termsAccepted?: boolean }; live: boolean; onViewTerms: () => void; onSigned: () => void }) {
  const [docs, setDocs] = useState<DocView[] | null>(null), [open, setOpen] = useState<SigningTab | null>(null), [signedHere, setSignedHere] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    loadAgreementStatus(vendor.id).then((r) => { if (alive) setDocs(r.documents); }).catch(() => { if (alive) setDocs([]); });
    return () => { alive = false; };
  }, [live, vendor.id, tick]);
  const complete = live ? Boolean(docs && docs.length > 0 && docs.every((d) => d.state === "signed_online" || d.state === "upload_accepted")) : vendor.termsAccepted !== false || signedHere;
  const loading = live && docs === null;
  const dialog = <AgreementSigningDialog open={open !== null} initialTab={open || "online"} vendorId={vendor.id} vendorName={vendor.businessName} defaultName={vendor.ownerName} defaultRole={vendor.ownerRole || "Proprietor"} live={live} onClose={() => setOpen(null)} onChanged={() => void refresh()} onSigned={() => { setSignedHere(true); void refresh(); onSigned(); }} />;
  if (loading) return null;
  if (complete && !(live && docs && docs.length)) return dialog;
  if (complete) return <section aria-label="Signed agreements" className="rounded-[28px] bg-[#EAF5EC] p-5 text-[#21683b]"><h3 className="font-black">Agreements signed</h3><ul className="mt-2 space-y-1 text-sm">{(docs || []).map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2"><span className="font-bold">{d.title}</span><span>· {STATE_LABEL[d.state]}</span>{d.signedPdfUrl && <a href={d.signedPdfUrl} target="_blank" rel="noreferrer" className="font-bold underline">Open signed copy</a>}{d.upload?.url && d.state === "upload_accepted" && <a href={d.upload.url} target="_blank" rel="noreferrer" className="font-bold underline">Open signed copy</a>}</li>)}</ul>{dialog}</section>;
  const waiting = (docs || []).some((d) => d.state === "upload_pending");
  return <section aria-label="Vendor Terms and Conditions" className="rounded-[28px] bg-[#FFF4CF] p-6 text-[#795900]">
    <h3 className="flex items-center gap-2 font-black"><FileText className="size-5" />Sign your Partnership Agreement and Terms</h3>
    <p className="mt-2 text-sm leading-6">Operations cannot approve your store until both documents are signed. Sign online in two minutes, or download them, sign by hand and upload a scan or photo.{waiting ? " Your uploaded copy is waiting for Operations to review it." : ""}</p>
    {live && docs && docs.length > 0 && <ul className="mt-3 space-y-1.5 text-sm">{docs.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2"><b>{d.title}</b><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stateChip(d.state)}`}>{STATE_LABEL[d.state]}</span>{d.state === "upload_rejected" && <span className="text-xs text-[#8a1f1f]">{d.note || "Please upload it again."}</span>}</li>)}</ul>}
    <div className="mt-4 flex flex-wrap gap-2">
      <Button onClick={() => setOpen("online")} className="rounded-xl bg-[#155F65]"><PenLine className="size-4" />Review and sign</Button>
      <Button type="button" variant="outline" onClick={() => setOpen("manual")} className="rounded-xl bg-white text-[#202827]"><Upload className="size-4" />Sign by hand and upload</Button>
      <Button type="button" variant="outline" onClick={onViewTerms} className="rounded-xl bg-white text-[#202827]"><FileText className="size-4" />View Terms &amp; Conditions</Button></div>
    {dialog}</section>;
}

/** Operations: the vendor's two documents, any hand-signed upload waiting for review, and accept / reject. Reports whether the vendor is fully signed. */
export function OpsAgreementPanel({ vendorId, live, onComplete }: { vendorId: string; live: boolean; onComplete: (vendorId: string, complete: boolean | null) => void }) {
  const [docs, setDocs] = useState<DocView[] | null>(null), [rejecting, setRejecting] = useState<string | null>(null), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [tick, setTick] = useState(0);
  const refresh = useCallback(async () => { setTick((t) => t + 1); }, []);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    loadAgreementStatus(vendorId).then((r) => { if (!alive) return; setDocs(r.documents); onComplete(vendorId, r.documents.length > 0 && r.documents.every((d) => d.state === "signed_online" || d.state === "upload_accepted")); }).catch(() => { if (alive) { setDocs([]); onComplete(vendorId, null); } });
    return () => { alive = false; };
  }, [live, vendorId, onComplete, tick]);
  if (!live) return null;

  async function review(uploadId: string, decision: "accepted" | "rejected") {
    setBusy(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/vendor/sign/review", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ uploadId, decision, note }) });
      const json = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(json.error || "The review could not be saved.");
      toast.success(decision === "accepted" ? "Signed copy accepted. The vendor was told by email." : "Rejected. The vendor was told what to fix.");
      setRejecting(null); setNote(""); await refresh();
    } catch (error) { toast.error(errorMessage(error, "The review could not be saved")); } finally { setBusy(false); }
  }

  return <section aria-label="Signed agreements" className="rounded-3xl bg-white p-4"><h3 className="text-sm font-black uppercase tracking-wide text-[#155F65]">Partnership Agreement and Terms</h3>
    {docs === null ? <p className="mt-2 text-sm text-[#55656A]">Loading…</p> : <ul className="mt-2 space-y-3">{docs.map((d) => <li key={d.id} className="text-sm">
      <div className="flex flex-wrap items-center gap-2"><b>{d.title}</b><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${stateChip(d.state)}`}>{STATE_LABEL[d.state]}</span>
        {d.signedPdfUrl && <a href={d.signedPdfUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#155F65] underline">Open signed copy</a>}
        {d.upload?.url && <a href={d.upload.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#155F65] underline">Open uploaded file ({d.upload.fileName})</a>}</div>
      {d.state === "upload_pending" && d.upload && <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void review(d.upload!.id, "accepted")} className="rounded-xl bg-[#155F65]">Accept signed copy</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(rejecting === d.upload!.id ? null : d.upload!.id)} className="rounded-xl">Reject</Button>
        {rejecting === d.upload.id && <div className="flex w-full flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs font-semibold">What should the vendor fix?<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="For example: signature missing on the last page" className={`${input} mt-1`} /></label><Button type="button" size="sm" disabled={busy || note.trim().length < 3} onClick={() => void review(d.upload!.id, "rejected")} className="rounded-xl bg-[#b42332] text-white">Send rejection</Button></div>}</div>}
      {d.state === "upload_rejected" && <p className="mt-1 text-xs text-[#8a1f1f]">Rejected: {d.note}. Waiting for a new upload.</p>}</li>)}</ul>}</section>;
}
