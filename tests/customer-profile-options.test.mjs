import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const v3Code = fs.readFileSync(path.resolve(__dirname, "../components/sheplates-v3.tsx"), "utf8");
const supabaseCode = fs.readFileSync(path.resolve(__dirname, "../lib/supabase.ts"), "utf8");

test("STANDARD_DIETS, STANDARD_ALLERGIES, STANDARD_GOALS constants exist and cover core options", () => {
  assert.match(v3Code, /export const STANDARD_DIETS =/);
  assert.match(v3Code, /"No preference"/);
  assert.match(v3Code, /"Vegetarian"/);
  assert.match(v3Code, /"Vegan"/);
  assert.match(v3Code, /"Eggetarian"/);
  assert.match(v3Code, /"Non-vegetarian"/);
  assert.match(v3Code, /"Jain"/);
  assert.match(v3Code, /"Low carb"/);
  assert.match(v3Code, /"High protein"/);

  assert.match(v3Code, /export const STANDARD_ALLERGIES =/);
  assert.match(v3Code, /"Milk"/);
  assert.match(v3Code, /"Egg"/);
  assert.match(v3Code, /"Peanut"/);
  assert.match(v3Code, /"Tree nuts"/);
  assert.match(v3Code, /"Gluten"/);
  assert.match(v3Code, /"Soy"/);
  assert.match(v3Code, /"Fish"/);
  assert.match(v3Code, /"Shellfish"/);

  assert.match(v3Code, /export const STANDARD_GOALS =/);
  assert.match(v3Code, /"Balanced meals"/);
  assert.match(v3Code, /"Weight management"/);
  assert.match(v3Code, /"High protein"/);
  assert.match(v3Code, /"Low sodium"/);
  assert.match(v3Code, /"Diabetes aware"/);
  assert.match(v3Code, /"Heart friendly"/);
});

test("CustomerOnboarding persists complete profile including diet, allergies and goals", () => {
  assert.match(v3Code, /await saveLiveCustomerProfile\(\{\s*userId:\s*session\.userId,\s*address,\s*latitude,\s*longitude,\s*householdSize:\s*household,\s*diet,\s*allergies,\s*goals,\s*instructions:\s*dislikes/);
  assert.match(v3Code, /STANDARD_DIETS\.map/);
});

test("loadLiveCustomerPreference retrieves customer_preferences and profile phone", () => {
  assert.match(supabaseCode, /supabase\.from\("customer_preferences"\)\.select\("\*"\)/);
  assert.match(supabaseCode, /supabase\.from\("profiles"\)\.select\("phone,\s*full_name"\)/);
  assert.match(supabaseCode, /phone:\s*profileResult\.data\?\.phone\s*\|\|\s*""/);
});

test("Customer live sync attaches phone and addresses to state.customers", () => {
  assert.match(v3Code, /phone:\s*String\(preference\.phone\s*\|\|\s*""\)/);
  assert.match(v3Code, /addresses:\s*\[\{\s*id:\s*id\("ADR"\),\s*label:\s*"Home",/);
});

test("CustomerProfileV4 has standardized diet selection and toggleable chips for allergies and goals", () => {
  assert.match(v3Code, /function CustomerProfileV4/);
  assert.match(v3Code, /STANDARD_DIETS\.map/);
  assert.match(v3Code, /STANDARD_ALLERGIES\.map/);
  assert.match(v3Code, /STANDARD_GOALS\.map/);
  assert.match(v3Code, /toggleAllergy/);
  assert.match(v3Code, /toggleGoal/);
  assert.match(v3Code, /customAllergies/);
  assert.match(v3Code, /customGoals/);
  assert.match(v3Code, /Save profile/);
});

test("BUG 12 — CUST-ONB-003: Address name updates automatically when dragging the map pin", () => {
  // CustomerOnboarding: movePin reverse geocodes coordinates via findLocation and updates address
  assert.match(v3Code, /async function movePin\(point:\s*\{\s*lat:\s*number;\s*lng:\s*number\s*\}\)/);
  assert.match(v3Code, /const place = await findLocation\(next\);/);
  assert.match(v3Code, /if \(request === pinLookup\.current && place\?\.address\)\s*\{\s*setAddress\(place\.address\);/);

  // CustomerProfileV4: MapPreview onPinChange also reverse geocodes coordinates
  assert.match(v3Code, /onPinChange=\{async \(point\) => \{\s*const next = \{ lat: Number\(point\.lat\.toFixed\(6\)\), lng: Number\(point\.lng\.toFixed\(6\)\) \};\s*setCoords\(next\);\s*try \{\s*const place = await findLocation\(next\);\s*if \(place\?\.address\) setAddress\(place\.address\);/);

  // Customer Marketplace delivery pin dialog onPinChange also reverse geocodes
  assert.match(v3Code, /label="Customer delivery pin" onPinChange=\{async \(point\) =>/);
});

test("BUG 13 — CUST-ONB-014: Fractional household size rejected with whole-number validation", () => {
  // householdProblem helper validates integer, positive, max 20, not empty
  assert.match(v3Code, /function householdProblem\(value: unknown\): string \| null/);
  assert.match(v3Code, /Household size must be a whole number/);
  assert.match(v3Code, /Household size must be at least 1/);
  assert.match(v3Code, /Household size must be at most 20/);

  // CustomerOnboarding step 1 & step 2 inputs enforce step="1" and field error alert
  assert.match(v3Code, /id="customer-household-input" type="number" min="1" max="20" step="1"/);
  assert.match(v3Code, /id="customer-household-step2-input" type="number" min="1" max="20" step="1"/);
  assert.match(v3Code, /\{householdError && <p role="alert" data-testid="field-error"/);

  // CustomerProfileV4 enforces step="1" and profileHouseholdError
  assert.match(v3Code, /<Field label="Household size">\s*<input\s+type="number"\s+min="1"\s+max="20"\s+step="1"/);
  assert.match(v3Code, /\{profileHouseholdError && \(\s*<p role="alert" data-testid="field-error"/);
});


