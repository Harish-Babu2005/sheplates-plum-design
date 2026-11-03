"use client";
// Stories monitor (O14): reported customer statuses and vendor Food Shorts in one place for Operations and Super Admin.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { isLiveSupabaseMode } from "@/lib/supabase";
import { Play, Eye, X } from "@/components/icons";
import { keepMonitorStatus, loadMonitorShorts, loadMonitorStatuses, loadMonitorSummary, removeMonitorStatus, setMonitorShortStatus, type MonitorFilter, type MonitorShort, type MonitorStatus, type MonitorSummary } from "@/lib/stories-monitor";

const FILTERS: [MonitorFilter, string][] = [["reported", "Reported"], ["newest", "Newest"], ["most_viewed", "Most viewed"]];
const TILE = ["#FFE3C4", "#FFF4CF", "#E3F8E3", "#E6EEFE", "#FFE9E9"];

function ago(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : `${Math.round(minutes / 1440)} d ago`;
}

export function StoriesMonitor() {
  const live = isLiveSupabaseMode();
  const [tab, setTab] = useState<"statuses" | "shorts">("statuses");
  const [filter, setFilter] = useState<MonitorFilter>("reported");
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [statuses, setStatuses] = useState<MonitorStatus[]>([]);
  const [shorts, setShorts] = useState<MonitorShort[]>([]);
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<MonitorStatus | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!live) return;
    setLoading(true); setError("");
    try {
      const [sum, list, clips] = await Promise.all([loadMonitorSummary(), loadMonitorStatuses(filter), loadMonitorShorts()]);
      setSummary(sum); setStatuses(list); setShorts(clips);
    } catch (e) { setError(e instanceof Error ? e.message : "The Stories monitor could not be loaded"); }
    finally { setLoading(false); }
  }, [live, filter]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try { await removeMonitorStatus(removing.id, reason); toast.success("Status removed. The author was told why."); setRemoving(null); setReason(""); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "The status could not be removed"); }
    finally { setBusy(false); }
  }
  async function keep(item: MonitorStatus) {
    try { await keepMonitorStatus(item.id); toast.success("Kept. The reports were cleared."); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not update the status"); }
  }
  async function setShort(item: MonitorShort, status: "active" | "hidden" | "removed") {
    try { await setMonitorShortStatus(item.id, status); toast.success(status === "active" ? "Food Short is visible again" : status === "hidden" ? "Food Short hidden" : "Food Short removed"); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not update the Food Short"); }
  }

  const cards = summary ? [["Live statuses", summary.liveStatuses, "expire within 24 h"], ["Food Shorts live", summary.foodShortsLive, ""], ["Reported", summary.reported, summary.reported ? "Review now" : "Nothing to review"], ["Removed this week", summary.removedThisWeek, ""]] as const : [];

  return <div className="space-y-5">
    <div><h1 className="text-[28px] font-bold leading-tight">Stories monitor</h1><p className="mt-1 text-sm text-[#66666B]">Customer statuses and vendor Food Shorts in one place. Remove anything that breaks the community rules.</p></div>
    {!live && <p className="rounded-3xl bg-[#FFF4CF] p-4 text-sm font-medium text-[#7A5A00]">The monitor reads the live community database. In demo mode there is nothing to moderate. After running supabase/V9_13_STORIES_MONITOR.sql, it works with your live data.</p>}
    {error && <p role="alert" className="rounded-3xl bg-[#FFE9E9] p-4 text-sm font-medium text-[#C20000]">{error}</p>}
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="What to review">
      <button type="button" role="tab" aria-selected={tab === "statuses"} onClick={() => setTab("statuses")} className={`h-10 rounded-full px-4 text-sm font-semibold ${tab === "statuses" ? "bg-[#FF7B00] text-[#0A0A0A]" : "bg-white text-[#404040]"}`}>Customer statuses</button>
      <button type="button" role="tab" aria-selected={tab === "shorts"} onClick={() => setTab("shorts")} className={`h-10 rounded-full px-4 text-sm font-semibold ${tab === "shorts" ? "bg-[#FF7B00] text-[#0A0A0A]" : "bg-white text-[#404040]"}`}>Vendor Food Shorts</button>
    </div>
    {cards.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, note]) => <div key={label} className="surface-card rounded-3xl p-5"><div className="text-[13px] text-[#66666B]">{label}</div><div className="mt-1 text-[28px] font-bold leading-none tabular-nums">{value}</div>{note && <div className={`mt-3 text-xs font-semibold ${label === "Reported" && summary?.reported ? "text-[#C20000]" : "text-[#66666B]"}`}>{note}</div>}</div>)}</div>}

    {tab === "statuses" && <>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Order of statuses">{FILTERS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className={`h-10 rounded-full px-4 text-sm font-semibold ${filter === key ? "bg-[#FFF0E0] text-[#0A0A0A] ring-2 ring-[#FF7B00]" : "bg-white text-[#404040]"}`}>{label}{key === "reported" && summary ? ` · ${summary.reported}` : ""}</button>)}</div>
      {loading ? <p role="status" className="text-sm text-[#66666B]">Loading statuses…</p> : statuses.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statuses.map((item, index) => <article key={item.id} className="surface-card overflow-hidden rounded-3xl">
        <div className="relative grid h-44 place-items-center" style={{ background: item.thumbUrl || item.kind === "photo" ? undefined : TILE[index % TILE.length] }}>
          {item.thumbUrl || (item.kind === "photo" && item.mediaUrl) ? <img src={item.thumbUrl || item.mediaUrl} alt="" className="h-full w-full object-cover" /> : <Play className="size-10 text-[#66666B]" />}
          {item.reportCount > 0 && <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#C20000]">{item.reportCount} report{item.reportCount === 1 ? "" : "s"}</span>}
        </div>
        <div className="space-y-2 p-4"><div className="text-sm font-semibold">@{item.authorHandle} · {ago(item.createdAt)}</div>{item.caption && <p className="text-xs text-[#404040]">&ldquo;{item.caption}&rdquo;</p>}{item.lastReason && <p className="text-xs text-[#C20000]">Reported: {item.lastReason}</p>}<div className="flex items-center gap-1 text-xs text-[#66666B]"><Eye className="size-4" />Viewed {item.viewCount} times · expires {ago(item.expiresAt).replace(" ago", "")}</div>
          <div className="flex flex-wrap gap-2 pt-1"><button type="button" onClick={() => { setRemoving(item); setReason(item.lastReason || ""); }} className="h-9 rounded-full bg-white px-4 text-sm font-semibold text-[#C20000] ring-1 ring-[#F3B8B8]">Remove</button>{item.reportCount > 0 && <button type="button" onClick={() => void keep(item)} className="h-9 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-[#E7E7EA]">Keep</button>}<a href={item.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-[#E7E7EA]">Open</a></div></div>
      </article>)}</div> : <p className="rounded-3xl bg-white p-6 text-sm text-[#66666B]">{live ? (filter === "reported" ? "No reported statuses right now." : "No live statuses.") : "No statuses to show in demo mode."}</p>}
    </>}

    {tab === "shorts" && (loading ? <p role="status" className="text-sm text-[#66666B]">Loading Food Shorts…</p> : shorts.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{shorts.map((item, index) => <article key={item.id} className="surface-card overflow-hidden rounded-3xl">
      <div className="relative grid h-44 place-items-center" style={{ background: item.thumbUrl ? undefined : TILE[index % TILE.length] }}>{item.thumbUrl ? <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" /> : <Play className="size-10 text-[#66666B]" />}<span className="absolute bottom-3 left-3 rounded-full bg-[#0A0A0A]/80 px-3 py-1 text-xs font-semibold text-white">0:{String(Math.round(item.durationS)).padStart(2, "0")}</span>{item.status === "hidden" && <span className="absolute left-3 top-3 rounded-full bg-[#FFF4CF] px-3 py-1 text-xs font-semibold text-[#7A5A00]">Hidden</span>}</div>
      <div className="space-y-2 p-4"><div className="text-sm font-semibold">{item.vendorName} · {item.title}</div>{item.caption && <p className="text-xs text-[#404040]">&ldquo;{item.caption}&rdquo;</p>}<div className="text-xs text-[#66666B]">Viewed {item.viewCount} times · {ago(item.createdAt)}</div>
        <div className="flex flex-wrap gap-2 pt-1">{item.status === "hidden" ? <button type="button" onClick={() => void setShort(item, "active")} className="h-9 rounded-full bg-[#FF7B00] px-4 text-sm font-bold text-[#0A0A0A]">Show again</button> : <button type="button" onClick={() => void setShort(item, "hidden")} className="h-9 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-[#E7E7EA]">Hide</button>}<button type="button" onClick={() => void setShort(item, "removed")} className="h-9 rounded-full bg-white px-4 text-sm font-semibold text-[#C20000] ring-1 ring-[#F3B8B8]">Remove</button><a href={item.videoUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-[#E7E7EA]">Open</a></div></div>
    </article>)}</div> : <p className="rounded-3xl bg-white p-6 text-sm text-[#66666B]">{live ? "No Food Shorts to review." : "No Food Shorts to show in demo mode."}</p>)}

    <p className="rounded-3xl bg-[#E6EEFE] p-4 text-sm font-medium text-[#0A44B8]">Statuses disappear on their own after 24 hours. Removing one hides it at once and the author is told why.</p>

    {removing && <div role="dialog" aria-modal="true" aria-label="Remove status" className="fixed inset-0 z-[300] grid place-items-center bg-[#0A0A0A]/50 p-4">
      <div className="w-full max-w-md space-y-3 rounded-[28px] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Remove this status?</h2><p className="mt-1 text-sm text-[#66666B]">@{removing.authorHandle} will be told why it was removed.</p></div><button type="button" onClick={() => setRemoving(null)} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-[#F4F4F4]"><X className="size-5" /></button></div>
        <label className="block text-sm font-semibold text-[#404040]">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} rows={3} placeholder="For example: it shows someone without their permission" className="mt-2 w-full rounded-3xl bg-[#F4F4F4] p-4 text-sm outline-none" /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setRemoving(null)} className="h-11 rounded-full bg-[#F4F4F4] px-5 text-sm font-semibold">Cancel</button><button type="button" disabled={busy} onClick={() => void confirmRemove()} className="h-11 rounded-full bg-[#C20000] px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Removing…" : "Remove status"}</button></div>
      </div>
    </div>}
  </div>;
}
