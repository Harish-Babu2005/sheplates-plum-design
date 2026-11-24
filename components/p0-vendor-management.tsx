"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/lib/error-message";
import { getAccessToken, normalizeWhatsAppNumber, uploadLiveCertificate } from "@/lib/supabase";
import { fssaiFieldProblem, phoneFieldProblem, normalizeIndianMobile } from "@/lib/vendor-compliance";
import { P0VendorLocationPicker } from "@/components/p0-vendor-location-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const VENDOR_ONBOARDING_CATEGORIES = [
  "Milk & dairy",
  "Home food",
  "Caterer",
  "Meat & fish",
  "Vegetables",
  "Groceries",
  "Eggs",
  "Bakery",
  "Snacks",
  "Rice & staples",
  "Other",
] as const;

type Permission = "can_create" | "can_review" | "can_cancel" | "can_reactivate" | "can_upgrade" | "can_upload";
type Permissions = Record<Permission, boolean>;

type P0Vendor = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  locality: string;
  address: string | null;
  latitude: number;
  longitude: number;
  service_radius_km: number;
  p0_contact_name: string;
  p0_contact_phone: string;
  p0_fssai_required: boolean;
  p0_cancelled_at: string | null;
  verification_status: string;
  operational_status: string;
  marketplace_visible: boolean;
  connect_enabled: boolean;
  whatsapp_number: string;
  logo_url: string | null;
};

type VendorDocument = {
  vendor_id: string;
  document_number: string | null;
  expiry_date: string | null;
  verification_status: string;
  storage_path: string;
};

type UpgradeInvitation = {
  id: string;
  vendor_id: string;
  invited_email: string;
  status: string;
  expires_at: string;
};

type OperationsUser = { id: string; full_name: string; permissions: Permissions };
type P0Response = {
  vendors?: P0Vendor[];
  documents?: VendorDocument[];
  invitations?: UpgradeInvitation[];
  permissions?: Permissions;
  operationsUsers?: OperationsUser[];
  error?: string;
};

const EMPTY_PERMISSIONS: Permissions = {
  can_create: false,
  can_review: false,
  can_cancel: false,
  can_reactivate: false,
  can_upgrade: false,
  can_upload: false,
};
const PERMISSION_LABELS: Array<{ key: Permission; label: string }> = [
  { key: "can_create", label: "Create" },
  { key: "can_review", label: "Review" },
  { key: "can_cancel", label: "Cancel" },
  { key: "can_reactivate", label: "Reactivate" },
  { key: "can_upgrade", label: "Upgrade" },
  { key: "can_upload", label: "Upload certificates" },
];

const inputClass = "mt-1 block w-full min-w-0 font-normal rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#155F65]";

async function p0Request<T>(action: string, body?: Record<string, unknown> | FormData, method = "POST"): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in again before managing P0 vendors.");
  const isFormData = body instanceof FormData;
  const response = await fetch("/api/p0/vendors", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "POST" && !isFormData ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: isFormData ? body : JSON.stringify({ action, ...body }) } : {}),
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "P0 vendor request failed.");
  return result;
}

