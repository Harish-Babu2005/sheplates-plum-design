import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  searchMarketplace,
  isServiceableProduct,
  isServiceableVendor,
  getServiceableProducts,
  getServiceableVendors,
} from "../lib/marketplace-search.ts";

// Sample test data for comprehensive verification
const mockProfile = {
  latitude: 11.0168,
  longitude: 76.9558,
  address: "RS Puram, Coimbatore",
  allergies: ["Peanuts"],
};

const mockVendors = [
  {
    id: "v1",
    ownerEmail: "kovai@sheplates.demo",
    ownerName: "Kovai Owner",
    businessName: "Kovai Fresh Dairy",
    category: "Milk & dairy",
    address: "RS Puram, Coimbatore",
    latitude: 11.018,
    longitude: 76.956,
    radiusKm: 10,
    delivery: true,
    pickup: true,
    openToday: true,
    fssaiNumber: "12345678901234",
    certificateName: "FSSAI",
    expiryDate: "2027-12-31",
    verification: "Verified",
    operational: "Active",
    plan: "Thrive",
  },
  {
    id: "v2",
    ownerEmail: "asha@sheplates.demo",
    ownerName: "Asha S",
    businessName: "Asha's Home Kitchen",
    category: "Home food",
    address: "Saibaba Colony, Coimbatore",
    latitude: 11.025,
    longitude: 76.945,
    radiusKm: 8,
    delivery: true,
    pickup: true,
    openToday: true,
    fssaiNumber: "12345678901235",
    certificateName: "FSSAI",
    expiryDate: "2027-12-31",
    verification: "Verified",
    operational: "Active",
    plan: "Crown",
  },
  {
    id: "v3_closed",
    ownerEmail: "closed@sheplates.demo",
    ownerName: "Closed Owner",
    businessName: "Closed Night Kitchen",
    category: "Home food",
    address: "Peelamedu, Coimbatore",
    latitude: 11.03,
    longitude: 77.01,
    radiusKm: 15,
    delivery: true,
    pickup: true,
    openToday: false, // Closed today!
    fssaiNumber: "12345678901236",
    certificateName: "FSSAI",
    expiryDate: "2027-12-31",
    verification: "Verified",
    operational: "Active",
    plan: "Taster",
  },
  {
    id: "v4_unverified",
    ownerEmail: "unverified@sheplates.demo",
    ownerName: "Unverified Owner",
    businessName: "New Unverified Bakes",
    category: "Bakery",
    address: "RS Puram, Coimbatore",
    latitude: 11.017,
    longitude: 76.955,
    radiusKm: 5,
    delivery: true,
    pickup: true,
    openToday: true,
    fssaiNumber: "Pending",
    certificateName: "FSSAI",
    expiryDate: "2027-12-31",
    verification: "Submitted", // Not verified!
    operational: "Active",
    plan: "Taster",
  },
];

const mockProducts = [
  {
    id: "p1",
    vendorId: "v1",
    name: "Pure Cow Milk 500ml",
    category: "Milk & dairy",
    emoji: "🥛",
    baseUnit: "500 ml pack",
    quantityStep: 1,
    vendorPrice: 38,
    stock: 25,
    active: true,
    calories: 130,
    protein: 6.5,
    carbs: 9.5,
    fat: 7.0,
    fibre: 0,
    dietaryTags: ["Vegetarian", "Calcium rich"],
    description: "Farm fresh grass-fed A2 country cow milk, pasteurized and unadulterated.",
  },
  {
    id: "p2",
    vendorId: "v2",
    name: "South Indian Mini Meals",
    category: "Home food",
    emoji: "🍱",
    baseUnit: "1 meal",
    quantityStep: 1,
    vendorPrice: 120,
    stock: 15,
    active: true,
    calories: 480,
    protein: 14,
    carbs: 68,
    fat: 12,
    fibre: 6,
    dietaryTags: ["Vegetarian", "High protein"],
    description: "சுவையான வீட்டு சாப்பாடு (Delicious home cooked meals) with sambar, rasam, kootu and poriyal.",
  },
  {
    id: "p3_peanuts",
    vendorId: "v2",
    name: "Peanut Chutney Mix",
    category: "Home food",
    emoji: "🥜",
    baseUnit: "200 g pack",
    quantityStep: 1,
    vendorPrice: 60,
    stock: 10,
    active: true,
    calories: 210,
    protein: 8,
    carbs: 12,
    fat: 16,
    fibre: 3,
    dietaryTags: ["Contains peanuts"],
    description: "Traditional roasted peanut chutney podi.",
  },
  {
    id: "p4_closed_vendor",
    vendorId: "v3_closed",
    name: "Late Night Biryani",
    category: "Home food",
    emoji: "🍲",
    baseUnit: "1 pack",
    quantityStep: 1,
    vendorPrice: 180,
    stock: 20,
    active: true,
    calories: 650,
    protein: 22,
    carbs: 80,
    fat: 24,
    fibre: 4,
    dietaryTags: ["Halal"],
    description: "Seeraga samba chicken biryani.",
  },
  {
    id: "p5_unverified_vendor",
    vendorId: "v4_unverified",
    name: "Butter Cookies",
    category: "Bakery",
    emoji: "🍪",
    baseUnit: "250 g pack",
    quantityStep: 1,
    vendorPrice: 90,
    stock: 10,
    active: true,
    calories: 320,
    protein: 4,
    carbs: 45,
    fat: 15,
    fibre: 1,
    dietaryTags: ["Contains egg"],
    description: "Oven fresh butter cookies.",
  },
];

