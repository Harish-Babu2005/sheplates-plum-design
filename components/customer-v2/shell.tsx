"use client";
// Navigation chrome for the customer portal, built from the approved boards (W07 website, C07 phone):
// a top bar (logo, delivery area, search, She Agent, wishlist, alerts, cart, account), a menu row on
// desktop/tablet, a floating bottom pill on phones, and a footer with the legal and support details.
import { Wordmark } from "@/components/brand";
import { Heart, Bell, ShoppingBag, MapPin, ChevronDown, Search, Sparkles, SlidersHorizontal, Home, Zap, Play, ReceiptText, UserRound, CalendarDays, ClipboardCheck, ListChecks, TicketCheck, HelpCircle, LogOut, Package, HeartPulse, MapPinned, Storefront, LocateFixed } from "@/components/icons";
import type { ComponentType, ReactNode } from "react";
import { CustomerSearchBar } from "./search-bar";
import type { Product, Vendor } from "@/components/sheplates-v3";
import type { CustomerLocationProfile } from "@/lib/marketplace-search";

type Icon = ComponentType<{ className?: string }>;

/** Menu row (desktop/tablet). `key` is the page name the app routes on. */
export const CUSTOMER_MENU: { key: string; label: string; icon: Icon }[] = [
  { key: "Marketplace", label: "Home", icon: Home },
  { key: "Search", label: "Marketplace", icon: Storefront },
  { key: "Food Drops", label: "Food Drops", icon: Zap },
  { key: "Stories", label: "Stories", icon: Play },
  { key: "Maps", label: "Maps", icon: MapPinned },
  { key: "My schedule", label: "Schedules", icon: CalendarDays },
  { key: "Orders", label: "Orders", icon: ReceiptText },
  { key: "My quotations", label: "Quotations", icon: ClipboardCheck },
];

/** Bottom pill (phones): the five places used every day. */
export const CUSTOMER_PHONE_TABS: { key: string; label: string; icon: Icon }[] = [
  { key: "Marketplace", label: "Home", icon: Home },
  { key: "Maps", label: "Maps", icon: MapPinned },
  { key: "Stories", label: "Stories", icon: Play },
  { key: "Orders", label: "Orders", icon: ReceiptText },
  { key: "Profile", label: "Profile", icon: UserRound },
];

const PROFILE_PAGES = ["Profile", "Profile & food", "Wishlist", "Monthly requirement", "Ticket centre"];
const ALIAS: Record<string, string> = { Schedules: "My schedule" };

/** Page name as the menu knows it (legacy names keep working as deep links). */
export const tabOf = (active: string) => ALIAS[active] ?? active;

const ACCOUNT_LINKS: [string, Icon][] = [
  ["Profile", UserRound],
  ["Profile & food", HeartPulse],
  ["Wishlist", Heart],
  ["Orders", Package],
  ["My schedule", CalendarDays],
  ["Monthly requirement", ListChecks],
  ["My quotations", ClipboardCheck],
  ["Ticket centre", TicketCheck],
];

