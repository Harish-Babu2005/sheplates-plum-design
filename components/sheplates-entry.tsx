"use client";
/* eslint-disable @next/next/no-img-element */

import { Wordmark } from "@/components/brand";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import {
  Activity, ArrowRight, BadgeCheck, ChevronRight, LocateFixed, MapPin,
  Search, ShieldCheck, Sparkles, Upload, X, Milk, Soup, ShoppingBag, CalendarDays, Truck,
} from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { categories, categoryVisual, plans, vendors } from "@/lib/sheplates-data";
import { demoAccounts, type DemoSession } from "@/lib/sheplates-v2-data";
import {
  getLiveAuthSession,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  liveSignIn,
  liveSignInWithGoogle,
  liveSignUp,
  resendVerificationEmail,
  saveLiveCustomerPrivacy,
  sendPasswordResetEmail,
} from "@/lib/supabase";

function MailIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

type Audience = "customer" | "team";
type AuthMode = "login" | "create" | "forgot";

// Kept in sync with STAFF_KEY / StaffAccount in sheplates-v3.tsx — a Super Admin
// "Create user" without Supabase configured stores the account here so it can sign in.
const LOCAL_STAFF_KEY = "sheplates-v3-staff-accounts";
const LOCAL_CUSTOMER_KEY = "sheplates-v3-customer-accounts";
const LOCAL_VENDOR_KEY = "sheplates-v3-vendor-accounts";
type LocalStaffAccount = { email: string; name: string; role: "operations" | "admin"; password: string; active: boolean };
function readLocalStaffAccount(email: string, password: string): LocalStaffAccount | null {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_STAFF_KEY) || "[]") as LocalStaffAccount[];
    return list.find((account) => account.active !== false && account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password) || null;
  } catch { return null; }
}
type LocalCustomerAccount = {
  email: string;
  name: string;
  passwordSalt: string;
  passwordHash: string;
  privateAccount: boolean;
  active: boolean;
};
function isLocalCustomerAccount(value: unknown): value is LocalCustomerAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Record<string, unknown>;
  return typeof account.email === "string" &&
    typeof account.name === "string" &&
    typeof account.passwordSalt === "string" && /^[a-f\d]{32}$/i.test(account.passwordSalt) &&
    typeof account.passwordHash === "string" && /^[a-f\d]{64}$/i.test(account.passwordHash) &&
    typeof account.privateAccount === "boolean" &&
    typeof account.active === "boolean";
}
function readLocalCustomerAccounts(): LocalCustomerAccount[] {
  try {
    const stored = localStorage.getItem(LOCAL_CUSTOMER_KEY);
    if (!stored) return [];
    const accounts: unknown = JSON.parse(stored);
    if (!Array.isArray(accounts) || !accounts.every(isLocalCustomerAccount)) {
      throw new Error("Saved local customer accounts have an invalid format.");
    }
    return accounts;
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid format")) throw error;
    throw new Error("Saved local customer accounts could not be read. Check browser storage and try again.");
  }
}
async function hashLocalAccountPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: Uint8Array.from(salt.match(/.{2}/g) || [], (byte) => parseInt(byte, 16)), iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function newLocalAccountSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function saveLocalCustomerAccounts(accounts: LocalCustomerAccount[]) {
  try {
    localStorage.setItem(LOCAL_CUSTOMER_KEY, JSON.stringify(accounts));
  } catch {
    throw new Error("This browser could not save the account. Check that site storage is enabled and try again.");
  }
}
async function verifyLocalCustomerPassword(account: LocalCustomerAccount, password: string) {
  return (await hashLocalAccountPassword(password, account.passwordSalt)) === account.passwordHash;
}

type LocalVendorAccount = {
  email: string;
  name: string;
  passwordSalt: string;
  passwordHash: string;
  vendorId: string;
  active: boolean;
};
function isLocalVendorAccount(value: unknown): value is LocalVendorAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Record<string, unknown>;
  return typeof account.email === "string" &&
    typeof account.name === "string" &&
    typeof account.passwordSalt === "string" && /^[a-f\d]{32}$/i.test(account.passwordSalt) &&
    typeof account.passwordHash === "string" && /^[a-f\d]{64}$/i.test(account.passwordHash) &&
    typeof account.vendorId === "string" && account.vendorId.startsWith("local-") &&
    typeof account.active === "boolean";
}
function readLocalVendorAccounts(): LocalVendorAccount[] {
  try {
    const stored = localStorage.getItem(LOCAL_VENDOR_KEY);
    if (!stored) return [];
    const accounts: unknown = JSON.parse(stored);
    if (!Array.isArray(accounts) || !accounts.every(isLocalVendorAccount)) {
      throw new Error("Saved local vendor accounts have an invalid format.");
    }
    return accounts;
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid format")) throw error;
    throw new Error("Saved local vendor accounts could not be read. Check browser storage and try again.");
  }
}
function saveLocalVendorAccounts(accounts: LocalVendorAccount[]) {
  try {
    localStorage.setItem(LOCAL_VENDOR_KEY, JSON.stringify(accounts));
  } catch {
    throw new Error("This browser could not save the account. Check that site storage is enabled and try again.");
  }
}
async function verifyLocalVendorPassword(account: LocalVendorAccount, password: string) {
  return (await hashLocalAccountPassword(password, account.passwordSalt)) === account.passwordHash;
}

