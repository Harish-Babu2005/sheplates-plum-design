import { Fragment, useEffect, useMemo, useState } from "react";
import type * as React from "react";
import {
  Activity, ArrowRight, ChevronDown, ChevronRight, Download, RotateCcw, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadWorkbook } from "@/lib/excel-export";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { isLiveSupabaseMode } from "@/lib/supabase";
import {
  classifyAuditCategory,
  extractAuditChanges,
  loadAuditTrail,
  type TrailEvent,
} from "@/lib/audit-trail";

type VendorRef = {
  id: string;
  businessName: string;
};

export function AuditLog({ items, vendors = [] }: { items: TrailEvent[]; vendors?: VendorRef[] }) {
  const [kind, setKind] = useState<string>("All");
  const [auditQuery, setAuditQuery] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dbTrail, setDbTrail] = useState<TrailEvent[]>([]);
  const [trailError, setTrailError] = useState("");

  useEffect(() => {
    if (!isLiveSupabaseMode()) return;
    let alive = true;
    loadAuditTrail()
      .then((rows) => { if (alive) setDbTrail(rows); })
      .catch((e) => { if (alive) setTrailError(errorMessage(e, "The audit trail could not be loaded")); });
    return () => { alive = false; };
  }, []);

  const allItems = useMemo(() => {
    const seen = new Set<string>();
    const combined: TrailEvent[] = [];
    for (const item of [...items, ...dbTrail]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    }
    return combined;
  }, [items, dbTrail]);

  const categories = [
    "All",
    "Permissions",
    "Vendors",
    "Plans and pricing",
    "Vendor Verification",
    "Vendor Creation",
    "Team User Management",
    "Other",
  ] as const;

  const actorOptions = useMemo(() => {
    const actors = new Map<string, string>();
    for (const item of allItems) {
      const name = item.actorName || (item.actor.includes(" · ") ? item.actor.split(" · ")[0] : item.actor);
      const email = item.actorEmail || "";
      const label = email ? `${name} (${email})` : name;
      if (name) actors.set(name, label);
    }
    return Array.from(actors.entries()).map(([value, label]) => ({ value, label }));
  }, [allItems]);

  const vendorOptions = useMemo(() => {
    const vMap = new Map<string, string>();
    for (const v of vendors) {
      vMap.set(v.id, v.businessName);
    }
    for (const item of allItems) {
      if (item.vendorName) {
        vMap.set(item.entityId || item.vendorName, item.vendorName);
      }
    }
    return Array.from(vMap.entries()).map(([id, name]) => ({ id, name }));
  }, [vendors, allItems]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasActiveFilters = Boolean(
    kind !== "All" ||
    auditQuery.trim() ||
    actorFilter !== "all" ||
    vendorFilter !== "all" ||
    fromDate ||
    toDate
  );

  const resetFilters = () => {
    setKind("All");
    setAuditQuery("");
    setActorFilter("all");
    setVendorFilter("all");
    setFromDate("");
    setToDate("");
  };

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const cat = item.category || classifyAuditCategory(item.action, item.detail);
      if (kind !== "All" && cat !== kind) return false;

      if (actorFilter !== "all") {
        const itemActor = item.actorName || (item.actor.includes(" · ") ? item.actor.split(" · ")[0] : item.actor);
        if (itemActor !== actorFilter) return false;
      }

      if (vendorFilter !== "all") {
        const matchesId = item.entityId === vendorFilter;
        const matchesName = item.vendorName && vendorOptions.some((v) => v.id === vendorFilter && v.name === item.vendorName);
        if (!matchesId && !matchesName) return false;
      }

      if (fromDate || toDate) {
        const rawDate = item.timestamp ? new Date(item.timestamp) : new Date(item.at);
        const itemDay = !isNaN(rawDate.getTime()) ? rawDate.toISOString().slice(0, 10) : item.at.slice(0, 10);
        if (fromDate && itemDay < fromDate) return false;
        if (toDate && itemDay > toDate) return false;
      }

      if (auditQuery.trim()) {
        const q = auditQuery.trim().toLowerCase();
        const searchable = `${item.actor} ${item.actorName || ""} ${item.actorEmail || ""} ${item.action} ${item.detail} ${item.vendorName || ""} ${item.entityId || ""}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      return true;
    });
  }, [allItems, kind, actorFilter, vendorFilter, fromDate, toDate, auditQuery, vendorOptions]);

  function download() {
    const rows = filteredItems.map((item) => {
      const changes = item.changes || extractAuditChanges(item.beforeData, item.afterData);
      const changesSummary = changes.map((c) => `${c.field}: ${c.previousValue} -> ${c.newValue}`).join("; ");
      const before = item.beforeData as Record<string, unknown> | undefined;
      const after = item.afterData as Record<string, unknown> | undefined;

      return {
        "Audit ID": item.id,
        "Timestamp": item.timestamp || item.at,
        "When": item.at,
        "Actor Name": item.actorName || (item.actor.includes(" · ") ? item.actor.split(" · ")[0] : item.actor),
        "Actor Email": item.actorEmail || "",
        "Actor Role": item.actorRole || (item.actor.includes(" · ") ? item.actor.split(" · ")[1] : "Operations"),
        "Action": item.action,
        "Category": item.category || classifyAuditCategory(item.action, item.detail),
        "Entity Type": item.entityType || "vendor",
        "Entity ID": item.entityId || "",
        "Vendor Name": item.vendorName || "",
        "Summary": item.detail,
        "Previous Plan": String(before?.planName || before?.plan || ""),
        "New Plan": String(after?.planName || after?.plan || ""),
        "Previous Price": String(before?.formattedPrice || (before?.monthlyPrice ? `₹${before.monthlyPrice}/month` : "")),
        "New Price": String(after?.formattedPrice || (after?.monthlyPrice ? `₹${after.monthlyPrice}/month` : "")),
        "Previous Status": String(before?.status || ""),
        "New Status": String(after?.status || ""),
        "Reason": String(after?.reason || item.reason || ""),
        "Changes": changesSummary,
      };
    });
    downloadWorkbook("sheplates-audit-log", [{ name: "Audit log", rows }]);
    toast.success(`Audit log exported (${rows.length} records)`);
  }

  return (
    <div className="space-y-5">
      <div className="sp-page-heading flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="sr-only">AUDITABILITY</p>
          <h1 className="text-[28px] font-bold leading-[1.15] tracking-[-.01em]">Platform activity trail</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#55656A]">
            Who did what, and when. Vendor plans, verification, pricing, catalogue, schedule and team management actions are recorded.
          </p>
        </div>
        <Button variant="outline" onClick={download} disabled={!filteredItems.length}>
          <Download className="mr-2 size-4" />Download Excel
        </Button>
      </div>
      {trailError && <p role="alert" className="rounded-3xl bg-[#FFF4CF] p-4 text-sm font-medium text-[#795900]">{trailError}</p>}

      {/* Action Category Tabs */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Kind of action">
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={kind === name}
            onClick={() => setKind(name)}
            className={`h-9 rounded-full px-4 text-xs font-semibold transition-colors ${
              kind === name ? "bg-[#155F65] text-white" : "bg-white text-[#2F3C3F] hover:bg-stone-100"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="surface-card grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Actor</label>
          <Select value={actorFilter} onValueChange={setActorFilter}>
            <SelectTrigger className="mt-1 h-9 rounded-xl bg-white text-xs">
              <SelectValue placeholder="All Actors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actors</SelectItem>
              {actorOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Vendor</label>
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="mt-1 h-9 rounded-xl bg-white text-xs">
              <SelectValue placeholder="All Vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendorOptions.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs outline-none focus:border-[#155F65]"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs outline-none focus:border-[#155F65]"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Search</label>
          <div className="relative mt-1">
            <input
              value={auditQuery}
              onChange={(e) => setAuditQuery(e.target.value)}
              placeholder="Vendor, actor, action..."
              aria-label="Search actor or action"
              className="h-9 w-full rounded-xl border border-stone-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-[#155F65]"
            />
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-stone-400" />
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between text-xs text-stone-600 px-1">
          <span>Showing <b>{filteredItems.length}</b> of {allItems.length} audit event(s) matching current filters</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-7 text-xs font-semibold text-[#155F65] hover:text-[#0F4A4F]"
          >
            <RotateCcw className="mr-1 size-3.5" />Reset Filters
          </Button>
        </div>
      )}

      {/* Audit Table */}
      {filteredItems.length ? (
        <div className="surface-card overflow-x-auto rounded-3xl p-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const isExpanded = expandedIds.has(item.id);
                const changes = item.changes || extractAuditChanges(item.beforeData, item.afterData);
                const actorName = item.actorName || (item.actor.includes(" · ") ? item.actor.split(" · ")[0] : item.actor);
                const actorRole = item.actorRole || (item.actor.includes(" · ") ? item.actor.split(" · ")[1] : "Operations");
                const before = item.beforeData as Record<string, unknown> | undefined;
                const after = item.afterData as Record<string, unknown> | undefined;

                return (
                  <Fragment key={item.id}>
                    <TableRow
                      onClick={() => toggleExpand(item.id)}
                      className="cursor-pointer hover:bg-stone-50/80 transition-colors"
                      data-testid={`audit-row-${item.id}`}
                    >
                      <TableCell className="w-8 p-2">
                        <button
                          type="button"
                          aria-label={isExpanded ? "Collapse row" : "Expand row"}
                          onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }}
                          className="grid size-6 place-items-center rounded-md hover:bg-stone-200 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4 text-stone-600" />
                          ) : (
                            <ChevronRight className="size-4 text-stone-600" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-stone-500 font-mono">
                        {item.at}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#C5E3E4] text-[11px] font-bold text-[#155F65]">
                            {actorName.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate max-w-[150px]">{actorName}</div>
                            {item.actorEmail && (
                              <div className="text-[11px] text-stone-400 truncate max-w-[150px]">{item.actorEmail}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          actorRole.toLowerCase().includes("super")
                            ? "bg-purple-100 text-purple-800"
                            : actorRole.toLowerCase().includes("admin")
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {actorRole}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.action === "Vendor Plan Updated"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-stone-100 text-stone-700"
                        }`}>
                          {item.action}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 max-w-[180px]">
                          {item.vendorName ? (
                            <div className="font-semibold text-xs text-stone-800 truncate">{item.vendorName}</div>
                          ) : item.entityId ? (
                            <div className="font-mono text-[11px] text-stone-500 truncate">{item.entityId}</div>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[#2F3C3F] max-w-[280px]">
                        <div className="truncate" title={item.detail}>{item.detail}</div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable Details Container */}
                    {isExpanded && (
                      <TableRow className="bg-[#F8FAF9] hover:bg-[#F8FAF9]">
                        <TableCell colSpan={7} className="p-4 sm:p-6 border-b border-stone-200">
                          <div className="space-y-4">
                            {/* General Information Grid */}
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                                General Information
                              </h4>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 bg-white p-4 rounded-2xl border border-stone-200">
                                <div>
                                  <div className="text-[11px] text-stone-400 font-medium">Action</div>
                                  <div className="text-sm font-bold text-stone-800 mt-0.5">{item.action}</div>
                                </div>
                                <div>
                                  <div className="text-[11px] text-stone-400 font-medium">Performed By</div>
                                  <div className="text-sm font-semibold text-stone-800 mt-0.5 break-all">
                                    {actorName} {item.actorEmail ? `(${item.actorEmail})` : ""}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px] text-stone-400 font-medium">Actor Role</div>
                                  <div className="text-sm font-semibold text-stone-800 mt-0.5">{actorRole}</div>
                                </div>
                                <div>
                                  <div className="text-[11px] text-stone-400 font-medium">Timestamp</div>
                                  <div className="text-xs font-mono text-stone-700 mt-0.5 break-all">
                                    {item.at} {item.timestamp ? `· ${item.timestamp}` : ""}
                                  </div>
                                </div>
                                <div className="sm:col-span-2">
                                  <div className="text-[11px] text-stone-400 font-medium">Entity Type &amp; ID</div>
                                  <div className="text-xs font-mono text-stone-700 mt-0.5 break-all">
                                    <span className="font-semibold uppercase tracking-wider text-stone-500">
                                      {item.entityType || "vendor"}
                                    </span>
                                    : {item.entityId || "N/A"}
                                  </div>
                                </div>
                                <div className="sm:col-span-2">
                                  <div className="text-[11px] text-stone-400 font-medium">Category</div>
                                  <div className="text-xs font-semibold text-stone-700 mt-0.5">
                                    {item.category || classifyAuditCategory(item.action, item.detail)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Change Information (Before vs After) */}
                            {changes.length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                                  Change Information
                                </h4>
                                <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-stone-50">
                                        <TableHead className="text-xs font-bold text-stone-600">Field</TableHead>
                                        <TableHead className="text-xs font-bold text-stone-600">Previous Value</TableHead>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead className="text-xs font-bold text-stone-600">New Value</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {changes.map((c, i) => (
                                        <TableRow key={i}>
                                          <TableCell className="font-semibold text-xs text-stone-700">{c.field}</TableCell>
                                          <TableCell className="text-xs text-rose-600 line-through font-mono break-all">
                                            {c.previousValue}
                                          </TableCell>
                                          <TableCell className="w-8 text-center text-stone-400">
                                            <ArrowRight className="size-3.5 inline" />
                                          </TableCell>
                                          <TableCell className="text-xs font-bold text-emerald-700 font-mono break-all">
                                            <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                              {c.newValue}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            {/* Additional Context */}
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                                Additional Context
                              </h4>
                              <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2 text-xs">
                                {item.vendorName && (
                                  <div>
                                    <span className="text-stone-400 font-medium">Vendor Name:</span>{" "}
                                    <span className="font-bold text-stone-800 break-words">{item.vendorName}</span>
                                  </div>
                                )}
                                {Boolean(item.reason || after?.reason) && (
                                  <div>
                                    <span className="text-stone-400 font-medium">Reason / Remarks:</span>{" "}
                                    <span className="text-stone-800 italic break-words">{String(item.reason || after?.reason)}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-stone-400 font-medium">Full Summary:</span>{" "}
                                  <span className="text-stone-700 break-words">{item.detail}</span>
                                </div>
                                {(before || after) && (
                                  <details className="mt-2 text-[11px] text-stone-500">
                                    <summary className="cursor-pointer font-semibold hover:text-stone-800">
                                      Raw Metadata Snapshot
                                    </summary>
                                    <pre className="mt-1.5 p-2 rounded-xl bg-stone-50 overflow-x-auto text-[10px] font-mono border border-stone-200 break-all whitespace-pre-wrap">
                                      {JSON.stringify({ before: item.beforeData, after: item.afterData }, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="surface-card sp-empty-state rounded-[28px] border border-dashed p-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#EAF4F2] text-[#155F65]">
            <Activity className="size-7" />
          </div>
          <h3 className="mt-4 font-black">{hasActiveFilters ? "No matching audit events" : "No audit events"}</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">
            {hasActiveFilters ? "Try adjusting or resetting your search and filter criteria." : "Actions across the platform will appear here."}
          </p>
        </div>
      )}
    </div>
  );
}
