import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("AUTH-007: Empty Email and Password Validation & Auto-Focus", () => {
  const entry = fs.readFileSync("components/sheplates-entry.tsx", "utf8");

  // 1. React refs declared for email and password inputs
  assert.ok(entry.includes("const emailInputRef = useRef<HTMLInputElement>(null);"), "Declares emailInputRef");
  assert.ok(entry.includes("const passwordInputRef = useRef<HTMLInputElement>(null);"), "Declares passwordInputRef");

  // 2. React refs attached to the input elements
  assert.ok(entry.includes("ref={emailInputRef}"), "Attaches emailInputRef to email input");
  assert.ok(entry.includes("ref={passwordInputRef}"), "Attaches passwordInputRef to password input");

  // 3. Both fields empty: appropriate validation message & focus email field first
  assert.ok(entry.includes('if (!hasEmail && !hasPassword)'), "Detects both email and password empty");
  assert.ok(entry.includes('setError("Enter your email and password.");'), "Displays appropriate message when both empty");
  assert.ok(entry.includes('emailInputRef.current?.focus();'), "Auto-focuses email input when empty");

  // 4. Only email empty: appropriate message & focus email field
  assert.ok(entry.includes('if (!hasEmail)'), "Detects email empty");
  assert.ok(entry.includes('setError("Enter your email address.");'), "Displays specific email missing message");

  // 5. Only password empty: appropriate message & focus password field
  assert.ok(entry.includes('if (!hasPassword)'), "Detects password empty");
  assert.ok(entry.includes('setError("Enter your password.");'), "Displays specific password missing message");
  assert.ok(entry.includes('passwordInputRef.current?.focus();'), "Auto-focuses password input when missing");

  // 6. Prevents submission before busy state / network requests
  const loginIdx = entry.indexOf('if (mode === "login")');
  const busyIdx = entry.indexOf('setBusy(true);', loginIdx);
  assert.ok(loginIdx !== -1 && busyIdx !== -1 && loginIdx < busyIdx, "Validates login fields prior to setting busy state");
});
