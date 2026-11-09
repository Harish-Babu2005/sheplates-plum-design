import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, createSign } from "node:crypto";
import { renderEmail, escapeHtml } from "../lib/email/templates.ts";
import { buildRawMime, emailSettings, PermanentEmailError } from "../lib/email/transport.ts";
import { enqueueEmail, processOutbox, validEmail, MAX_ATTEMPTS, suppressEmail } from "../lib/email/outbox.ts";
import { stringToSign, verifySnsSignature, isAmazonUrl, parseSesEvent } from "../lib/email/sns.ts";

// A tiny in-memory stand-in for the Supabase client, just enough for the outbox.
function fakeAdmin(seed = {}) {
  const tables = { email_outbox: [], email_suppressions: [], ...seed };
  let n = 0;
  const builder = (name) => {
    const state = { filters: [], op: "select", patch: null, row: null, limit: 1e9, order: null };
    const q = {
      select() { return q; }, order() { return q; }, limit(v) { state.limit = v; return q; },
      insert(row) { state.op = "insert"; state.row = row; return q; }, update(patch) { state.op = "update"; state.patch = patch; return q; }, upsert(row) { state.op = "upsert"; state.row = row; return q; },
      eq(c, v) { state.filters.push((r) => r[c] === v); return q; }, lt(c, v) { state.filters.push((r) => r[c] < v); return q; }, lte(c, v) { state.filters.push((r) => r[c] <= v); return q; },
      maybeSingle() { return q.then((r) => ({ data: r.data?.[0] ?? null, error: null })); },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    function run() {
      const rows = tables[name];
      if (state.op === "insert") {
        if (state.row.dedupe_key && rows.some((r) => r.dedupe_key === state.row.dedupe_key)) return { error: { code: "23505", message: "dup" } };
        rows.push({ id: `id${++n}`, status: "pending", attempts: 0, ...state.row }); return { error: null };
      }
      if (state.op === "upsert") { const i = rows.findIndex((r) => r.email === state.row.email); i >= 0 ? (rows[i] = state.row) : rows.push(state.row); return { error: null }; }
      const hit = rows.filter((r) => state.filters.every((f) => f(r)));
      if (state.op === "update") { hit.forEach((r) => Object.assign(r, state.patch)); return { data: hit.map((r) => ({ id: r.id })), error: null }; }
      return { data: hit.slice(0, state.limit), error: null };
    }
    return q;
  };
  return { tables, from: builder, storage: { from: () => ({ download: async () => ({ data: new Blob(["%PDF"]), error: null }) }) } };
}
const okTransport = () => { const sent = []; return { sent, send: async (m) => { sent.push(m); return { messageId: `m${sent.length}` }; } }; };

test("every template renders a subject, html and text, and escapes what people type", () => {
  const names = ["order_confirmed", "order_status", "order_cancelled", "payment_failed", "refund_issued", "vendor_new_order", "vendor_decision", "agreement_signed", "subscription_reminder", "settlement_statement", "staff_account", "signing_code"];
  for (const t of names) { const r = renderEmail(t, { orderNumber: "SP-1", vendorName: "<script>x</script>", customerName: "A&B", note: "<img src=x onerror=alert(1)>", decision: "changes_requested", status: "out_for_delivery", daysLeft: 3, rows: [] }); assert.ok(r.subject && r.html.includes("Sheplates") && r.text, t); assert.ok(!r.html.includes("<script>x"), `${t} escapes names`); assert.ok(!r.html.includes("<img src=x"), `${t} escapes notes`); }
  assert.equal(escapeHtml(`"<&>'`), "&quot;&lt;&amp;&gt;&#39;");
});

test("order email shows the real bill lines and no platform fee", () => {
  const r = renderEmail("order_confirmed", { orderNumber: "SP-9", items: [{ name: "Veg meal", quantity: 2, price: 100 }], subtotal: 200, deliveryFee: 25, gstAmount: 10, total: 235 });
  assert.match(r.html, /Veg meal × 2/); assert.match(r.html, /₹235\.00/); assert.doesNotMatch(r.html, /platform fee/i);
});

test("settlement and reminder emails state the amounts and the Wednesday payout", () => {
  const s = renderEmail("settlement_statement", { weekStart: "2026-11-02", weekEnd: "2026-11-08", payoutDate: "2026-11-11", totalFood: 1000, totalDelivery: 50, totalCommission: 100, totalNet: 950, rows: [{ orderNumber: "SP-1", date: "2026-11-03", food: 1000, delivery: 50, commission: 100, net: 950 }] });
  assert.match(s.html, /Wednesday/); assert.match(s.subject, /₹950\.00/);
  assert.match(renderEmail("subscription_reminder", { plan: "Crave", daysLeft: 1, endsOn: "2026-11-30", period: "monthly", amount: 999 }).subject, /ends tomorrow/);
});

test("raw MIME carries attachments and header values cannot inject new headers", () => {
  const raw = buildRawMime({ to: "a@b.in\r\nBcc: evil@x.com", subject: "Hi\r\nBcc: evil@x.com", html: "<p>x</p>", text: "x", attachments: [{ filename: "agreement.pdf", contentType: "application/pdf", content: Buffer.from("%PDF-1.4") }] }, "Sheplates <no-reply@sheplates.com>", "support@sheplates.com");
  assert.doesNotMatch(raw, /^Bcc:/m); assert.match(raw, /filename="agreement.pdf"/); assert.match(raw, /multipart\/mixed/); assert.match(raw, /^From: Sheplates <no-reply@sheplates.com>/m);
  assert.equal(emailSettings({}).region, "ap-south-1"); assert.equal(emailSettings({}).transport, "console"); assert.equal(emailSettings({ AWS_ACCESS_KEY_ID: "x" }).transport, "ses");
});

test("enqueue: bad addresses are refused, and the same event is never queued twice", async () => {
  const admin = fakeAdmin();
  assert.equal(validEmail("a@b.co"), true); assert.equal(validEmail("not-an-email"), false); assert.equal(validEmail("a@b.co,c@d.co"), false);
  assert.equal(await enqueueEmail(admin, { to: "bad", template: "order_confirmed", data: {} }), false);
  assert.equal(await enqueueEmail(admin, { to: "Cust@Example.com", template: "order_confirmed", data: {}, dedupeKey: "o1" }), true);
  assert.equal(await enqueueEmail(admin, { to: "cust@example.com", template: "order_confirmed", data: {}, dedupeKey: "o1" }), false);
  assert.equal(admin.tables.email_outbox.length, 1); assert.equal(admin.tables.email_outbox[0].to_email, "cust@example.com");
});

test("worker sends due mail once, retries temporary failures with a wait, and stops at a permanent failure", async () => {
  const admin = fakeAdmin(); const now = new Date(Date.now() + 3_600_000); // an hour from now, so rows created "now" are due
  await enqueueEmail(admin, { to: "a@b.co", template: "payment_failed", data: { orderNumber: "SP-1" }, dedupeKey: "a", sendAfter: new Date(now.getTime() - 3_600_000) });
  await enqueueEmail(admin, { to: "later@b.co", template: "payment_failed", data: {}, dedupeKey: "later", sendAfter: new Date(now.getTime() + 86_400_000) });
  const t = okTransport();
  assert.deepEqual(await processOutbox(admin, t, { now }), { picked: 1, sent: 1, retried: 0, failed: 0, suppressed: 0 });
  assert.equal(t.sent.length, 1); assert.equal(admin.tables.email_outbox[0].status, "sent");
  assert.equal((await processOutbox(admin, t, { now })).picked, 0, "a sent mail is never sent again; a future one waits");

  const flaky = { send: async () => { throw new Error("throttled"); } };
  await enqueueEmail(admin, { to: "c@b.co", template: "payment_failed", data: {}, dedupeKey: "c" });
  const r1 = await processOutbox(admin, flaky, { now }); assert.equal(r1.retried, 1);
  const row = admin.tables.email_outbox.find((r) => r.dedupe_key === "c"); assert.equal(row.status, "pending"); assert.ok(new Date(row.next_attempt_at) > now);
  row.attempts = MAX_ATTEMPTS - 1; row.next_attempt_at = now.toISOString();
  assert.equal((await processOutbox(admin, flaky, { now })).failed, 1, "gives up after the last attempt");

  await enqueueEmail(admin, { to: "d@b.co", template: "payment_failed", data: {}, dedupeKey: "d" });
  const rejected = { send: async () => { throw new PermanentEmailError("MessageRejected"); } };
  assert.equal((await processOutbox(admin, rejected, { now })).failed, 1, "a rejected address is not retried");
});

test("suppressed addresses are never mailed, and attachments are fetched from private storage", async () => {
  const admin = fakeAdmin(); const now = new Date(Date.now() + 60_000);
  await suppressEmail(admin, "Bounce@Example.com", "bounce", "General");
  await enqueueEmail(admin, { to: "bounce@example.com", template: "payment_failed", data: {}, dedupeKey: "s" });
  const t = okTransport(); assert.equal((await processOutbox(admin, t, { now })).suppressed, 1); assert.equal(t.sent.length, 0);
  await enqueueEmail(admin, { to: "v@example.com", template: "agreement_signed", data: {}, dedupeKey: "p", attachments: [{ path: "x/agreement.pdf", filename: "agreement.pdf", contentType: "application/pdf" }] });
  await processOutbox(admin, t, { now }); assert.equal(t.sent[0].attachments[0].filename, "agreement.pdf"); assert.equal(t.sent[0].attachments[0].content.toString(), "%PDF");
});

test("SNS: genuine signatures verify, tampering and non-Amazon hosts are refused, only hard bounces and complaints count", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const m = { Type: "Notification", MessageId: "1", TopicArn: "arn:aws:sns:ap-south-1:1:t", Message: "{}", Timestamp: "2026-11-07T00:00:00Z", SignatureVersion: "2", SigningCertURL: "https://sns.ap-south-1.amazonaws.com/c.pem" };
  const sign = createSign("RSA-SHA256"); sign.update(stringToSign(m), "utf8"); m.Signature = sign.sign(privateKey, "base64");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  assert.equal(verifySnsSignature(m, pem), true); assert.equal(verifySnsSignature({ ...m, Message: "{\"x\":1}" }, pem), false);
  assert.equal(isAmazonUrl("https://sns.ap-south-1.amazonaws.com/c.pem"), true); assert.equal(isAmazonUrl("https://sns.ap-south-1.amazonaws.com.evil.com/c.pem"), false); assert.equal(isAmazonUrl("http://sns.us-east-1.amazonaws.com/c.pem"), false);
  assert.deepEqual(parseSesEvent(JSON.stringify({ notificationType: "Bounce", bounce: { bounceType: "Permanent", bounceSubType: "General", bouncedRecipients: [{ emailAddress: "x@y.co" }] } })).emails, ["x@y.co"]);
  assert.equal(parseSesEvent(JSON.stringify({ notificationType: "Bounce", bounce: { bounceType: "Transient", bouncedRecipients: [{ emailAddress: "x@y.co" }] } })), null);
  assert.equal(parseSesEvent(JSON.stringify({ notificationType: "Complaint", complaint: { complainedRecipients: [{ emailAddress: "z@y.co" }] } })).kind, "complaint");
});