function authErrorMessage(caught: unknown) {
  if (caught instanceof Error && caught.message) return caught.message;
  if (caught && typeof caught === "object" && "message" in caught && typeof caught.message === "string") return caught.message;
  return "Unable to continue. Please contact your administrator if you need team access.";
}

export function SheplatesEntry({ onLogin }: { onLogin: (session: DemoSession) => void }) {
  const [authAudience, setAuthAudience] = useState<Audience | null>(null);
  const [location, setLocation] = useState("Ganapathy, Coimbatore");
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [agentOpen, setAgentOpen] = useState(false);

  // A vendor's QR code links to "<origin>/?vendor=<id>". There's no path
  // router in this app, so signed-out visitors land here first; prompt
  // sign-in immediately instead of leaving them on the generic landing page.
  // SheplatesV3 re-reads the same param after login to jump into that
  // vendor's shop, so it's intentionally left in the URL here.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (hash.includes("type=recovery") || search.includes("type=recovery")) {
      window.location.replace(`/reset-password${search}${hash}`);
      return;
    }
    const params = new URLSearchParams(search);
    const vendorParam = params.get("vendor");
    if (vendorParam) {
      try {
        sessionStorage.setItem("sheplates_pending_vendor", vendorParam);
      } catch {}
      queueMicrotask(() => setAuthAudience("customer"));
      toast.info("Sign in to view and order from this vendor's shop.");
    } else if (params.get("forgot") === "true") {
      queueMicrotask(() => setAuthAudience("customer"));
    } else if (params.get("login") === "team") {
      queueMicrotask(() => setAuthAudience("team"));
    } else if (params.get("login") === "customer") {
      queueMicrotask(() => setAuthAudience("customer"));
    }
  }, []);

  // Listen for auth redirects (e.g. Google OAuth, Email verification) and automatically log the customer in
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;

    async function checkAuthSession() {
      try {
        const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
        const authRoleParam = urlParams.get("auth_role");
        let requestedAudience: Audience | null = null;
        try {
          const stored = sessionStorage.getItem("sheplates_oauth_audience");
          if (stored === "team" || stored === "customer") {
            requestedAudience = stored;
          }
          sessionStorage.removeItem("sheplates_oauth_audience");
        } catch {}

        const preferredRole: "customer" | "vendor" | undefined =
          authRoleParam === "vendor" ? "vendor" :
          authRoleParam === "customer" ? "customer" :
          requestedAudience === "team" ? "vendor" :
          requestedAudience === "customer" ? "customer" :
          undefined;

        const live = await getLiveAuthSession(preferredRole);
        if (cancelled || !live?.user) return;
        const isEmailVerification = typeof window !== "undefined" && (
          window.location.hash.includes("type=signup") ||
          window.location.hash.includes("type=email_verification")
        );
        if (typeof window !== "undefined" && (window.location.hash || window.location.search.includes("code=") || window.location.search.includes("auth_role="))) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
        onLogin({
          email: live.user.email || "",
          name: live.profile.full_name,
          role: live.profile.role,
          userId: live.user.id,
          vendorId: live.profile.vendor_id ?? undefined,
          isNewVendor: live.profile.role === "vendor" && !live.profile.vendor_id,
          toursCompleted: live.profile.tours_completed || [],
        });
        toast.success(isEmailVerification ? "Email verified successfully! Welcome to Sheplates." : `Welcome back, ${live.profile.full_name || "User"}!`);
      } catch (err) {
        if (!cancelled) {
          const message = authErrorMessage(err);
          if (message && message !== "null" && message !== "undefined") {
            toast.error(message);
          }
        }
      }
    }

    void checkAuthSession();

    const client = getSupabaseBrowserClient();
    if (client) {
      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session?.user && !cancelled) {
          void checkAuthSession();
        }
      });
      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    }
    return () => { cancelled = true; };
  }, [onLogin]);

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return plans.filter((plan) =>
      (selectedCategory === "All" || plan.category === selectedCategory) &&
      (!query || `${plan.name} ${plan.category} ${plan.description}`.toLowerCase().includes(query)),
    );
  }, [search, selectedCategory]);

  function detectLocation() {
    if (!navigator.geolocation) {
      toast.error("Location detection is not supported in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocation("Ganapathy, Coimbatore");
        setLocating(false);
        toast.success("Showing verified vendors near your location");
      },
      () => {
        setLocating(false);
        toast.info("Location permission was not enabled. You can type your area instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const openCustomer = () => setAuthAudience("customer");
  const steps: [string, string][] = [
    ["Discover businesses near you", "Explore verified local food businesses and shops in your neighbourhood."],
    ["Explore products and order", "Browse catalogues, discover offerings and place orders with local vendors."],
    ["Choose how you receive your order", "Delivery or Pickup. Your Choice."],
  ];
  const tiles: [string, typeof Soup][] = [["Home food", Soup], ["Milk and dairy", Milk], ["Bakery", ShoppingBag], ["Vegetables", Activity], ["Fish and meat", Sparkles]];
  return (
    <div className="sh e-page sp-entry">
      <Toaster position="top-center" richColors />
      <header className="e-head">
        <button type="button" className="e-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Wordmark height={34} /></button>
        <nav className="e-nav" aria-label="Site">
          <button type="button" onClick={openCustomer}>Explore Marketplace</button>
          <button type="button" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>How It Works</button>
          <button type="button" onClick={() => setAuthAudience("team")}>Vendors &amp; Team</button>
        </nav>
        <button type="button" className="btn sm sec e-vendor" onClick={() => setAuthAudience("team")}>Vendor</button>
        <button type="button" className="btn sm sec" onClick={openCustomer}>Sign In</button>
        <button type="button" className="btn sm e-start" onClick={openCustomer}>Get Started</button>
      </header>

      <section className="e-hero">
        <div className="e-hero-copy">
          <span className="pill o"><BadgeCheck className="size-4" />Verified local food businesses near you</span>
          <h1>Your neighbourhood marketplace for everything food.</h1>
          <p>Discover home chefs, bakers, grocery stores, meat shops, fresh produce and more. Explore local businesses and order everything you need from your neighbourhood.</p>
          <div className="e-cta"><button type="button" className="btn" onClick={openCustomer}>Explore Marketplace</button><button type="button" className="btn sec" onClick={openCustomer}>Sign In</button><button type="button" className="btn sec" onClick={() => setAgentOpen(true)}><Sparkles className="size-5" />Try She Agent</button></div>
          <div className="s m">Sign in to discover businesses, explore products and place orders near you.</div>
        </div>
        <div className="e-hero-card">
          <div className="e-hero-tiles"><span><Soup className="size-9" /></span><span><ShoppingBag className="size-9" /></span><span><Milk className="size-9" /></span></div>
          <div><div className="h3">Everything Local. All in One Place.</div><div className="e-hero-cats">Home Chefs · Grocers · Fresh Produce · Meat &amp; Fish · Local Dairies</div><div className="s">Discover businesses around you and explore local favourites and everyday essentials on Sheplates.</div></div>
        </div>
      </section>

      <section id="how-it-works" className="e-band">
        <h2 className="h3">How Sheplates Works</h2>
        <div className="e-steps">{steps.map(([title, body], i) => <div key={title} className="e-step"><span className="e-num">{String(i + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></div>)}</div>
        <h2 className="h3 e-cat-h">Browse by category</h2>
        <div className="e-tiles">{tiles.map(([label, Icon]) => <button type="button" key={label} onClick={openCustomer}><Icon className="size-8" />{label}</button>)}</div>
      </section>

      <footer className="sh k-foot">
        <div className="row g8"><div><Wordmark height={34} /><div className="s" style={{ color: "#B6C0C2", marginTop: 4 }}>Home meals, made simple</div></div></div>
        <div className="fl"><span>Terms and Conditions</span><span>Privacy Policy</span><a href="tel:+919600037836">Support: 9600037836</a><a href="mailto:support@sheplates.com">support@sheplates.com</a><span>Every day, 9:30 AM to 7 PM</span></div>
      </footer>

      <AuthDialog audience={authAudience} close={() => setAuthAudience(null)} onLogin={onLogin} setAudience={setAuthAudience} />
      <AgentPreview open={agentOpen} close={() => setAgentOpen(false)} login={() => { setAgentOpen(false); setAuthAudience("customer"); }} />
    </div>
  );

}

function AuthDialog({ audience, close, onLogin, setAudience }: { audience: Audience | null; close: () => void; onLogin: (session: DemoSession) => void; setAudience?: (audience: Audience | null) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privateAccount, setPrivateAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const liveMode = process.env.NEXT_PUBLIC_DEMO_MODE === "false" && isSupabaseConfigured();

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  function revealField(event: React.FocusEvent<HTMLInputElement>) {
    const element = event.currentTarget;
    window.setTimeout(() => element.scrollIntoView({ block: "center", behavior: "smooth" }), 180);
  }

  useEffect(() => {
    if (!audience) return;
    const isForgot = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("forgot") === "true";
    queueMicrotask(() => {
      setMode(isForgot && audience === "customer" ? "forgot" : "login");
      setEmail("");
      setPassword("");
      setError("");
      setName("");
      setPrivateAccount(false);
      setResetSent(false);
      setVerificationSent(false);
    });
  }, [audience]);

  async function handleResendVerification() {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      toast.error("Please enter your email address to resend verification.");
      return;
    }
    try {
      setResendingVerification(true);
      await resendVerificationEmail(targetEmail);
      toast.success(`Verification email resent to ${targetEmail}!`);
    } catch (caught) {
      toast.error(authErrorMessage(caught));
    } finally {
      setResendingVerification(false);
    }
  }

// Listen for password reset completion from another browser tab
useEffect(() => {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return;
  }

  const channel = new BroadcastChannel("sheplates-password-reset");

  channel.onmessage = (event) => {
    if (event.data?.type === "PASSWORD_RESET_COMPLETED") {
      const audience = event.data.audience;

      setAudience?.(audience === "team" ? "team" : "customer");
    }
  };

  return () => {
    channel.close();
  };
}, []);

  if (!audience) return null;
  const registrationRole = audience === "customer" ? "customer" : "vendor";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (mode === "forgot") {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setError("Enter your registered email address.");
        emailInputRef.current?.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setError("Enter a valid email address.");
        emailInputRef.current?.focus();
        return;
      }

      setBusy(true);
      try {
        if (!isSupabaseConfigured()) {
          throw new Error("Supabase authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and set NEXT_PUBLIC_DEMO_MODE=false to send real password reset emails.");
        }

        await sendPasswordResetEmail(
          normalizedEmail,
          `${window.location.origin}/reset-password?audience=${audience}`
        );
        setResetSent(true);
        toast.success("Password reset instructions sent to your email.");
        return;
      } catch (caught) {
        setError(authErrorMessage(caught));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === "login") {
      const hasEmail = Boolean(email.trim());
      const hasPassword = Boolean(password);

      if (!hasEmail && !hasPassword) {
        setError("Enter your email and password.");
        emailInputRef.current?.focus();
        return;
      }
      if (!hasEmail) {
        setError("Enter your email address.");
        emailInputRef.current?.focus();
        return;
      }
      if (!hasPassword) {
        setError("Enter your password.");
        passwordInputRef.current?.focus();
        return;
      }
    }

    if (mode === "create") {
      if (!name.trim()) {
        setError("Enter your full name.");
        nameInputRef.current?.focus();
        return;
      }
      if (!email.trim()) {
        setError("Enter your email address.");
        emailInputRef.current?.focus();
        return;
      }
      if (password.length < 8) {
        setError("Use a password with at least 8 characters.");
        passwordInputRef.current?.focus();
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "create") {
        if (!liveMode) {
          const normalizedEmail = email.trim().toLowerCase();
          if (registrationRole === "customer") {
            const accounts = readLocalCustomerAccounts();
            if (
              accounts.some((account) => account.email.toLowerCase() === normalizedEmail) ||
              readLocalVendorAccounts().some((account) => account.email.toLowerCase() === normalizedEmail) ||
              demoAccounts.some((account) => account.email.toLowerCase() === normalizedEmail)
            ) {
              throw new Error("This email is already registered. Please sign in instead.");
            }
            const passwordSalt = newLocalAccountSalt();
            accounts.push({
              email: normalizedEmail,
              name: name.trim(),
              passwordSalt,
              passwordHash: await hashLocalAccountPassword(password, passwordSalt),
              privateAccount,
              active: true,
            });
            saveLocalCustomerAccounts(accounts);
          } else {
            const accounts = readLocalVendorAccounts();
            if (
              accounts.some((account) => account.email.toLowerCase() === normalizedEmail) ||
              readLocalCustomerAccounts().some((account) => account.email.toLowerCase() === normalizedEmail) ||
              demoAccounts.some((account) => account.email.toLowerCase() === normalizedEmail)
            ) {
              throw new Error("This email is already registered. Please sign in instead.");
            }
            const passwordSalt = newLocalAccountSalt();
            const vendorId = `local-${crypto.randomUUID()}`;
            accounts.push({
              email: normalizedEmail,
              name: name.trim(),
              passwordSalt,
              passwordHash: await hashLocalAccountPassword(password, passwordSalt),
              vendorId,
              active: true,
            });
            saveLocalVendorAccounts(accounts);
            onLogin({ email: normalizedEmail, name: name.trim(), role: "vendor", vendorId, isNewVendor: true });
            toast.success("Vendor account created. Complete verification next.");
            return;
          }
          onLogin({ email: normalizedEmail, name: name.trim(), role: registrationRole, privateAccount: registrationRole === "customer" ? privateAccount : undefined });
          toast.success("Customer account created.");
          return;
        }
        if (typeof window !== "undefined") {
          sessionStorage.setItem("sheplates_oauth_audience", audience || "customer");
        }
        const result = await liveSignUp({ name: name.trim(), email, password, role: registrationRole });
        if (result.needsEmailVerification) {
          setVerificationSent(true);
          toast.success("Verification email sent! Please check your inbox.");
          return;
        }
        if (registrationRole === "customer") {
          try { await saveLiveCustomerPrivacy(privateAccount); }
          catch (error) { toast.error(`Account created, but privacy could not be saved yet: ${authErrorMessage(error)}`); }
        }
        onLogin({ email, name: name.trim(), role: registrationRole, userId: result.user?.id, isNewVendor: registrationRole === "vendor", privateAccount: registrationRole === "customer" ? privateAccount : undefined });
        toast.success(registrationRole === "vendor" ? "Vendor account created. Complete onboarding next." : "Customer account created.");
        return;
      }

      if (!liveMode) {
        const normalizedEmail = email.trim().toLowerCase();
        const localCustomer = readLocalCustomerAccounts().find((account) => account.active !== false && account.email.toLowerCase() === normalizedEmail);
        if (localCustomer) {
          if (!(await verifyLocalCustomerPassword(localCustomer, password))) throw new Error("The email or password is incorrect.");
          if (audience !== "customer") throw new Error("Use Customer login for this account.");
          onLogin({ email: localCustomer.email, name: localCustomer.name, role: "customer", privateAccount: localCustomer.privateAccount });
          return;
        }
        const localVendor = readLocalVendorAccounts().find((account) => account.active && account.email.toLowerCase() === normalizedEmail);
        if (localVendor) {
          if (!(await verifyLocalVendorPassword(localVendor, password))) throw new Error("The email or password is incorrect.");
          if (audience !== "team") throw new Error("Use Vendor / Team login for this account.");
          onLogin({ email: localVendor.email, name: localVendor.name, role: "vendor", vendorId: localVendor.vendorId, isNewVendor: true });
          return;
        }
        const demo = demoAccounts.find((account) => account.email.toLowerCase() === normalizedEmail && account.password === password);
        if (demo) {
          const permitted = audience === "customer" ? demo.role === "customer" : demo.role !== "customer";
          if (!permitted) throw new Error(audience === "customer" ? "Use Customer login for this account." : "Use Vendor / Team login for this account.");
          onLogin({ email: demo.email, name: demo.name, role: demo.role, vendorId: demo.vendorId, isNewVendor: demo.isNewVendor });
          return;
        }
        const staffAccount = readLocalStaffAccount(email, password);
        if (staffAccount) {
          if (audience === "customer") throw new Error("Use Vendor / Team login for this account.");
          onLogin({ email: staffAccount.email, name: staffAccount.name, role: staffAccount.role });
          return;
        }
        throw new Error(audience === "customer"
          ? "No local account found. Create a customer account here, or use a packaged demo account."
          : "Use one of the packaged demo credentials, or a team login created by Super Admin.");
      }
      const live = await liveSignIn(email, password);
      const permitted = audience === "customer" ? live.profile.role === "customer" : live.profile.role !== "customer";
      if (!permitted) throw new Error(audience === "customer" ? "This account belongs in Vendor / Team login." : "This account belongs in Customer login.");
      onLogin({
        email,
        name: live.profile.full_name,
        role: live.profile.role,
        userId: live.user.id,
        vendorId: live.profile.vendor_id ?? undefined,
        p0UpgradeInvitationId: typeof live.user.user_metadata?.p0_upgrade_invitation_id === "string"
          ? live.user.user_metadata.p0_upgrade_invitation_id
          : undefined,
        toursCompleted: live.profile.tours_completed || [],
      });
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally { setBusy(false); }
  }

  async function handleGoogleSignIn() {
    try {
      setBusy(true);
      setError("");
      const targetRole = audience === "team" ? "vendor" : "customer";
      if (typeof window !== "undefined") {
        sessionStorage.setItem("sheplates_oauth_audience", audience || "customer");
        sessionStorage.setItem("sheplates_oauth_mode", mode);
      }
      await liveSignInWithGoogle(targetRole);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return <Dialog open onOpenChange={(open) => !open && close()}><DialogContent className="sp-auth-dialog max-h-[92vh] overflow-y-auto rounded-4xl p-0 sm:max-w-lg"><div className="sp-auth-hero p-6"><div className="k-auth-brand"><Wordmark height={32} /></div><DialogHeader><DialogTitle className="text-lg font-black">{verificationSent ? "Verify your email" : audience === "customer" ? (mode === "forgot" ? "Reset password" : mode === "create" ? "Create customer account" : "Customer access") : mode === "create" ? "Register as a Vendor" : "Vendor / Team access"}</DialogTitle><DialogDescription className="text-white/75">{verificationSent ? "Check your inbox to activate your account." : audience === "customer" ? (mode === "forgot" ? "Enter your registered email address to receive password reset instructions." : "Discover, request quotes and track scheduled orders.") : mode === "create" ? "Join Sheplates as a local food vendor or home chef." : "Vendors, operations and super admins use this secure entry."}</DialogDescription></DialogHeader><ul className="k-auth-feats"><li><BadgeCheck className="size-6" />Verified home chefs and shops</li><li><CalendarDays className="size-6" />Plan ahead, daily or weekly</li><li><Truck className="size-6" />Track every order to your door</li></ul></div><div className="k-auth-form p-6">
    {mode !== "forgot" && !verificationSent && (
      <>
        <div className="grid grid-cols-2 rounded-2xl bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); setVerificationSent(false); }}
            className={`rounded-xl py-2.5 text-sm font-black ${mode === "login" ? "bg-white shadow-sm" : "text-stone-500"}`}
          >
            {audience === "team" ? "Sign in" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => { setMode("create"); setError(""); setVerificationSent(false); }}
            className={`rounded-xl py-2.5 text-sm font-black ${mode === "create" ? "bg-white shadow-sm" : "text-stone-500"}`}
          >
            {audience === "team" ? "Register as vendor" : "Create account"}
          </button>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-4 text-sm font-black text-stone-700 shadow-xs transition hover:bg-stone-50 active:scale-[0.99] disabled:opacity-50"
          >
            <GoogleIcon className="size-5 shrink-0" />
            <span>
              {audience === "team"
                ? mode === "create"
                  ? "Register as Vendor with Google"
                  : "Continue as Vendor with Google"
                : "Continue with Google"}
            </span>
          </button>
          <div className="relative my-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <span className="relative bg-white px-2 text-[11px] font-black uppercase tracking-wider text-stone-400">
              or continue with email
            </span>
          </div>
        </div>
      </>
    )}
    
    {verificationSent ? (
      <div className="space-y-4 py-2">
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 text-teal-900">
          <div className="flex items-start gap-3">
            <MailIcon className="mt-0.5 size-5 shrink-0 text-teal-600" />
            <div>
              <h3 className="text-sm font-black text-teal-950">Verify your email address</h3>
              <p className="mt-1 text-xs leading-5 text-teal-800">
                We have sent a confirmation link to <b>{email}</b>. Please check your inbox and click the link to confirm your account.
              </p>
              <p className="mt-2 text-[11px] text-teal-700">
                Didn&apos;t see it? Check your spam folder or click below to resend.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            disabled={resendingVerification}
            onClick={handleResendVerification}
            className="h-12 w-full rounded-xl bg-[#155F65] text-sm font-black text-white hover:bg-black disabled:opacity-50"
          >
            {resendingVerification ? "Resending email…" : "Resend verification email"}
          </Button>
          <button
            type="button"
            onClick={() => { setVerificationSent(false); setMode("login"); setError(""); }}
            className="py-2 text-center text-xs font-bold text-stone-500 hover:text-stone-900"
          >
            Already verified? Back to sign in
          </button>
          <button
            type="button"
            onClick={() => { setVerificationSent(false); setError(""); }}
            className="text-center text-xs text-stone-400 hover:text-stone-600"
          >
            Use a different email
          </button>
        </div>
      </div>
    ) : mode === "forgot" ? (
      resetSent ? (
        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <h3 className="text-sm font-black text-emerald-950">Password reset link sent!</h3>
                <p className="mt-1 text-xs leading-5 text-emerald-800">
                  If <b>{email}</b> is registered with Sheplates, you will receive a password reset link shortly. Please check your inbox.
                </p>
                <p className="mt-2 text-[11px] text-emerald-700">
                  Didn&apos;t see it? Check your spam or promotions folder.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              onClick={() => { setMode("login"); setError(""); setResetSent(false); }}
              className="h-12 w-full rounded-xl bg-[#155F65] text-sm font-black text-white hover:bg-black"
            >
              Back to sign in
            </Button>
            <button
              type="button"
              onClick={() => { setResetSent(false); setError(""); }}
              className="py-2 text-center text-xs font-bold text-stone-500 hover:text-stone-900"
            >
              Resend link or use a different email
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="sp-auth-form mt-2 space-y-4">
          <p className="text-xs leading-5 text-stone-600">
            Enter the email address associated with your Sheplates account. We will send you a secure link to reset your password.
          </p>
          <InputField label="Registered Email">
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onFocus={revealField}
              autoComplete="email"
              inputMode="email"
              className="entry-input"
              placeholder="customer@example.com"
            />
          </InputField>
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          <Button
            disabled={busy}
            className="h-12 w-full rounded-xl bg-[#155F65] text-base font-black hover:bg-black"
          >
            {busy ? "Sending reset link…" : "Send password reset link"}
            <ArrowRight />
          </Button>
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className="mt-2 w-full text-center text-sm font-bold text-stone-500 hover:text-stone-900"
          >
            ← Back to sign in
          </button>
        </form>
      )
    ) : (
      <>
        {mode === "create" && audience === "customer" && !liveMode && <div className="mt-4 rounded-xl bg-sky-50 p-3 text-xs leading-5 text-sky-900">This test account is saved in this browser only. Configure Supabase for secure sign-in across devices.</div>}
        <form onSubmit={submit} className="sp-auth-form mt-5 space-y-4">
          {mode === "create" && <InputField label="Full name"><input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} onFocus={revealField} autoComplete="name" className="entry-input" placeholder="Your name" /></InputField>}
          <InputField label="Email"><input ref={emailInputRef} type="email" value={email} onChange={(event) => setEmail(event.target.value)} onFocus={revealField} autoComplete="email" inputMode="email" className="entry-input" /></InputField>
          <InputField
            label="Password"
            rightAction={
mode === "login" ? (
              <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setMode("forgot");
                    setError("");
                    setResetSent(false);
                  }}
                  className="text-xs font-bold text-[#155F65] hover:underline"
                >
                  Forgot password?
                </button>
              ) : undefined
            }
          >
            <input ref={passwordInputRef} type="password" value={password} onChange={(event) => setPassword(event.target.value)} onFocus={revealField} autoComplete={mode === "create" ? "new-password" : "current-password"} className="entry-input" />
          </InputField>
          {/* Supported verification flow: autoComplete="one-time-code" */}
          {mode === "create" && audience === "customer" && <fieldset className="rounded-2xl border border-stone-200 p-4"><legend className="px-1 text-xs font-black uppercase tracking-wider text-stone-500">Account privacy</legend><p className="mb-3 text-xs leading-5 text-stone-500">Choose who can follow you. You can change this later in your profile.</p><div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={!privateAccount} onClick={() => setPrivateAccount(false)} className={`rounded-xl border p-3 text-left transition ${!privateAccount ? "border-[#155F65] bg-[#EAF4F2]" : "border-stone-200"}`}><span className="block text-sm font-black">Public</span><span className="mt-1 block text-xs text-stone-500">Customers can follow you directly.</span></button><button type="button" aria-pressed={privateAccount} onClick={() => setPrivateAccount(true)} className={`rounded-xl border p-3 text-left transition ${privateAccount ? "border-[#155F65] bg-[#EAF4F2]" : "border-stone-200"}`}><span className="block text-sm font-black">Private</span><span className="mt-1 block text-xs text-stone-500">Approve customer follow requests.</span></button></div></fieldset>}
          {mode === "create" && audience === "team" && <div className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900"><b>Vendor registration only.</b> Operations and super-admin access is created by an existing super admin.</div>}
          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">
              <p>{error}</p>
              {/email not confirmed/i.test(error) && (
                <button
                  type="button"
                  disabled={resendingVerification}
                  onClick={handleResendVerification}
                  className="mt-2 block text-xs font-black text-[#155F65] underline hover:text-black disabled:opacity-50"
                >
                  {resendingVerification ? "Resending email…" : "Click here to resend the verification email"}
                </button>
              )}
            </div>
          )}
          <Button disabled={busy} className="h-12 w-full rounded-xl bg-[#155F65] text-base font-black hover:bg-black">{busy ? "Please wait…" : mode === "login" ? "Sign in" : audience === "team" ? "Register vendor account" : "Create account"}<ArrowRight /></Button>
        </form>
      </>
    )}
    {audience === "team" && !verificationSent && <button onClick={() => { setMode(mode === "login" ? "create" : "login"); setError(""); setVerificationSent(false); }} className="mt-4 w-full text-center text-sm text-stone-500">{mode === "login" ? <>Not a vendor? <span className="font-black text-[#155F65]">Be part of our vendor team</span></> : <>Already registered? <span className="font-black text-[#155F65]">Sign in</span></>}</button>}
  </div></DialogContent></Dialog>;
}

function AgentPreview({ open, close, login }: { open: boolean; close: () => void; login: () => void }) {
  const [message, setMessage] = useState("Plan milk every morning and chicken on Sunday under ₹800");
  if (!open) return null;
  return <div className="fixed inset-0 z-80 sm:pointer-events-none"><button onClick={close} className="absolute inset-0 bg-[#202827]/45 backdrop-blur-[2px] sm:pointer-events-auto" aria-label="Close She Agent preview" /><section className="surface-card sp-agent-preview pointer-events-auto absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[30px] border border-white/60 bg-[#EEF2F2] shadow-[0_-20px_80px_rgba(25, 19, 21,.25)] sm:bottom-6 sm:right-6 sm:left-auto sm:w-107.5 sm:rounded-[34px] sm:shadow-[0_24px_90px_rgba(25, 19, 21,.3)]">
    <div className="surface-dark relative overflow-hidden p-5 text-white"><div className="absolute -right-12 -top-16 size-44 rounded-full bg-[#155F65]/30 blur-3xl" /><div className="relative flex items-center gap-3"><div className="sp-agent-orb grid size-12 place-items-center rounded-2xl shadow-lg"><Activity /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-lg font-black">She Agent</h2><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white/70">Preview</span></div><p className="text-xs text-white/55">Your agentic local-commerce copilot</p></div><button onClick={close} className="grid size-10 place-items-center rounded-full bg-white/10"><X className="size-4" /></button></div></div>
    <div className="p-5"><div className="surface-card-muted rounded-[22px_22px_22px_8px] p-4 text-sm leading-6 text-stone-600 shadow-sm">Tell me a meal, budget or recurring need. I can shortlist nearby verified options, build a review basket and help you schedule it after sign-in.</div><div className="mt-3 grid grid-cols-3 gap-2">{[{ Icon: Milk, tint: "#2f6fa8", label: "Daily milk" }, { Icon: Soup, tint: "#b1652f", label: "Meal plan" }, { Icon: ShoppingBag, tint: "#7847b8", label: "Budget basket" }].map(({ Icon, tint, label }) => <button key={label} onClick={() => setMessage(label === "Daily milk" ? "Plan milk every morning" : label === "Meal plan" ? "Plan a healthy dinner under ₹400" : "Build groceries under ₹500")} className="surface-card-muted rounded-[22px] p-3 text-center shadow-sm"><div className="mx-auto grid size-8 place-items-center rounded-full bg-white"><Icon className="size-4" style={{ color: tint }} /></div><div className="mt-1.5 text-[10px] font-black">{label}</div></button>)}</div><div className="surface-card-muted mt-4 flex items-end gap-2 rounded-[22px] bg-[#EEF2F2] p-2"><textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-16 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none" /><button onClick={login} className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#155F65] text-white"><ArrowRight className="size-4" /></button></div><Button onClick={login} className="mt-3 h-12 w-full rounded-xl bg-[#155F65] font-black text-white hover:bg-black"><Sparkles />Sign in and let She Agent build it</Button><p className="mt-3 text-center text-[10px] leading-4 text-stone-400">Your private profile, nearby catalogue, schedules and orders are only used after sign-in.</p></div>
  </section></div>;
}

function InputField({ label, rightAction, children }: { label: string; rightAction?: React.ReactNode; children: React.ReactNode }) { return <label className="block"><div className="mb-2 flex items-center justify-between"><span className="block text-xs font-black uppercase tracking-wider text-stone-500">{label}</span>{rightAction}</div>{children}</label>; }

function Brand({ dark = false }: { dark?: boolean }) { return <Wordmark height={dark ? 34 : 38} />; }