export function CustomerHeader({
  active,
  name,
  email,
  area,
  unread,
  cartCount,
  accountOpen,
  onToggleAccount,
  onNavigate,
  onAgent,
  onNotifications,
  onLocation,
  onReplayTour,
  onSignOut,
  searchQuery = "",
  onSearchQueryChange,
  onNavigateToSearch,
  onOpenProduct,
  onOpenVendor,
  onSelectCategory,
  onToggleFilters,
  activeFilterCount = 0,
  products = [],
  vendors = [],
  profile = null,
  locationConfirmed = true,
  markups = {},
}: {
  active: string;
  name: string;
  email: string;
  area: string;
  unread: number;
  cartCount: number;
  accountOpen: boolean;
  onToggleAccount: () => void;
  onNavigate: (key: string) => void;
  onAgent: () => void;
  onNotifications: () => void;
  onLocation: () => void;
  onReplayTour: () => void;
  onSignOut: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  onNavigateToSearch?: (q: string) => void;
  onOpenProduct?: (product: Product) => void;
  onOpenVendor?: (vendorId: string) => void;
  onSelectCategory?: (category: string) => void;
  onToggleFilters?: () => void;
  activeFilterCount?: number;
  products?: Product[];
  vendors?: Vendor[];
  profile?: CustomerLocationProfile | null;
  locationConfirmed?: boolean;
  markups?: Record<string, number>;
}) {
  const current = tabOf(active);
  const initials = name.slice(0, 2).toUpperCase();
  return <header className="sh k-head">
    <div className="k-top">
      <button type="button" className="k-logo" onClick={() => onNavigate("Marketplace")} aria-label="Sheplates home"><Wordmark height={32} /></button>
      <button
        type="button"
        data-tour="location"
        onClick={onLocation}
        className={`k-loc ${!locationConfirmed ? "bg-amber-50 text-amber-900 ring-1 ring-amber-300" : ""}`}
        aria-label={`Delivery area: ${locationConfirmed ? area : "Confirm your delivery location"}`}
      >
        {locationConfirmed ? (
          <MapPin className="size-5 shrink-0 text-[#155F65]" />
        ) : (
          <LocateFixed className="size-5 shrink-0 text-amber-700" />
        )}
        <span className="k-loc-t">{locationConfirmed ? area : "Confirm delivery location"}</span>
        <ChevronDown className="size-4 shrink-0" />
      </button>

      <CustomerSearchBar
        query={searchQuery}
        onQueryChange={onSearchQueryChange ?? (() => undefined)}
        onNavigateToSearch={onNavigateToSearch ?? (() => onNavigate("Search"))}
        onOpenProduct={onOpenProduct ?? (() => undefined)}
        onOpenVendor={onOpenVendor ?? (() => undefined)}
        onSelectCategory={onSelectCategory ?? (() => undefined)}
        onToggleFilters={onToggleFilters ?? (() => onNavigate("Search"))}
        activeFilterCount={activeFilterCount}
        products={products}
        vendors={vendors}
        profile={profile}
        markups={markups}
      />

      <div className="k-actions">
        <button type="button" data-tour="agent" onClick={onAgent} className="btn sm dark k-agent" aria-label="Open She Agent"><Sparkles className="size-5" /><span>She Agent</span></button>
        <button type="button" onClick={() => onNavigate("Wishlist")} className="ibtn w k-ring k-wish" aria-label="Wishlist"><Heart className="size-5" /></button>
        <button type="button" onClick={onNotifications} className="ibtn w k-ring" aria-label="Notifications" style={{ position: "relative" }}><Bell className="size-5" />{unread > 0 && <span className="cnt k-cnt">{unread}</span>}</button>
        <button type="button" data-tour="cart" onClick={() => onNavigate("Cart")} className="ibtn o" aria-label={`Cart, ${cartCount} items`} title="Cart" style={{ position: "relative" }}><ShoppingBag className="size-5" />{cartCount > 0 && <span className="cnt k-cnt">{cartCount}</span>}</button>
        <div className="k-acct">
          <button type="button" data-tour="account" onClick={onToggleAccount} aria-label="Account menu" aria-expanded={accountOpen} className="av o k-av">{initials}</button>
          {accountOpen && <div className="k-menu">
            <div className="k-menu-id"><b>{name}</b><span className="s m">{email}</span></div>
            {ACCOUNT_LINKS.map(([label, Icon]) => <button key={label} type="button" onClick={() => onNavigate(label)}><Icon className="size-5" />{label}</button>)}
            <button type="button" onClick={onReplayTour}><HelpCircle className="size-5" />Help · Product tour</button>
            <button type="button" onClick={onSignOut} className="k-out"><LogOut className="size-5" />Sign out</button>
          </div>}
        </div>
      </div>
    </div>
    <nav data-tour="nav-tabs" aria-label="Primary" className="k-menurow">
      {CUSTOMER_MENU.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-current={current === key ? "page" : undefined} onClick={() => onNavigate(key)} className={current === key ? "on" : ""}><Icon className="size-5" />{label}</button>)}
    </nav>
  </header>;
}

export function CustomerBottomNav({ active, onNavigate, onAgent }: { active: string; onNavigate: (key: string) => void; onAgent: () => void }) {
  const current = tabOf(active);
  const onProfile = PROFILE_PAGES.includes(current);
  return <>
    <button type="button" data-tour="agent-mobile" onClick={onAgent} aria-label="Open She Agent" className="k-fab"><Sparkles className="size-6" /></button>
    <nav data-tour="nav-tabs-mobile" aria-label="Primary" className="sh k-pill">
      {CUSTOMER_PHONE_TABS.map(({ key, label, icon: Icon }) => {
        const on = key === "Profile" ? onProfile : current === key;
        return <button key={key} type="button" aria-label={label} data-tour={key === "Profile" ? "account-mobile" : undefined} aria-current={on ? "page" : undefined} onClick={() => onNavigate(key)} className={on ? "it on" : "it"}><Icon className="size-7" />{on && <span>{label}</span>}</button>;
      })}
    </nav>
  </>;
}

export function CustomerFooter(): ReactNode {
  return <footer className="sh k-foot">
    <div className="row g8"><div><Wordmark height={34} /><div className="s" style={{ color: "#D9F5E7", marginTop: 4 }}>Home meals, made simple</div></div></div>
    <div className="fl">
      <span>Terms and Conditions</span>
      <span>Privacy Policy</span>
      <a href="tel:+919600037836">Support: 9600037836</a>
      <a href="mailto:support@sheplates.com">support@sheplates.com</a>
      <span>Every day, 9:30 AM to 7 PM</span>
    </div>
  </footer>;
}
