/**
 * Every email Sheplates sends. Pure functions: data in, { subject, html, text } out, so they are easy to test and review.
 * All text that comes from a person (names, notes, addresses) is escaped before it goes into the HTML.
 * Emails here are service messages about an order, an account or a payout, never marketing, so they carry no unsubscribe link.
 */
export type EmailTemplate =
  | "order_confirmed" | "order_status" | "order_cancelled" | "payment_failed" | "refund_issued"
  | "vendor_new_order" | "vendor_decision" | "agreement_signed" | "agreement_uploaded" | "agreement_review" | "subscription_reminder" | "settlement_statement" | "staff_account" | "signing_code";

export type Rendered = { subject: string; html: string; text: string };

export const BRAND = { coral: "#F15B5A", teal: "#155F65", ink: "#202827", mint: "#D9F5E7", wordmark: "https://app.sheplates.com/brand/sheplates-wordmark-coral.png", support: "support@sheplates.com", partnerSupport: "partnersupport@sheplates.com" };

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
const rupees = (n: unknown) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nl2br = (s: string) => escapeHtml(s).replace(/\n/g, "<br>");

function layout(title: string, bodyHtml: string, footer = `Questions? Write to ${BRAND.support}.`): string {
  return `<!doctype html><html><body style="margin:0;background:#EEF2F2;font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${BRAND.teal};padding:22px 28px"><img src="${BRAND.wordmark}" alt="Sheplates" height="34" style="display:block;border:0;height:34px"></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;background:#F7FAFA;color:#55656A;font-size:12px;line-height:1.5">${escapeHtml(footer)}<br>Sheplates · Home meals, everytime.</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (html: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${html}</p>`;
const row = (label: string, value: string) => `<tr><td style="padding:6px 0;color:#55656A;font-size:14px">${escapeHtml(label)}</td><td style="padding:6px 0;text-align:right;font-size:14px;font-weight:bold">${value}</td></tr>`;
const table = (rows: string) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #DDE3E4;margin:8px 0 16px">${rows}</table>`;
const button = (label: string, href: string) => `<p style="margin:18px 0"><a href="${escapeHtml(href)}" style="background:${BRAND.teal};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">${escapeHtml(label)}</a></p>`;

type Data = Record<string, unknown>;
const s = (v: unknown, fallback = "") => (v === null || v === undefined ? fallback : String(v));

export function renderEmail(template: EmailTemplate, d: Data): Rendered {
  switch (template) {
    case "order_confirmed": {
      const items = Array.isArray(d.items) ? (d.items as Array<{ name?: string; quantity?: number; price?: number }>) : [];
      const lines = items.map((i) => row(`${s(i.name)} × ${s(i.quantity, "1")}`, rupees(Number(i.price || 0) * Number(i.quantity || 1)))).join("");
      const money = [row("Items", rupees(d.subtotal)), Number(d.deliveryFee) > 0 ? row("Delivery", rupees(d.deliveryFee)) : "", Number(d.gstAmount) > 0 ? row("GST", rupees(d.gstAmount)) : "", row("Total paid", rupees(d.total))].join("");
      return {
        subject: `Order ${s(d.orderNumber)} confirmed`,
        html: layout(`Your order is confirmed`, p(`Hi ${escapeHtml(s(d.customerName, "there"))}, ${escapeHtml(s(d.vendorName, "your vendor"))} has your order <b>${escapeHtml(s(d.orderNumber))}</b> for ${escapeHtml(s(d.date))} (${escapeHtml(s(d.slot))}).`) + table(lines + money) + p(`<b>${escapeHtml(s(d.documentLabel, "Bill"))}</b>${d.gstNote ? ` · ${escapeHtml(s(d.gstNote))}` : ""}`) + (d.address ? p(`${d.mode === "Self pickup" ? "Pickup" : "Delivery"}: ${escapeHtml(s(d.address))}`) : "") + (d.link ? button("View your order", s(d.link)) : "")),
        text: `Your order ${s(d.orderNumber)} is confirmed for ${s(d.date)} (${s(d.slot)}). Total paid ${rupees(d.total)}.`,
      };
    }
    case "order_status": {
      const labels: Record<string, string> = { preparing: "is being prepared", packed: "is packed", ready: "is ready", ready_for_pickup: "is ready for pickup", out_for_delivery: "is out for delivery", picked_up: "has been picked up", delivered: "has been delivered", completed: "is complete" };
      const text = labels[s(d.status)] || `is now ${s(d.status).replace(/_/g, " ")}`;
      return { subject: `Order ${s(d.orderNumber)} ${text}`, html: layout(`Your order ${text}`, p(`Order <b>${escapeHtml(s(d.orderNumber))}</b> from ${escapeHtml(s(d.vendorName, "your vendor"))} ${escapeHtml(text)}.`) + (d.code ? p(`Your handover code is <b style="font-size:20px;letter-spacing:3px">${escapeHtml(s(d.code))}</b>. Share it only with the person who hands you the order.`) : "") + (d.link ? button("Track your order", s(d.link)) : "")), text: `Order ${s(d.orderNumber)} ${text}.` };
    }
    case "order_cancelled":
      return { subject: `Order ${s(d.orderNumber)} cancelled`, html: layout("Your order was cancelled", p(`Order <b>${escapeHtml(s(d.orderNumber))}</b> was cancelled.${d.reason ? ` Reason: ${escapeHtml(s(d.reason))}.` : ""}`) + (Number(d.refund) > 0 ? p(`A refund of <b>${rupees(d.refund)}</b> will go back to your original payment method.`) : p("No amount was charged for this order."))), text: `Order ${s(d.orderNumber)} was cancelled.` };
    case "payment_failed":
      return { subject: `Payment for order ${s(d.orderNumber)} did not go through`, html: layout("Your payment did not go through", p(`We could not collect the payment for order <b>${escapeHtml(s(d.orderNumber))}</b>. Nothing was charged. You can try again from your orders.`) + (d.link ? button("Pay again", s(d.link)) : "")), text: `Payment for order ${s(d.orderNumber)} did not go through. Nothing was charged.` };
    case "refund_issued":
      return { subject: `Refund of ${rupees(d.amount)} for order ${s(d.orderNumber)}`, html: layout("Your refund is on its way", p(`We have refunded <b>${rupees(d.amount)}</b> for order <b>${escapeHtml(s(d.orderNumber))}</b>. It usually reaches your account in 5 to 7 working days.`) + (d.reference ? p(`Reference: ${escapeHtml(s(d.reference))}`) : "")), text: `Refund of ${rupees(d.amount)} issued for order ${s(d.orderNumber)}.` };
    case "vendor_new_order":
      return { subject: `New order ${s(d.orderNumber)}`, html: layout("You have a new order", p(`Order <b>${escapeHtml(s(d.orderNumber))}</b> is paid and confirmed for ${escapeHtml(s(d.date))} (${escapeHtml(s(d.slot))}).`) + table(row("Items", rupees(d.subtotal)) + (Number(d.deliveryFee) > 0 ? row("Delivery fee (yours)", rupees(d.deliveryFee)) : "") + row("Fulfilment", escapeHtml(s(d.mode)))) + (d.link ? button("Open your orders", s(d.link)) : ""), `Questions? Write to ${BRAND.partnerSupport}.`), text: `New order ${s(d.orderNumber)} for ${s(d.date)} (${s(d.slot)}).` };
    case "vendor_decision": {
      const decision = s(d.decision);
      const head = decision === "verified" ? "Your store is approved" : decision === "rejected" ? "Your application was not approved" : "Changes are needed on your application";
      const body = decision === "verified" ? p(`Welcome to Sheplates, ${escapeHtml(s(d.vendorName))}. ${d.needsAgreement ? "Please read and sign your Vendor Partnership Agreement and Terms to go live." : "Open for the day and publish your products."}`) : p(`Operations reviewed <b>${escapeHtml(s(d.vendorName))}</b>.`) + (d.note ? p(`<b>Note from Operations:</b><br>${nl2br(s(d.note))}`) : "");
      return { subject: head, html: layout(head, body + (d.link ? button(decision === "verified" && d.needsAgreement ? "Review and sign" : "Open your dashboard", s(d.link)) : ""), `Questions? Write to ${BRAND.partnerSupport}.`), text: `${head}. ${d.note ? `Note: ${s(d.note)}` : ""}` };
    }
    case "agreement_signed":
      return { subject: "Your signed Sheplates agreement", html: layout("Agreement signed", p(`${escapeHtml(s(d.vendorName))} signed the Vendor Partnership Agreement and Terms &amp; Conditions on ${escapeHtml(s(d.signedAt))}.`) + table(row("Signed by", escapeHtml(s(d.signerName))) + row("Agreement version", escapeHtml(s(d.version))) + row("Document fingerprint", `<span style="font-family:monospace;font-size:11px">${escapeHtml(s(d.hash).slice(0, 24))}…</span>`)) + p("The signed copy with its audit page is attached. Keep it for your records."), `Questions? Write to ${BRAND.partnerSupport}.`), text: `The Vendor Partnership Agreement was signed on ${s(d.signedAt)} by ${s(d.signerName)}. The signed copy is attached.` };
    case "agreement_uploaded":
      return { subject: `${s(d.vendorName)} uploaded a signed ${s(d.documentTitle)}`, html: layout("A signed document needs your review", p(`<b>${escapeHtml(s(d.vendorName))}</b> signed the ${escapeHtml(s(d.documentTitle))} by hand and uploaded <i>${escapeHtml(s(d.fileName))}</i>. Open Vendor verification to read it and accept or reject it.`) + (d.link ? button("Open Sheplates", s(d.link)) : ""), `Questions? Write to ${BRAND.partnerSupport}.`), text: `${s(d.vendorName)} uploaded a signed ${s(d.documentTitle)}. Review it in Vendor verification.` };
    case "agreement_review": {
      const ok = s(d.decision) === "accepted";
      return { subject: ok ? `Your signed ${s(d.documentTitle)} was accepted` : `Please upload your ${s(d.documentTitle)} again`, html: layout(ok ? "Your signed document was accepted" : "Your upload needs a fix", p(ok ? `Operations accepted the signed ${escapeHtml(s(d.documentTitle))} for <b>${escapeHtml(s(d.vendorName))}</b>.` : `Operations could not accept the signed ${escapeHtml(s(d.documentTitle))} for <b>${escapeHtml(s(d.vendorName))}</b>.`) + (d.note ? p(`<b>Note from Operations:</b><br>${nl2br(s(d.note))}`) : "") + (!ok && d.link ? button("Upload again", s(d.link)) : ""), `Questions? Write to ${BRAND.partnerSupport}.`), text: ok ? `Your signed ${s(d.documentTitle)} was accepted.` : `Your signed ${s(d.documentTitle)} was not accepted. ${s(d.note)}` };
    }
    case "signing_code":
      return { subject: `Your Sheplates signing code: ${s(d.code)}`, html: layout("Your signing code", p("Use this code to confirm that you are signing the Sheplates agreement. It works for 10 minutes.") + `<p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:16px 0">${escapeHtml(s(d.code))}</p>` + p("If you did not ask for this, ignore this email and do not share the code."), `Questions? Write to ${BRAND.partnerSupport}.`), text: `Your Sheplates signing code is ${s(d.code)}. It works for 10 minutes.` };
    case "subscription_reminder": {
      const days = Number(d.daysLeft);
      const when = days <= 0 ? "has expired" : days === 1 ? "ends tomorrow" : `ends in ${days} days`;
      return { subject: `Your Sheplates ${s(d.plan)} plan ${when}`, html: layout(`Your ${s(d.plan)} plan ${when}`, p(`Your ${escapeHtml(s(d.plan))} subscription (${escapeHtml(s(d.period))}) ${escapeHtml(when)}, on ${escapeHtml(s(d.endsOn))}. Renewal amount: <b>${rupees(d.amount)}</b> plus GST.`) + (d.link ? button("Renew now", s(d.link)) : ""), `Questions? Write to ${BRAND.partnerSupport}.`), text: `Your ${s(d.plan)} plan ${when} (${s(d.endsOn)}).` };
    }
    case "settlement_statement": {
      const rows = Array.isArray(d.rows) ? (d.rows as Array<{ orderNumber?: string; date?: string; food?: number; delivery?: number; commission?: number; gstForVendor?: number; refund?: number; net?: number }>) : [];
      const head = `<tr style="background:#F7FAFA">${["Order", "Date", "Food", "Delivery", "Commission", "Refunds", "Net"].map((h) => `<th align="${h === "Order" || h === "Date" ? "left" : "right"}" style="padding:6px;font-size:12px">${h}</th>`).join("")}</tr>`;
      const body = rows.map((r) => `<tr>${[escapeHtml(s(r.orderNumber)), escapeHtml(s(r.date)), rupees(r.food), rupees(r.delivery), `−${rupees(r.commission)}`, r.refund ? `−${rupees(r.refund)}` : "–", `<b>${rupees(r.net)}</b>`].map((c, i) => `<td align="${i < 2 ? "left" : "right"}" style="padding:6px;font-size:12px;border-top:1px solid #EEF2F2">${c}</td>`).join("")}</tr>`).join("");
      return { subject: `Settlement for ${s(d.weekStart)} to ${s(d.weekEnd)}: ${rupees(d.totalNet)}`, html: layout(`Your settlement: ${rupees(d.totalNet)}`, p(`Paid on <b>${escapeHtml(s(d.payoutDate))}</b> (Wednesday) for completed orders from ${escapeHtml(s(d.weekStart))} to ${escapeHtml(s(d.weekEnd))}.`) + table(row("Food sales", rupees(d.totalFood)) + row("Delivery fees (yours)", rupees(d.totalDelivery)) + row("Commission", `−${rupees(d.totalCommission)}`) + (Number(d.totalSubscription) > 0 ? row("Subscription deducted", `−${rupees(d.totalSubscription)}`) : "") + (Number(d.totalRefund) > 0 ? row("Customer refunds", `−${rupees(d.totalRefund)}`) : "") + row("Net settlement", rupees(d.totalNet))) + (rows.length ? `<table width="100%" cellpadding="0" cellspacing="0">${head}${body}</table>` : "") + p("The full break-up is also in your dashboard under Settlements, where you can download it."), `Questions? Write to ${BRAND.partnerSupport}.`), text: `Settlement ${s(d.weekStart)} to ${s(d.weekEnd)}: ${rupees(d.totalNet)}, paid ${s(d.payoutDate)}.` };
    }
    case "staff_account":
      return { subject: "Your Sheplates team account", html: layout("Your team account is ready", p(`Hi ${escapeHtml(s(d.name))}, you can now sign in to Sheplates as <b>${escapeHtml(s(d.role))}</b> with this email address.`) + (d.link ? button("Set your password", s(d.link)) : "") + p("For your security, set your own password the first time you sign in.")), text: `Your Sheplates ${s(d.role)} account is ready. Set your password: ${s(d.link)}` };
  }
}
