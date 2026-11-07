"use client";
// Shell for the vendor, operations and super admin portals, built from the approved boards (V/O/A website, MV/MO/MA phone):
// a white sidebar with an orange active pill on a light-grey page on the website, and on phones a top bar,
// a four-tab bottom bar plus "More", and a full-screen menu.
import { Wordmark } from "@/components/brand";
import { useState, type ComponentType, type ReactNode } from "react";
import { Bell, HelpCircle, LogOut, Menu, X, LayoutDashboard, Eye, Store, MapPin, BadgeCheck } from "@/components/icons";

type Icon = ComponentType<{ className?: string }>;

/** The four bottom tabs per role (page names as the nav uses them); everything else sits under More. */
const PHONE_TABS: Record<string, string[]> = {
  vendor: ["Dashboard", "Orders", "Catalog", "Food Drops"],
  operations: ["Command centre", "Orders", "Vendor onboarding", "Ticket centre"],
  admin: ["Executive view", "Users", "Vendors", "Vendor plans"],
};
const TAB_LABEL: Record<string, string> = { Dashboard: "Home", "Command centre": "Home", "Executive view": "Home", "Vendor onboarding": "Vendors", "Ticket centre": "Tickets", "Vendor plans": "Plans", Catalog: "Catalogue" };

export function StaffShell({
  role,
  roleLabel,
  items,
  icons,
  active,
  onNavigate,
  unread,
  name,
  email,
  menuOpen,
  onMenu,
  onNotifications,
  onSignOut,
  onReplayTour,
  banner,
  counts,
  onOpenVendorProfile,
  vendor,
  children,
}: {
  role: string;
  roleLabel: string;
  items: string[];
  icons: Record<string, Icon>;
  active: string;
  onNavigate: (label: string) => void;
  unread: number;
  name: string;
  email: string;
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
  onNotifications: () => void;
  onSignOut: () => void;
  onReplayTour?: () => void;
  banner?: ReactNode;
  counts?: Record<string, number>;
  onOpenVendorProfile?: () => void;
  vendor?: { id: string; businessName: string; ownerName?: string; ownerRole?: string; category?: string };
  children: ReactNode;
}) {
  const [accountOpen, setAccountOpen] = useState(false);
  const tabs = (PHONE_TABS[role] ?? []).filter((t) => items.includes(t));
  const go = (label: string) => {
    onNavigate(label);
    onMenu(false);
    setAccountOpen(false);
  };
  const navButtons = items.map((label) => {
    const Icon = icons[label] ?? LayoutDashboard;
    return (
      <button
        key={label}
        type="button"
        data-tour-nav={label}
        aria-current={active === label ? "page" : undefined}
        onClick={() => go(label)}
        className={`k-nv${active === label ? " on" : ""}`}
      >
        <Icon className="size-[22px] shrink-0" />
        {label}
        {counts?.[label] ? <span className="cnt" style={{ marginLeft: "auto" }}>{counts[label]}</span> : null}
      </button>
    );
  });

  const accountMenu = (
    <div
      className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-2xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 text-stone-800"
      role="menu"
      aria-label="Account options"
    >
      <div className="flex items-start gap-3 border-b border-stone-100 pb-3">
        <div className="av o shrink-0" style={{ width: 40, height: 40, fontSize: 16 }}>
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-black text-sm text-[#202827]">{vendor?.businessName || name}</span>
          </div>
          {vendor?.ownerName && (
            <p className="truncate text-xs font-semibold text-[#155F65]">
              {vendor.ownerName} ({vendor.ownerRole || "Proprietor"})
            </p>
          )}
          <p className="truncate text-[11px] text-stone-500">{email}</p>
          <span className="mt-1 inline-block rounded-full bg-[#EAF4F2] px-2 py-0.5 text-[10px] font-bold text-[#155F65]">
            {roleLabel}
          </span>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {role === "vendor" && onOpenVendorProfile && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAccountOpen(false);
              onOpenVendorProfile();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-[#155F65] bg-[#EAF4F2]/70 hover:bg-[#EAF4F2] transition"
          >
            <Eye className="size-4 shrink-0 text-[#155F65]" />
            <span>View Public Store Profile</span>
          </button>
        )}

        {role === "vendor" && (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() => go("Vendor profile")}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-[#202827] hover:bg-stone-100 transition"
            >
              <Store className="size-4 shrink-0 text-stone-600" />
              <span>Edit Profile &amp; Branding</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => go("Store & radius")}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-[#202827] hover:bg-stone-100 transition"
            >
              <MapPin className="size-4 shrink-0 text-stone-600" />
              <span>Store Location &amp; Radius</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => go("Verification")}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-[#202827] hover:bg-stone-100 transition"
            >
              <BadgeCheck className="size-4 shrink-0 text-stone-600" />
              <span>Verification &amp; Compliance</span>
            </button>
          </>
        )}

        {role === "operations" && (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() => go("Command centre")}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-[#202827] hover:bg-stone-100 transition"
            >
              <LayoutDashboard className="size-4 shrink-0 text-stone-600" />
              <span>Command Centre</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => go("Vendor onboarding")}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-[#202827] hover:bg-stone-100 transition"
            >
              <BadgeCheck className="size-4 shrink-0 text-stone-600" />
              <span>Vendor Verification Queue</span>
            </button>
          </>
        )}

        {onReplayTour && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAccountOpen(false);
              onReplayTour();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-[#202827] hover:bg-stone-100 transition"
          >
            <HelpCircle className="size-4 shrink-0 text-stone-600" />
            <span>Help · Product tour</span>
          </button>
        )}

        <div className="my-1.5 border-t border-stone-200" />

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setAccountOpen(false);
            onSignOut();
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
        >
          <LogOut className="size-4 shrink-0 text-rose-600" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={`sh k-app${menuOpen ? " menu-open" : ""}`}>
      {accountOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] cursor-default"
          onClick={() => setAccountOpen(false)}
          aria-label="Close account menu"
        />
      )}
      <header className="k-mtop relative">
        <button
          type="button"
          className="ibtn w k-ring"
          onClick={() => onMenu(!menuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <span className="k-mttl"><Wordmark height={26} /></span>
        <span className="k-role k-role-m" data-label={roleLabel} aria-hidden="true" />
        <button
          type="button"
          className="ibtn w k-ring"
          onClick={onNotifications}
          aria-label="Notifications"
          style={{ position: "relative" }}
        >
          <Bell className="size-5" />
          {unread > 0 && <span className="cnt k-cnt">{unread}</span>}
        </button>
        <button
          type="button"
          onClick={() => setAccountOpen(!accountOpen)}
          className="av o cursor-pointer transition hover:opacity-90 active:scale-95 shrink-0"
          style={{ width: 34, height: 34, fontSize: 13 }}
          title={`${name} (${email})`}
          aria-label="User profile and account settings"
          aria-expanded={accountOpen}
        >
          {name.slice(0, 1).toUpperCase()}
        </button>
        {accountOpen && accountMenu}
      </header>

      {menuOpen && <button type="button" className="k-scrim" onClick={() => onMenu(false)} aria-label="Close navigation" />}

      <aside className="k-side">
        <div className="k-brand">
          <div>
            <Wordmark height={30} />
            <span>{roleLabel}</span>
          </div>
        </div>
        <nav aria-label="Portal" className="k-navlist">
          {navButtons}
          {onReplayTour && (
            <button
              type="button"
              className="k-nv"
              onClick={() => {
                onReplayTour();
                onMenu(false);
              }}
            >
              <HelpCircle className="size-[22px] shrink-0" />
              Help · Product tour
            </button>
          )}
        </nav>
        <div
          className="k-who cursor-pointer rounded-xl transition hover:bg-stone-50"
          onClick={() => setAccountOpen(!accountOpen)}
          role="button"
          tabIndex={0}
          aria-label="Account details"
        >
          <div className="av o">{name.slice(0, 1).toUpperCase()}</div>
          <div className="k-who-t">
            <b>{name}</b>
            <span>{email}</span>
          </div>
          <button
            type="button"
            className="ibtn sm"
            onClick={(e) => {
              e.stopPropagation();
              onSignOut();
            }}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </aside>

      <main className="k-main sp-portal-main">
        <div className="k-util relative">
          <span className="k-role">{roleLabel}</span>
          <button
            type="button"
            className="ibtn w k-ring"
            onClick={onNotifications}
            aria-label="Notifications"
            style={{ position: "relative" }}
          >
            <Bell className="size-5" />
            {unread > 0 && <span className="cnt k-cnt">{unread}</span>}
          </button>
          <button
            type="button"
            onClick={() => setAccountOpen(!accountOpen)}
            className="av o cursor-pointer transition hover:opacity-90 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#155F65]"
            title={`${name} (${email})`}
            aria-label="User profile and account settings"
            aria-expanded={accountOpen}
          >
            {name.slice(0, 1).toUpperCase()}
          </button>
          {accountOpen && accountMenu}
        </div>
        {banner}
        {children}
      </main>

      <nav aria-label="Quick tabs" className="k-tabs" aria-hidden={menuOpen || undefined}>
        {tabs.map((t) => {
          const Icon = icons[t] ?? LayoutDashboard;
          return (
            <button key={t} type="button" onClick={() => go(t)} className={active === t ? "on" : ""}>
              <span className="pl">
                <Icon className="size-7" />
              </span>
              {TAB_LABEL[t] ?? t}
            </button>
          );
        })}
        <button type="button" onClick={() => onMenu(true)} className={!tabs.includes(active) ? "on" : ""}>
          <span className="pl">
            <Menu className="size-7" />
          </span>
          More
        </button>
      </nav>
    </div>
  );
}
