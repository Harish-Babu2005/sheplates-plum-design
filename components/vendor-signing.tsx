"use client";
// Online signing of the Vendor Partnership Agreement and the Terms & Conditions: read both, type your name, draw your signature,
// enter the code emailed to you. The server records who/when/where and the exact file, and emails the signed copies.
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { FileText, PenLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/error-message";
import { getAccessToken } from "@/lib/supabase";
import { AGREEMENT_DOCUMENTS, CONSENT_TEXT } from "@/lib/agreements";

type Props = { open: boolean; onClose: () => void; vendorId: string; vendorName: string; defaultName?: string; defaultRole?: string; live: boolean; onSigned: () => void };
const input = "h-11 w-full rounded-2xl border border-stone-200 bg-white px-3.5 text-sm outline-none focus:border-[#155F65] focus:ring-2 focus:ring-[#155F65]/10";

async function call(method: "GET" | "POST", query: string, body?: unknown) {
  const token = await getAccessToken();
  const response = await fetch(`/api/vendor/sign${query}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => ({})) as { error?: string; sentTo?: string; expiresInMinutes?: number };
  if (!response.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}

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

function SigningForm({ onClose, vendorId, vendorName, defaultName = "", defaultRole = "Proprietor", live, onSigned }: Props) {
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
    </div></div>, document.body);
}