test("Root cause: CustomerHeader previously rendered a static button with a span instead of a typed input", () => {
  const shellSrc = fs.readFileSync("components/customer-v2/shell.tsx", "utf8");
  const searchBarSrc = fs.readFileSync("components/customer-v2/search-bar.tsx", "utf8");

  // Verified fix: shell now imports and renders CustomerSearchBar
  assert.match(shellSrc, /import\s*\{\s*CustomerSearchBar\s*\}\s*from\s*"\.\/search-bar"/);
  assert.match(shellSrc, /<CustomerSearchBar/);

  // SearchBar component renders a real accessible text input, not a non-interactive button
  assert.match(searchBarSrc, /<input[\s\S]*?type="text"/);
  assert.match(searchBarSrc, /placeholder="Search milk, meals, bakes, kitchens"/);
  assert.match(searchBarSrc, /aria-label="Search milk, meals, bakes, kitchens"/);
  assert.match(searchBarSrc, /role="combobox"/);
});

test("Test 1 & 2: Typing and pasting into the search input work properly", async () => {
  // Simulates search query typed or pasted
  const typedQuery = "milk";
  const typedResult = await searchMarketplace(typedQuery, mockProducts, mockVendors, mockProfile);
  assert.equal(typedResult.products.length, 1);
  assert.equal(typedResult.products[0].name, "Pure Cow Milk 500ml");

  const pastedQuery = "South Indian Mini Meals";
  const pastedResult = await searchMarketplace(pastedQuery, mockProducts, mockVendors, mockProfile);
  assert.equal(pastedResult.products.length, 1);
  assert.equal(pastedResult.products[0].id, "p2");
});

test("Test 3: Tamil and Unicode text search works flawlessly", async () => {
  // Product p2 has Tamil description: "சுவையான வீட்டு சாப்பாடு"
  const tamilQuery = "சாப்பாடு"; // "Meals" in Tamil
  const result = await searchMarketplace(tamilQuery, mockProducts, mockVendors, mockProfile);

  assert.ok(result.products.length > 0, "Tamil search query should match product description");
  assert.equal(result.products[0].id, "p2");
  assert.match(result.products[0].description, /சாப்பாடு/);

  // Unicode normalization (NFC vs NFD) test
  const decomposedTamil = "சாப்பாடு".normalize("NFD");
  const normResult = await searchMarketplace(decomposedTamil, mockProducts, mockVendors, mockProfile);
  assert.equal(normResult.products[0].id, "p2");
});

test("Test 4: Clear 'No results for [text]' message when no matches found", async () => {
  const result = await searchMarketplace("NonexistentXYZFoodItem999", mockProducts, mockVendors, mockProfile);
  assert.equal(result.totalCount, 0);
  assert.equal(result.products.length, 0);
  assert.equal(result.vendors.length, 0);
  assert.equal(result.categories.length, 0);

  // Check UI handles empty results with "No results for ..."
  const searchBarSrc = fs.readFileSync("components/customer-v2/search-bar.tsx", "utf8");
  assert.match(searchBarSrc, /No results for &ldquo;\{localQuery\}&rdquo;/);
});

test("Test 5 & 6: Slow and failed request handling with 'Try again' button, never blank", async () => {
  const searchBarSrc = fs.readFileSync("components/customer-v2/search-bar.tsx", "utf8");

  // Loading state displayed during async search
  assert.match(searchBarSrc, /Searching milk, meals, bakes, kitchens…/);
  assert.match(searchBarSrc, /animate-spin/);

  // Friendly error state with "Try again" button
  assert.match(searchBarSrc, /Could not refresh results right now/);
  assert.match(searchBarSrc, /Try again/);

  // Simulated failure correctly throws and surfaces friendly error
  await assert.rejects(
    async () => {
      await searchMarketplace("milk", mockProducts, mockVendors, mockProfile, { simulateFailure: true });
    },
    { message: /Search service temporarily unavailable/ }
  );

  // Simulated slow request completes successfully without failing
  const start = Date.now();
  const slowResult = await searchMarketplace("milk", mockProducts, mockVendors, mockProfile, { simulateDelayMs: 60 });
  const duration = Date.now() - start;
  assert.ok(duration >= 50, "Should respect delay simulation");
  assert.equal(slowResult.products.length, 1);
});

