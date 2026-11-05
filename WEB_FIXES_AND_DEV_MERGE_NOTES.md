# Web fixes and the developers' changes (4 Nov 2026)

## The six reported points

| # | Point | What was wrong | What changed |
|---|---|---|---|
| 1 | Onboarding had no upload fields | Not in the plum build | Step 4 now has the Food Safety Certificate (required) and six optional PDF documents: PAN, government ID, address proof, bank details, business registration, product catalogue. Format checks on PAN, IFSC and account number. Files upload before the application is saved, so a failed upload leaves nothing half-saved. |
| 2 | T&C not readable before accepting | Only a checkbox | "View Terms & Conditions" opens the PDF inside the page (onboarding and the vendor's Verification page). Operations sees whether and when each vendor accepted. |
| 3 | No map under Store & radius | The map sat below the whole form; long address suggestions stretched the page | The map is now in the same card as the address, between the GPS buttons and the radius slider. Suggestions are clipped to the card. The pin can be dragged. |
| 4 | Food Drop could not be created | A database refusal (the store's plan in the database did not include Food Drops) showed as a generic error; fractional units were not checked; the demo could not create one at all | The reason is stated plainly, units must be whole, and the demo works. |
| 5 | Bulk upload failed, no delete | The reader only understood one shape of list and, if the smart reader was down, treated the Price column as a quantity. No way to delete | CSV, TSV, TXT and Excel (.xlsx). Header row recognised (Name, Category, Pack, Price, Stock, Food type), loose category names matched, food type only from what the vendor wrote. Incomplete rows say what is missing and wait; the rest publish. Template download. Each product has a delete button with a confirmation. The Active switch now actually saves. |
| 6 | Ask She Agent stuck on "Analysing…" | No time limit anywhere; a slow model left the button spinning | 40 s limit on the server with a plain reading of the store's numbers as the fallback, 60 s limit in the page, 75 s per model call and 90 s in the chat window. Big stores are capped before the prompt is built. |

## Developers' changes merged (three-way merge against the plum base)
Compliance documents, the T&C viewer and PDF, Food Drops in the shared basket and checkout, P0 Connect category list, commerce route fixes, Razorpay price fix, and their tests. Their styling was re-themed to the teal palette. Not taken: the `codex-preview` meta tag.

Deliberate differences from their zip:
* PAN, bank account, IFSC and registration numbers are **not** stored on `vendors` (customers can read verified vendors). They live with their document in `vendor_documents`, readable only by the vendor and Operations / Super Admin. `V9_20` removes the four columns if they are empty.
* The vendor's own acceptance of the terms uses the database trigger (V9_16), so it works without the service-role key.
* The Operations "Inspect" button opens the real PDF through a 10-minute private link (the original showed a placeholder).
* Their route `/api/vendor/onboarding` is kept; a stored file must be inside the owner's folder.

## SQL to run in Supabase, in this order (each is safe to re-run)
1. `V9_19_VENDOR_DELETE_PRODUCT.sql`
2. `V9_20_VENDOR_COMPLIANCE_DOCUMENTS.sql`
3. `V9_13_FOOD_DROP_CART_CHECKOUT.sql` (after V9_12)

The site keeps working before they are run: delete falls back to taking the item off sale, documents save without the extra file details, and the basket loads without the Food Drop column.