export function P0VendorManagement({ role }: { role: "operations" | "admin" }) {
  const isAdmin = role === "admin";
  const [vendors, setVendors] = useState<P0Vendor[]>([]);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [invitations, setInvitations] = useState<UpgradeInvitation[]>([]);
  const [permissions, setPermissions] = useState<Permissions>(EMPTY_PERMISSIONS);
  const [operationsUsers, setOperationsUsers] = useState<OperationsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "", category: "", description: "", locality: "", address: "",
    latitude: "", longitude: "", radius: "5", contactName: "", contactPhone: "",
    whatsappNumber: "", durationHours: "7", fssaiRequired: false,
    fssaiNumber: "", expiryDate: "",
  });
  const [certificate, setCertificate] = useState<File | null>(null);
  const [otherCategory, setOtherCategory] = useState("");
  const [shopImage, setShopImage] = useState<File | null>(null);
  const shopImageInput = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  // Per-field inline validation errors (kept even after submit so the user sees what to fix)
  const [phoneError, setPhoneError] = useState("");
  const [waError, setWaError] = useState("");
  const [fssaiError, setFssaiError] = useState("");
  const [expiryError, setExpiryError] = useState("");
  const [certError, setCertError] = useState("");
  const [shopImageError, setShopImageError] = useState("");
  const [upgrade, setUpgrade] = useState<Record<string, { email: string; planCode: string }>>({});
  const [certificateInputs, setCertificateInputs] = useState<Record<string, { number: string; expiry: string; file: File | null }>>({});
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, Permissions>>({});
  const [claimLink, setClaimLink] = useState("");
  const [p0Tab, setP0Tab] = useState<"All" | "Pending approval" | "Live" | "Cancelled">("All");

  const reload = useCallback(async () => {
    setError("");
    try {
      const result = await p0Request<P0Response>("", undefined, "GET");
      setVendors(result.vendors || []);
      setDocuments(result.documents || []);
      setInvitations(result.invitations || []);
      setPermissions(result.permissions || EMPTY_PERMISSIONS);
      setOperationsUsers(result.operationsUsers || []);
      setPermissionDrafts(Object.fromEntries((result.operationsUsers || []).map((user) => [user.id, user.permissions])));
    } catch (caught) {
      setError(errorMessage(caught, "P0 vendor records could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const latestDocuments = useMemo(() => {
    const map = new Map<string, VendorDocument>();
    for (const document of documents) if (!map.has(document.vendor_id)) map.set(document.vendor_id, document);
    return map;
  }, [documents]);

  const latestInvitations = useMemo(() => {
    const map = new Map<string, UpgradeInvitation>();
    for (const invitation of invitations) if (!map.has(invitation.vendor_id)) map.set(invitation.vendor_id, invitation);
    return map;
  }, [invitations]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createVendor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permissions.can_create && !isAdmin) return setError("Your account is not authorized to create P0 vendors.");

    // --- client-side field validation (values are kept on error) ---
    const phoneProblem = phoneFieldProblem(form.contactPhone, "contact phone number");
    const waProblem = phoneFieldProblem(form.whatsappNumber, "WhatsApp number");
    const fssaiProblem = form.fssaiRequired ? fssaiFieldProblem(form.fssaiNumber, true) : null;
    const today = new Date().toISOString().slice(0, 10);
    const expiredProblem = form.fssaiRequired && form.expiryDate && form.expiryDate < today
      ? "This certificate has expired. Use a date that is today or later."
      : null;
    const certMissing = form.fssaiRequired && !certificate ? "Upload the FSSAI certificate PDF to continue." : null;

    setPhoneError(phoneProblem ?? "");
    setWaError(waProblem ?? "");
    setFssaiError(fssaiProblem ?? "");
    setExpiryError(expiredProblem ?? "");
    if (certMissing) setCertError(certMissing);

    if (phoneProblem || waProblem || fssaiProblem || expiredProblem || certMissing) return;

    // Certificate file type / size checks
    if (certificate) {
      if (certificate.type !== "application/pdf") {
        setCertError("Only PDF files are accepted for FSSAI certificates.");
        return;
      }
      if (certificate.size > 10 * 1024 * 1024) {
        setCertError("FSSAI certificate must be under 10 MB.");
        return;
      }
    }
    if (shopImage) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(shopImage.type)) {
        setShopImageError("Choose a PNG, JPG or WebP image.");
        return;
      }
      if (shopImage.size > 10 * 1024 * 1024) {
        setShopImageError("Image must be under 10 MB.");
        return;
      }
    }

    // Build canonical WhatsApp +91XXXXXXXXXX
    const rawWaDigits = normalizeIndianMobile(form.whatsappNumber)!;
    const whatsappNumber = `+91${rawWaDigits}`;
    const contactPhone = normalizeIndianMobile(form.contactPhone)!;

    if (form.fssaiRequired && !isAdmin && !permissions.can_upload) return setError("Your Operations account also needs certificate-upload permission.");

    setBusy(true);
    setError("");
    setNotice("");
    let createdVendorId: string | null = null;
    try {
      const request = new FormData();
      request.append("action", "create");
      request.append("name", form.name);
      const effectiveCategory = form.category === "Other" ? otherCategory.trim() : form.category.trim();
      if (!effectiveCategory) return setError("Please select or enter a business category.");
      request.append("category", effectiveCategory);
      request.append("description", form.description);
      request.append("locality", form.locality);
      request.append("address", form.address);
      request.append("latitude", String(Number(form.latitude)));
      request.append("longitude", String(Number(form.longitude)));
      request.append("serviceRadiusKm", String(Number(form.radius)));
      request.append("contactName", form.contactName);
      request.append("contactPhone", contactPhone);
      request.append("whatsappNumber", whatsappNumber);
      request.append("durationHours", form.durationHours);
      request.append("fssaiRequired", String(form.fssaiRequired));
      if (shopImage) request.append("shopImage", shopImage);
      const result = await p0Request<{ vendorId: string }>("create", request);
      createdVendorId = result.vendorId;
      if (form.fssaiRequired && certificate) {
        await uploadLiveCertificate({
          vendorId: result.vendorId,
          file: certificate,
          documentNumber: form.fssaiNumber,
          expiryDate: form.expiryDate,
        });
      }
      setNotice("P0 vendor saved as pending, inactive and hidden until authorized approval.");
      setCertificate(null);
      setShopImage(null);
      if (shopImageInput.current) shopImageInput.current.value = "";
      if (certInputRef.current) certInputRef.current.value = "";
      setOtherCategory("");
      setPhoneError(""); setWaError(""); setFssaiError(""); setExpiryError(""); setCertError(""); setShopImageError("");
      setForm({
        name: "", category: "", description: "", locality: "", address: "",
        latitude: "", longitude: "", radius: "5", contactName: "", contactPhone: "",
        whatsappNumber: "", durationHours: "7", fssaiRequired: false, fssaiNumber: "", expiryDate: "",
      });
      await reload();
    } catch (caught) {
      const message = errorMessage(caught, "P0 vendor could not be created.");
      setError(createdVendorId
        ? `P0 vendor ${createdVendorId} was created, but a follow-up step failed: ${message}. Do not create it again; use its listing below to retry the certificate upload.`
        : message);
      await reload();
    } finally {
      setBusy(false);
    }
  }
  async function review(vendorId: string, decision: "verified" | "rejected") {
    const question = decision === "verified" ? "Approve and make this eligible P0 vendor visible?" : "Reject this P0 vendor application?";
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await p0Request("review", { vendorId, decision });
      setNotice(decision === "verified" ? "P0 vendor approved." : "P0 vendor rejected.");
      await reload();
    } catch (caught) {
      setError(errorMessage(caught, "P0 review could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(vendor: P0Vendor) {
    if (!window.confirm(`Cancel ${vendor.name}? This hides the vendor and revokes any pending upgrade invitation. The vendor record and analytics are retained.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await p0Request("cancel", { vendorId: vendor.id });
      setNotice("P0 vendor deactivated and hidden. Existing data and analytics were retained.");
      await reload();
    } catch (caught) {
      setError(errorMessage(caught, "P0 vendor could not be cancelled."));
    } finally {
      setBusy(false);
    }
  }

  async function reactivate(vendor: P0Vendor) {
    if (!window.confirm(`Reactivate ${vendor.name}? Any old invitation remains revoked; a new invitation must be sent separately.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await p0Request("reactivate", { vendorId: vendor.id });
      setNotice("P0 vendor reactivated. A prior upgrade invitation was not restored.");
      await reload();
    } catch (caught) {
      setError(errorMessage(caught, "P0 vendor could not be reactivated."));
    } finally {
      setBusy(false);
    }
  }

  async function startUpgrade(vendor: P0Vendor) {
    const details = upgrade[vendor.id] || { email: "", planCode: "crave" };
    if (!details.email.trim()) return setError("Enter the vendor account email for the upgrade.");
    setBusy(true);
    setError("");
    setNotice("");
    setClaimLink("");
    try {
      const result = await p0Request<{ status: string; invitationId: string; claimUrl?: string; message?: string }>("upgrade", {
        vendorId: vendor.id,
        email: details.email,
        planCode: details.planCode,
      });
      if (result.status === "claim_pending" && result.claimUrl) {
        setClaimLink(result.claimUrl);
        setNotice(result.message || "The existing account must sign in and confirm ownership.");
      } else {
        setNotice("Invitation sent. The upgrade remains pending until account ownership is verified.");
      }
      await reload();
    } catch (caught) {
      setError(errorMessage(caught, "Upgrade invitation could not be sent."));
    } finally {
      setBusy(false);
    }
  }

  async function uploadCertificate(vendorId: string) {
    const value = certificateInputs[vendorId];
    if (!value?.file || !value.number.trim() || !value.expiry) return setError("Enter the certificate number, expiry and file.");
    if (value.file.size <= 0 || /^blank[._-]/i.test(value.file.name)) return setError("The selected certificate file is empty (0 bytes). Please upload a valid document.");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await uploadLiveCertificate({
        vendorId,
        file: value.file,
        documentNumber: value.number,
        expiryDate: value.expiry,
      });
      setNotice("Certificate uploaded for P0 review.");
      await reload();
    } catch (caught) {
      setError(errorMessage(caught, "Certificate upload failed."));
    } finally {
      setBusy(false);
    }
  }

  async function savePermissions(profileId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await p0Request("permissions", { profileId, permissions: permissionDrafts[profileId] || EMPTY_PERMISSIONS });
      setNotice("P0 permissions updated and audited.");
      await reload();
    } catch (caught) {
      setError(errorMessage(caught, "P0 permissions could not be updated."));
    } finally {
      setBusy(false);
    }
  }

  const hasPermission = (permission: Permission) => isAdmin || permissions[permission];

  const livePlanless = vendors.filter((v) => v.verification_status === "verified" && !v.p0_cancelled_at);
  const waiting = vendors.filter((v) => ["submitted", "under_review", "changes_required"].includes(v.verification_status) && !v.p0_cancelled_at);
  const cancelledList = vendors.filter((v) => Boolean(v.p0_cancelled_at));
  const pendingInvites = invitations.filter((i) => i.status === "pending");
  const tabs = [["All", vendors], ["Pending approval", waiting], ["Live", livePlanless], ["Cancelled", cancelledList]] as const;
  const shownVendors = (tabs.find(([name]) => name === p0Tab) || tabs[0])[1];
  return <div className="space-y-5">
    <header>
      <h1 className="text-[28px] font-bold leading-tight">P0 Connect vendors</h1>
      <p className="mt-1 text-sm text-[#55656A]">{isAdmin ? "Decide which Operations team members can create, approve, cancel and upgrade directory vendors." : "Directory listings you manage for vendors who connect with customers on WhatsApp. They have no login."} P0 is independent of the Taster, Crave, Thrive and Crown plans.</p>
    </header>
    <div className="grid gap-4 sm:grid-cols-3"><div className="surface-card rounded-3xl p-5"><div className="text-[13px] text-[#55656A]">Connect vendors live</div><div className="mt-1 text-[28px] font-bold">{livePlanless.length}</div></div><div className="surface-card rounded-3xl p-5"><div className="text-[13px] text-[#55656A]">Waiting for approval</div><div className="mt-1 text-[28px] font-bold">{waiting.length}</div></div><div className="surface-card rounded-3xl p-5"><div className="text-[13px] text-[#55656A]">Upgrade invitations</div><div className="mt-1 text-[28px] font-bold">{pendingInvites.length}</div></div></div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
    {claimLink && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"><b>Authenticated ownership confirmation link</b><div className="mt-2 break-all">{claimLink}</div><button type="button" className="mt-2 font-black underline" onClick={() => void navigator.clipboard.writeText(claimLink)}>Copy claim link</button></div>}

    {isAdmin && <section className="surface-card rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Operations permissions</h2><span className="text-xs text-[#55656A]">Every change is recorded in the audit log</span></div>
      <p className="mt-3 rounded-2xl bg-[#edf3fd] p-3 text-xs font-medium text-[#285fba]">The person who creates a Connect vendor can never approve it. Approval needs a different team member with the Review right. Operations users have no P0 permissions until you assign them.</p>
      <div className="mt-4 space-y-4">
        {operationsUsers.map((user) => <div key={user.id} className="rounded-[18px] bg-[#EEF2F2] p-4">
          <div className="font-semibold">{user.full_name || "Operations user"}</div>
          <div className="mt-3 flex flex-wrap gap-3">
            {PERMISSION_LABELS.map(({ key, label }) => <label key={key} className="flex items-center gap-1.5 text-xs font-semibold">
              <input type="checkbox" checked={permissionDrafts[user.id]?.[key] || false} onChange={(event) => setPermissionDrafts((current) => ({
                ...current,
                [user.id]: { ...(current[user.id] || EMPTY_PERMISSIONS), [key]: event.target.checked },
              }))} />
              {label}
            </label>)}
          </div>
          <button type="button" onClick={() => void savePermissions(user.id)} disabled={busy} className="mt-3 rounded-full bg-[#155F65] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Save permissions</button>
        </div>)}
      </div>
    </section>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
    <section className="space-y-3 xl:order-1">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="P0 status">{tabs.map(([name, list]) => <button key={name} type="button" role="tab" aria-selected={p0Tab === name} onClick={() => setP0Tab(name)} className={`h-10 rounded-full px-4 text-sm font-semibold ${p0Tab === name ? "bg-[#155F65] text-white" : "bg-white text-[#2F3C3F]"}`}>{name} · {list.length}</button>)}</div>
      {loading ? <p role="status" className="text-sm text-stone-500">Loading P0 vendor records…</p>
        : shownVendors.length === 0 ? <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-sm text-stone-500">No P0 vendors have been created.</p>
          : shownVendors.map((vendor) => {
            const document = latestDocuments.get(vendor.id);
            const invitation = latestInvitations.get(vendor.id);
            const certificateValid = Boolean(document?.document_number && document.expiry_date && document.expiry_date >= new Date().toISOString().slice(0, 10));
            const cancelled = Boolean(vendor.p0_cancelled_at);
            const approvalPending = ["submitted", "under_review", "changes_required"].includes(vendor.verification_status);
            const upgradeValue = upgrade[vendor.id] || { email: "", planCode: "crave" };
            const certificateValue = certificateInputs[vendor.id] || { number: "", expiry: "", file: null };
            return <article key={vendor.id} className="surface-card rounded-3xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">{vendor.name}</h3>
                  <p className="text-xs text-stone-500">{vendor.category} · {vendor.locality} · {vendor.service_radius_km} km</p>
                  <p className="mt-1 text-xs text-stone-500">ID {vendor.id} · {vendor.latitude}, {vendor.longitude}</p>
                  <p className="mt-1 text-xs text-stone-500">Contact: {vendor.p0_contact_name} · {vendor.p0_contact_phone} · WhatsApp {vendor.whatsapp_number}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cancelled ? "bg-[#fdecef] text-[#b42332]" : vendor.verification_status === "verified" ? "bg-[#eaf5ec] text-[#21683b]" : "bg-[#FFF4CF] text-[#795900]"}`}>{cancelled ? "Cancelled" : `${vendor.verification_status} · ${vendor.operational_status}`}</span>
              </div>
              {vendor.p0_fssai_required && <p className={`mt-3 text-xs font-semibold ${certificateValid ? "text-[#21683b]" : "text-[#795900]"}`}>
                FSSAI {certificateValid ? `on file · expires ${document?.expiry_date}` : "required · certificate not current"}
              </p>}
              {invitation && <p className="mt-2 text-xs text-stone-600">Upgrade invite: {invitation.invited_email} · {invitation.status} · expires {new Date(invitation.expires_at).toLocaleDateString()}</p>}

              {vendor.p0_fssai_required && !certificateValid && hasPermission("can_upload") && !cancelled && <div className="mt-4 grid gap-2 rounded-xl bg-[#FFF4CF] p-3 sm:grid-cols-4">
                <input aria-label="FSSAI number" placeholder="FSSAI number" value={certificateValue.number} onChange={(event) => setCertificateInputs((current) => ({ ...current, [vendor.id]: { ...certificateValue, number: event.target.value } }))} className="rounded-lg border border-amber-200 px-3 py-2 text-xs" />
                <input aria-label="Certificate expiry" type="date" value={certificateValue.expiry} onChange={(event) => setCertificateInputs((current) => ({ ...current, [vendor.id]: { ...certificateValue, expiry: event.target.value } }))} className="rounded-lg border border-amber-200 px-3 py-2 text-xs" />
                <input aria-label="Certificate file" type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={(event) => { const f = event.target.files?.[0] || null; if (f && (f.size <= 0 || /^blank[._-]/i.test(f.name))) { setError(`"${f.name}" is empty (0 bytes). Please upload a valid document.`); event.target.value = ""; return; } setCertificateInputs((current) => ({ ...current, [vendor.id]: { ...certificateValue, file: f } })); }} className="min-w-0 rounded-lg border border-amber-200 px-3 py-2 text-xs" />
                <button type="button" onClick={() => void uploadCertificate(vendor.id)} disabled={busy} className="rounded-full bg-[#155F65] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Upload certificate</button>
              </div>}

              <div className="mt-4 flex flex-wrap gap-2">
                {approvalPending && !cancelled && hasPermission("can_review") && <>
                  <button type="button" onClick={() => void review(vendor.id, "verified")} disabled={busy} className="rounded-full bg-[#155F65] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Approve</button>
                  <button type="button" onClick={() => void review(vendor.id, "rejected")} disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50">Reject</button>
                </>}
                {cancelled && hasPermission("can_reactivate") && <button type="button" onClick={() => void reactivate(vendor)} disabled={busy} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-800 disabled:opacity-50">Reactivate</button>}
                {!cancelled && vendor.operational_status === "active" && hasPermission("can_cancel") && <button type="button" onClick={() => void cancel(vendor)} disabled={busy} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50">Cancel</button>}
              </div>

              {!cancelled && vendor.operational_status === "active" && hasPermission("can_upgrade") && <div className="mt-4 grid gap-2 border-t border-stone-100 pt-4 sm:grid-cols-[1fr_180px_auto]">
                <input type="email" placeholder="Vendor account email" value={upgradeValue.email} onChange={(event) => setUpgrade((current) => ({ ...current, [vendor.id]: { ...upgradeValue, email: event.target.value } }))} className="rounded-lg border border-stone-200 px-3 py-2 text-sm" />
                <select aria-label="Subscription plan" value={upgradeValue.planCode} onChange={(event) => setUpgrade((current) => ({ ...current, [vendor.id]: { ...upgradeValue, planCode: event.target.value } }))} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
                  <option value="taster">Taster · ₹499</option><option value="crave">Crave · ₹699</option><option value="thrive">Thrive · ₹799</option><option value="crown">Crown · ₹999</option>
                </select>
                <button type="button" onClick={() => void startUpgrade(vendor)} disabled={busy} className="rounded-lg bg-[#155F65] px-4 py-2 text-xs font-black text-white disabled:opacity-50">Invite / claim</button>
              </div>}
            </article>;
          })}
    </section>
    {hasPermission("can_create") && <form onSubmit={(event) => void createVendor(event)} className="surface-card h-fit rounded-3xl p-5 xl:order-2">
      <h2 className="text-lg font-semibold">Add a Connect vendor</h2>
      <p className="mt-1 text-xs text-stone-500">Creates one unowned vendor record; it starts pending, inactive and hidden. Coordinates and WhatsApp are required for later discovery.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
        <label className="grid content-start text-xs font-bold">Business name<input required value={form.name} onChange={(event) => updateForm("name", event.target.value)} className={inputClass} /></label>
        <div className="flex flex-col text-xs font-bold">
          <span>Category</span>
          <Select value={form.category} onValueChange={(value) => updateForm("category", value)}>
            <SelectTrigger
              aria-label="Category"
              className="mt-1 h-[42px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-normal text-stone-900 outline-none focus:border-[#155F65]"

            >
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {VENDOR_ONBOARDING_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.category === "Other" && (
          <label className="grid content-start text-xs font-bold md:col-span-2 xl:col-span-1">
            Your category
            <input
              required
              value={otherCategory}
              onChange={(event) => setOtherCategory(event.target.value)}
              className={inputClass}
              placeholder="Enter your business category"
            />
          </label>
        )}
        <label className="grid content-start text-xs font-bold">Contact person<input required value={form.contactName} onChange={(event) => updateForm("contactName", event.target.value)} className={inputClass} /></label>
        <div className="grid content-start gap-1 text-xs font-bold">
          <label htmlFor="p0-contact-phone">Contact phone</label>
          <input
            id="p0-contact-phone"
            required
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={form.contactPhone}
            onChange={(event) => {
              const v = event.target.value.replace(/[^\d]/g, "").slice(0, 10);
              updateForm("contactPhone", v);
              if (phoneError) setPhoneError("");
            }}
            onPaste={(event) => {
              event.preventDefault();
              const pasted = event.clipboardData.getData("text");
              const digits = normalizeIndianMobile(pasted) ?? pasted.replace(/[^\d]/g, "").slice(0, 10);
              updateForm("contactPhone", digits);
              if (phoneError) setPhoneError("");
            }}
            onBlur={() => setPhoneError(phoneFieldProblem(form.contactPhone, "contact phone number") ?? "")}
            placeholder="98XXXXXXXX"
            className={inputClass}
          />
          <span className="mt-0.5 font-normal text-stone-500">10 digits · first digit 6–9</span>
          {phoneError && <p role="alert" className="text-xs font-semibold text-red-600">{phoneError}</p>}
        </div>
        <div className="grid content-start gap-1 text-xs font-bold">
          <label htmlFor="p0-whatsapp-number">WhatsApp number</label>
          <input
            id="p0-whatsapp-number"
            required
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={form.whatsappNumber}
            onChange={(event) => {
              const v = event.target.value.replace(/[^\d]/g, "").slice(0, 10);
              updateForm("whatsappNumber", v);
              if (waError) setWaError("");
            }}
            onPaste={(event) => {
              event.preventDefault();
              const pasted = event.clipboardData.getData("text");
              const digits = normalizeIndianMobile(pasted) ?? pasted.replace(/[^\d]/g, "").slice(0, 10);
              updateForm("whatsappNumber", digits);
              if (waError) setWaError("");
            }}
            onBlur={() => setWaError(phoneFieldProblem(form.whatsappNumber, "WhatsApp number") ?? "")}
            placeholder="98XXXXXXXX"
            className={inputClass}
          />
          <span className="mt-0.5 font-normal text-stone-500">Stored as +91XXXXXXXXXX</span>
          {waError && <p role="alert" className="text-xs font-semibold text-red-600">{waError}</p>}
        </div>
        <label className="grid content-start text-xs font-bold">Locality<input required value={form.locality} onChange={(event) => {
          updateForm("locality", event.target.value);
          updateForm("latitude", "");
          updateForm("longitude", "");
        }} className={inputClass} /></label>
        <label className="grid content-start text-xs font-bold md:col-span-2">Address<textarea value={form.address} onChange={(event) => {
          updateForm("address", event.target.value);
          updateForm("latitude", "");
          updateForm("longitude", "");
        }} className={inputClass} /></label>
        <P0VendorLocationPicker
          address={form.address}
          locality={form.locality}
          latitude={form.latitude}
          longitude={form.longitude}
          radiusKm={form.radius}
          onSave={(place) => {
            updateForm("address", place.address);
            updateForm("latitude", String(place.latitude));
            updateForm("longitude", String(place.longitude));
            setNotice(`Vendor pin saved: ${place.address}`);
          }}
        />
        <label className="grid content-start text-xs font-bold">Latitude<input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(event) => updateForm("latitude", event.target.value)} className={inputClass} /></label>
        <label className="grid content-start text-xs font-bold">Longitude<input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(event) => updateForm("longitude", event.target.value)} className={inputClass} /></label>
        <label className="grid content-start text-xs font-bold">Service radius (km)<input required type="number" step="0.5" min="0.5" max="100" value={form.radius} onChange={(event) => updateForm("radius", event.target.value)} className={inputClass} /></label>
        <label className="grid content-start text-xs font-bold">Operating duration (hours/day)<input required type="number" min="1" max="24" value={form.durationHours} onChange={(event) => updateForm("durationHours", event.target.value)} className={inputClass} /></label>
        <div className="grid content-start gap-1 text-xs font-bold">
          <span>Shop image (optional)</span>
          {shopImage ? (
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5">
              <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white shrink-0">✓</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-emerald-800">{shopImage.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-stone-500">{(shopImage.size / 1024).toFixed(0)} KB</span>
              <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-1 text-[11px] font-bold text-stone-700 hover:bg-stone-50">
                Replace
                <input ref={shopImageInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const f = event.target.files?.[0]; if (!f) return; if (f.size <= 0) { setShopImageError("The selected image is empty (0 bytes)."); return; } if (!["image/png","image/jpeg","image/webp"].includes(f.type)) { setShopImageError("Choose a PNG, JPG or WebP image."); return; } if (f.size > 10*1024*1024) { setShopImageError("Image must be under 10 MB."); return; } setShopImage(f); setShopImageError(""); event.target.value = ""; }} />
              </label>
              <button type="button" aria-label="Remove shop image" onClick={() => { setShopImage(null); setShopImageError(""); if (shopImageInput.current) shopImageInput.current.value = ""; }} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50">Remove</button>
            </div>
          ) : (
            <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white px-3 py-2.5 transition hover:border-[#155F65]">
              <span className="text-stone-400">↑</span>
              <span className="font-normal text-stone-600">Choose PNG, JPG or WebP · max 10 MB</span>
              <input ref={shopImageInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const f = event.target.files?.[0] || null; if (f && f.size <= 0) { setShopImageError("The selected image is empty (0 bytes)."); return; } if (f && !["image/png","image/jpeg","image/webp"].includes(f.type)) { setShopImageError("Choose a PNG, JPG or WebP image."); return; } if (f && f.size > 10*1024*1024) { setShopImageError("Image must be under 10 MB."); return; } setShopImage(f); setShopImageError(""); }} />
            </label>
          )}
          {shopImageError && <p role="alert" className="text-xs font-semibold text-red-600">{shopImageError}</p>}
        </div>
        <label className="grid content-start text-xs font-bold md:col-span-2">Description<textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} className={inputClass} /></label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.fssaiRequired} onChange={(event) => updateForm("fssaiRequired", event.target.checked)} />FSSAI certificate is required for this business</label>
      {form.fssaiRequired && <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="grid content-start gap-1 text-xs font-bold">
          <label htmlFor="p0-fssai-number">FSSAI number</label>
          <input
            id="p0-fssai-number"
            required
            type="text"
            inputMode="numeric"
            maxLength={14}
            value={form.fssaiNumber}
            onChange={(event) => {
              const v = event.target.value.replace(/[^\d]/g, "").slice(0, 14);
              updateForm("fssaiNumber", v);
              if (fssaiError) setFssaiError("");
            }}
            onBlur={() => setFssaiError(fssaiFieldProblem(form.fssaiNumber, true) ?? "")}
            placeholder="14-digit FSSAI licence number"
            className={inputClass}
          />
          <span className="mt-0.5 font-normal text-stone-500">{form.fssaiNumber.length}/14 digits</span>
          {fssaiError && <p role="alert" className="text-xs font-semibold text-red-600">{fssaiError}</p>}
        </div>
        <div className="grid content-start gap-1 text-xs font-bold">
          <label htmlFor="p0-expiry-date">Expiry date</label>
          <input
            id="p0-expiry-date"
            required
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={form.expiryDate}
            onChange={(event) => { updateForm("expiryDate", event.target.value); if (expiryError) setExpiryError(""); }}
            onBlur={() => {
              const today = new Date().toISOString().slice(0, 10);
              setExpiryError(form.expiryDate && form.expiryDate < today ? "This certificate has expired." : "");
            }}
            className={inputClass}
          />
          {expiryError && <p role="alert" className="text-xs font-semibold text-red-600">{expiryError}</p>}
        </div>
        <div className="grid content-start gap-1 text-xs font-bold">
          <span>Certificate file (PDF only)</span>
          {certificate ? (
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5">
              <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-white shrink-0">✓</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-emerald-800">{certificate.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-stone-500">{(certificate.size / 1024).toFixed(0)} KB</span>
              <label className="cursor-pointer rounded-lg border border-stone-300 bg-white px-2 py-1 text-[11px] font-bold text-stone-700 hover:bg-stone-50">
                Replace
                <input ref={certInputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { const f = event.target.files?.[0]; if (!f) return; if (f.size <= 0 || /^blank[._-]/i.test(f.name)) { setCertError("The selected PDF file is empty (0 bytes)."); return; } if (f.type !== "application/pdf") { setCertError("Only PDF files are accepted."); return; } if (f.size > 10*1024*1024) { setCertError("File must be under 10 MB."); return; } setCertificate(f); setCertError(""); event.target.value = ""; }} />
              </label>
              <button type="button" aria-label="Remove certificate" onClick={() => { setCertificate(null); setCertError(""); if (certInputRef.current) certInputRef.current.value = ""; }} className="rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50">Remove</button>
            </div>
          ) : (
            <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white px-3 py-2.5 transition hover:border-[#155F65]">
              <span className="text-stone-400">↑</span>
              <span className="font-normal text-stone-600">PDF only · max 10 MB</span>
              <input ref={certInputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { const f = event.target.files?.[0] || null; if (!f) return; if (f.size <= 0 || /^blank[._-]/i.test(f.name)) { setCertError("The selected PDF file is empty (0 bytes)."); return; } if (f.type !== "application/pdf") { setCertError("Only PDF files are accepted."); return; } if (f.size > 10*1024*1024) { setCertError("File must be under 10 MB."); return; } setCertificate(f); setCertError(""); event.target.value = ""; }} />
            </label>
          )}
          {certError && <p role="alert" className="text-xs font-semibold text-red-600">{certError}</p>}
        </div>
      </div>}
      {(phoneError || waError || fssaiError || expiryError || certError) && (
        <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
          Correct the highlighted fields above before creating the vendor.
        </p>
      )}
      <button
        disabled={busy || Boolean(phoneError || waError || fssaiError || expiryError || certError)}
        className="mt-4 h-12 w-full rounded-full bg-[#155F65] px-5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Create pending P0 vendor"}
      </button>
    </form>}
    </div>
  </div>;
}