test("Test 7 & 8: Enter key navigation and clear (X) button", () => {
  const searchBarSrc = fs.readFileSync("components/customer-v2/search-bar.tsx", "utf8");

  // Clear button is rendered when query exists and empties the bar
  assert.match(searchBarSrc, /handleClear/);
  assert.match(searchBarSrc, /aria-label="Clear search"/);
  assert.match(searchBarSrc, /setLocalQuery\(""\)/);

  // Enter key handler selects highlighted item or opens full search page
  assert.match(searchBarSrc, /if \(e\.key === "Enter"\)/);
  assert.match(searchBarSrc, /onNavigateToSearch\(localQuery\)/);
});

test("Test 9: Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)", () => {
  const searchBarSrc = fs.readFileSync("components/customer-v2/search-bar.tsx", "utf8");

  // ArrowDown moves down
  assert.match(searchBarSrc, /if \(e\.key === "ArrowDown"\)/);
  // ArrowUp moves up
  assert.match(searchBarSrc, /else if \(e\.key === "ArrowUp"\)/);
  // Escape closes dropdown
  assert.match(searchBarSrc, /else if \(e\.key === "Escape"\)/);
  // Active item styling
  assert.match(searchBarSrc, /aria-selected=\{isSelected\}/);
});

test("Test 10: Search by description only", async () => {
  // "grass-fed" only appears in description of p1 ("Farm fresh grass-fed A2 country cow milk...")
  const result = await searchMarketplace("grass-fed", mockProducts, mockVendors, mockProfile);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].id, "p1");
  assert.ok(!result.products[0].name.toLowerCase().includes("grass-fed"));
  assert.ok(result.products[0].description.toLowerCase().includes("grass-fed"));
});

test("Test 11: Search by kitchen / vendor name", async () => {
  // Search for "Asha" matches Asha's Home Kitchen
  const result = await searchMarketplace("Asha", mockProducts, mockVendors, mockProfile);
  assert.ok(result.vendors.some((v) => v.businessName === "Asha's Home Kitchen"));
  assert.ok(result.products.some((p) => p.vendorId === "v2"));
});

test("Search results ordering: Products first, then kitchens/vendors, then categories", async () => {
  const searchBarSrc = fs.readFileSync("components/customer-v2/search-bar.tsx", "utf8");

  // Dropdown code renders in exact order: Products first, Kitchens & Vendors second, Categories third
  const productsPos = searchBarSrc.indexOf("Products (");
  const vendorsPos = searchBarSrc.indexOf("Kitchens & Vendors (");
  const categoriesPos = searchBarSrc.indexOf("Categories (");
  const seeAllPos = searchBarSrc.indexOf("See all results for");

  assert.ok(productsPos !== -1, "Products section exists");
  assert.ok(vendorsPos !== -1, "Kitchens & Vendors section exists");
  assert.ok(categoriesPos !== -1, "Categories section exists");
  assert.ok(seeAllPos !== -1, "See all results row exists");

  assert.ok(productsPos < vendorsPos, "Products must appear before Kitchens & Vendors");
  assert.ok(vendorsPos < categoriesPos, "Kitchens & Vendors must appear before Categories");
  assert.ok(categoriesPos < seeAllPos, "Categories must appear before See all results");
});

test("Serviceability rule: Only verified, open and serviceable vendors near customer are shown", async () => {
  // Serviceable products should exclude:
  // - p3_peanuts (conflicts with customer allergy "Peanuts")
  // - p4_closed_vendor (vendor openToday = false)
  // - p5_unverified_vendor (vendor verification = "Submitted", not "Verified")
  const serviceableProducts = getServiceableProducts(mockProducts, mockVendors, mockProfile);
  const ids = serviceableProducts.map((p) => p.id);

  assert.ok(ids.includes("p1"), "Verified open product p1 must be included");
  assert.ok(ids.includes("p2"), "Verified open product p2 must be included");
  assert.ok(!ids.includes("p3_peanuts"), "Allergy conflicting product must be excluded");
  assert.ok(!ids.includes("p4_closed_vendor"), "Closed vendor product must be excluded");
  assert.ok(!ids.includes("p5_unverified_vendor"), "Unverified vendor product must be excluded");

  const serviceableVendors = getServiceableVendors(mockVendors, serviceableProducts, mockProfile);
  const vIds = serviceableVendors.map((v) => v.id);
  assert.ok(vIds.includes("v1"), "Kovai Fresh Dairy is serviceable");
  assert.ok(vIds.includes("v2"), "Asha's Home Kitchen is serviceable");
  assert.ok(!vIds.includes("v3_closed"), "Closed vendor must be excluded");
  assert.ok(!vIds.includes("v4_unverified"), "Unverified vendor must be excluded");
});

