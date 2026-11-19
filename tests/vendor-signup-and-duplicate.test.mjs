import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Vendor signup and duplicate account handling validation", () => {
  const entry = fs.readFileSync("components/sheplates-entry.tsx", "utf8");
  const auth = fs.readFileSync("lib/supabase.ts", "utf8");
  const profileRoute = fs.readFileSync("app/api/auth/profile/route.ts", "utf8");
  const checkEmailRoute = fs.readFileSync("app/api/auth/check-email/route.ts", "utf8");
  const app = fs.readFileSync("components/sheplates-v3.tsx", "utf8");

  // 1. Check email endpoint detects existing accounts
  assert.ok(checkEmailRoute.includes('listUsers'), "check-email route lists/verifies users against auth.users");
  assert.ok(checkEmailRoute.includes('This email is already registered. Please sign in instead.'), "check-email route returns clear error message");

  // 2. liveSignUp calls checkEmailRegistered before signUp
  assert.ok(auth.includes('checkEmailRegistered(normalizedEmail)'), "liveSignUp checks if email is already registered");
  assert.ok(auth.includes('auth_role=${input.role}'), "liveSignUp includes auth_role param in emailRedirectTo");
  assert.ok(auth.includes('This email is already registered. Please sign in instead.'), "liveSignUp returns proper error message on duplicate");

  // 3. getLiveAuthSession verifies and syncs role through authoritative API
  assert.ok(auth.includes('/api/auth/profile'), "getLiveAuthSession calls /api/auth/profile to sync and verify role");

  // 4. Server profile route allows upgrading to vendor role so vendor onboarding is reached
  assert.ok(profileRoute.includes('effectiveRole === "vendor"'), "profile route checks vendor role intent");
  assert.ok(profileRoute.includes('role: "vendor"'), "profile route updates profile role to vendor");

  // 5. Vendor & Customer tabs in AuthDialog
  assert.ok(entry.includes('Register as vendor'), "AuthDialog includes explicit tab for vendor registration");
  assert.ok(entry.includes('Register as Vendor with Google'), "AuthDialog includes Google vendor registration label");
  assert.ok(entry.includes('Register as a Vendor'), "AuthDialog includes vendor registration title");

  // 6. Direct escape hatch in CustomerOnboarding to switch immediately to vendor onboarding
  assert.ok(app.includes('Registering as a vendor? Switch to vendor onboarding →'), "Customer setup includes 1-click vendor switch");
});
