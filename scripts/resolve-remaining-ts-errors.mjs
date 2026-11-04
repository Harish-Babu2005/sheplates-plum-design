import fs from "fs";
import path from "path";

// 1. Fix lib/supabase.ts
const supabasePath = path.resolve("lib/supabase.ts");
let supabaseContent = fs.readFileSync(supabasePath, "utf-8");

const duplicateAcceptTerms = `/** A vendor accepts the Vendor Terms and Conditions. The database records the time, version and document reference. */
export async function acceptLiveVendorTerms(vendorId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Live account access is not available in this deployment.");
  const result = await supabase.from("vendors").update({ terms_accepted: true }).eq("id", vendorId).select("id").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Your vendor account could not be updated. Sign in again and retry.");
}`;

if (supabaseContent.includes(duplicateAcceptTerms)) {
  supabaseContent = supabaseContent.replace(duplicateAcceptTerms, "");
  fs.writeFileSync(supabasePath, supabaseContent, "utf-8");
  console.log("Successfully removed duplicate acceptLiveVendorTerms in lib/supabase.ts");
} else {
  // Regex fallback in case of line ending differences
  const re = /\/\*\* A vendor accepts  the Vendor Terms and Conditions[\s\S]*?if \(!result\.data\) throw new Error\("Your vendor account could not be updated\. Sign in again and retry\."\);\s*\}/;
  if (re.test(supabaseContent)) {
    supabaseContent = supabaseContent.replace(re, "");
    fs.writeFileSync(supabasePath, supabaseContent, "utf-8");
    console.log("Successfully removed duplicate acceptLiveVendorTerms using regex in lib/supabase.ts");
  } else {
    console.warn("Could not find duplicate acceptLiveVendorTerms in lib/supabase.ts");
  }
}

// 2. Fix components/sheplates-v3.tsx
const v3Path = path.resolve("components/sheplates-v3.tsx");
let v3Content = fs.readFileSync(v3Path, "utf-8");

// a. Add Crown and MessageCircle to lucide-react imports if missing
if (!v3Content.includes("Crown,") && !v3Content.includes("Crown ")) {
  v3Content = v3Content.replace('ReceiptText, Compass, PhoneCall, FileText, ExternalLink,', 'ReceiptText, Compass, PhoneCall, FileText, ExternalLink, Crown, MessageCircle,');
  console.log("Added Crown and MessageCircle to imports in sheplates-v3.tsx");
}

// b. Remove duplicate termsAccepted in vendorFromLive
v3Content = v3Content.replace('vendorKind: row.vendor_kind || "subscription", termsAccepted: row.terms_accepted,', 'vendorKind: row.vendor_kind || "subscription",');

// c. Remove extra deliverySlots from mergeLiveCommerce return
v3Content = v3Content.replace(
  '...current, orders, schedules: mergedSchedules, staff, assignments, thirdPartyDeliveries, cart, deliverySlots,',
  '...current, orders, schedules: mergedSchedules, staff, assignments, thirdPartyDeliveries, cart,'
);

// d. CartView props and containsFoodDrop
v3Content = v3Content.replace(
  'function CartView({ session, state, setState, navigate }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; navigate: (page: string) => void }) {',
  'function CartView({ session, state, setState, navigate, refreshDrops }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; navigate: (page: string) => void; refreshDrops?: () => void }) {\n  const containsFoodDrop = items.some((item) => Boolean(item.foodDropId));'
);

// update CartView call
v3Content = v3Content.replace(
  '<CartView session={session} state={state} setState={setState} navigate={navigate} />',
  '<CartView session={session} state={state} setState={setState} navigate={navigate} refreshDrops={refreshDrops} />'
);

// CartView non-live order confirmation fix
v3Content = v3Content.replace('setPaying(orders[0] || null);', 'setPaying(order);');
v3Content = v3Content.replace(
  'if (orders.length > 1) toast.success(`${orders.length} vendor orders are ready for payment.`);',
  'toast.success("Checkout is ready for payment.");'
);

// e. PaymentDialog session reference fix
v3Content = v3Content.replace(
  'mergeLiveCommerce(s, saved.snapshot as LiveCommerceStateSnapshot, session)',
  'mergeLiveCommerce(s, saved.snapshot as LiveCommerceStateSnapshot, { email: order.customerEmail, name: order.customerEmail, role: "customer" })'
);

fs.writeFileSync(v3Path, v3Content, "utf-8");
console.log("Successfully patched components/sheplates-v3.tsx");