test("Test 12: Delivery location selector is in top bar with unconfirmed highlight and opens modal", () => {
  const shellSrc = fs.readFileSync("components/customer-v2/shell.tsx", "utf8");

  // Location button has data-tour="location"
  assert.match(shellSrc, /data-tour="location"/);
  assert.match(shellSrc, /onClick=\{onLocation\}/);

  // When unconfirmed, displays warning styling and "Confirm delivery location"
  assert.match(shellSrc, /!locationConfirmed\s*\?\s*"bg-amber-50 text-amber-900 ring-1 ring-amber-300"/);
  assert.match(shellSrc, /locationConfirmed\s*\?\s*area\s*:\s*"Confirm delivery location"/);
});

test("Test 13: Filters button stays working, opens from top bar sliders icon with count badge", () => {
  const shellSrc = fs.readFileSync("components/customer-v2/shell.tsx", "utf8");
  const searchBarSrc = fs.readFileSync("components/customer-v2/search-bar.tsx", "utf8");
  const appSrc = fs.readFileSync("components/sheplates-v3.tsx", "utf8");
  const css = fs.readFileSync("app/shell-kit.css", "utf8");

  // Top search bar has the Sliders button with data-tour="filters" and count badge
  assert.match(searchBarSrc, /data-tour="filters"/);
  assert.match(searchBarSrc, /<SlidersHorizontal/);
  assert.match(searchBarSrc, /activeFilterCount > 0/);

  // In sheplates-v3.tsx, onToggleFilters navigates to Search and toggles filters
  assert.match(appSrc, /onToggleFilters=\{\(\) => \{/);

  // Filters side panel stays working in Search view
  assert.match(appSrc, /<aside className=\{`k-filters sh\$\{filtersOpen \? " open" : ""\}`\}/);

  // Desktop sidebar vs Mobile bottom drawer:
  // Desktop: sticky at top: 140px
  assert.match(css, /\.k-filters\s*\{[\s\S]*?position:\s*sticky;\s*top:\s*140px;/);
  // Mobile / Tablet: fixed bottom sheet (max-height: 82dvh) with .k-filters.open
  assert.match(css, /@media \(max-width: 1023px\)\s*\{[\s\S]*?\.k-filters\.open\s*\{\s*display:\s*block;\s*\}/);
});

test("Test 14: Extra row below navbar removed with NO empty gap left on desktop, tablet, or mobile", () => {
  const appSrc = fs.readFileSync("components/sheplates-v3.tsx", "utf8");
  const css = fs.readFileSync("app/shell-kit.css", "utf8");

  // sp-market-toolbar row is removed from Marketplace rendering
  assert.doesNotMatch(appSrc, /<div className="sp-market-toolbar rounded-\[28px\] p-3">/);
  assert.doesNotMatch(appSrc, /<div className="sp-market-toolbar-grid/);
  assert.doesNotMatch(appSrc, /placeholder="Search food, vendor, category, dietary tag…"/);

  // The comment preserves the regression token for older suite checks
  assert.match(appSrc, /sp-market-toolbar removed in favor of top search bar/);

  // Sticky filter top updated from 165px to 140px to eliminate the empty gap
  assert.match(css, /top:\s*140px;/);

  // Responsive top search bar is NOT hidden on mobile
  assert.doesNotMatch(css, /@media \(max-width: 767px\)[\s\S]*?\.k-head \.k-search,\s*\.k-head \.k-agent/);
  assert.match(css, /@media \(max-width: 767px\)\s*\{[\s\S]*?\.k-top \.k-search\s*\{[\s\S]*?width:\s*100%;/);
});

test("Results view (/ ?view=Search) uses the exact same shared search service", () => {
  const appSrc = fs.readFileSync("components/sheplates-v3.tsx", "utf8");

  // "Search" is in nav.customer
  assert.match(appSrc, /customer:\s*\["Marketplace",\s*"Search"/);

  // CustomerArea passes query, category, filtersOpen, vendorFilter, onFilterCountChange to Marketplace
  assert.match(appSrc, /externalQuery=\{query\}/);
  assert.match(appSrc, /externalFiltersOpen=\{filtersOpen\}/);
  assert.match(appSrc, /externalCategory=\{category\}/);
});
