import assert from "node:assert/strict";
import test from "node:test";
import { documentStatuses, agreementComplete, awaitingReview, validateUpload, sniffType, UPLOAD_MAX_BYTES, safeFileName } from "../lib/agreement-status.ts";

const sig = (id) => ({ document_id: id, document_version: "1.0" });
const up = (id, status, at, extra = {}) => ({ id: `${id}-${at}`, document_id: id, document_version: "1.0", status, uploaded_at: at, ...extra });

test("a vendor starts with nothing signed, and both documents must be done", () => {
  const none = documentStatuses([], []);
  assert.deepEqual(none.map((d) => d.state), ["not_signed", "not_signed"]);
  assert.equal(agreementComplete(none), false);
  assert.equal(agreementComplete(documentStatuses([sig("partnership_agreement"), sig("terms_conditions")], [])), true);
  assert.equal(agreementComplete(documentStatuses([sig("partnership_agreement")], [])), false, "one of two is not enough");
});

test("a hand-signed upload counts only after Operations accepts it; a rejected one can be replaced", () => {
  const pending = documentStatuses([sig("terms_conditions")], [up("partnership_agreement", "pending", "2026-11-09T10:00")]);
  assert.equal(pending[0].state, "upload_pending");
  assert.equal(agreementComplete(pending), false);
  assert.equal(awaitingReview(pending), true);
  const accepted = documentStatuses([sig("terms_conditions")], [up("partnership_agreement", "accepted", "2026-11-09T10:00")]);
  assert.equal(accepted[0].state, "upload_accepted");
  assert.equal(agreementComplete(accepted), true);
  const rejected = documentStatuses([], [up("partnership_agreement", "rejected", "2026-11-09T10:00", { review_note: "Signature missing" })]);
  assert.equal(rejected[0].state, "upload_rejected");
  assert.equal(rejected[0].note, "Signature missing");
  const reuploaded = documentStatuses([], [up("partnership_agreement", "rejected", "2026-11-09T10:00"), up("partnership_agreement", "pending", "2026-11-09T11:00")]);
  assert.equal(reuploaded[0].state, "upload_pending", "the newest upload decides");
});

test("an online signature or an accepted upload outranks everything else, and an old version does not count", () => {
  assert.equal(documentStatuses([sig("partnership_agreement")], [up("partnership_agreement", "rejected", "2026-11-09T10:00")])[0].state, "signed_online");
  assert.equal(documentStatuses([], [up("partnership_agreement", "accepted", "2026-11-01T10:00"), up("partnership_agreement", "pending", "2026-11-09T10:00")])[0].state, "upload_accepted");
  assert.equal(documentStatuses([{ document_id: "partnership_agreement", document_version: "0.9" }], [])[0].state, "not_signed");
});

test("upload checks: real type from the first bytes, size limit, matching declared type", () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal(sniffType(pdf), "application/pdf"); assert.equal(sniffType(png), "image/png"); assert.equal(sniffType(jpg), "image/jpeg");
  assert.equal(sniffType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(sniffType(new Uint8Array([0x4d, 0x5a, 0x90])), null, "an executable is not accepted");
  assert.equal(validateUpload({ size: 5, type: "application/pdf" }, pdf), null);
  assert.equal(validateUpload({ size: 5, type: "" }, pdf), null, "browsers sometimes send no type");
  assert.match(validateUpload({ size: 0, type: "application/pdf" }, pdf), /empty/);
  assert.match(validateUpload({ size: UPLOAD_MAX_BYTES + 1, type: "application/pdf" }, pdf), /under 10 MB/);
  assert.equal(validateUpload({ size: UPLOAD_MAX_BYTES, type: "application/pdf" }, pdf), null, "exactly 10 MB is allowed");
  assert.match(validateUpload({ size: 5, type: "application/pdf" }, new Uint8Array([0x4d, 0x5a])), /PDF, PNG, JPG or WebP/);
  assert.match(validateUpload({ size: 5, type: "image/png" }, pdf), /does not match/);
  assert.equal(safeFileName("../../etc/passwd<script>.pdf").includes("/"), false);
  assert.ok(safeFileName("x".repeat(300)).length <= 80);
});

import { readFileSync } from "node:fs";
test("the endpoints and screens for both ways of signing are wired together", () => {
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  const upload = read("app/api/vendor/sign/upload/route.ts"), review = read("app/api/vendor/sign/review/route.ts");
  assert.match(upload, /ownVendor\(/, "only the vendor's own owner can upload");
  assert.match(upload, /validateUpload\(/, "the file is checked by its real type and size");
  assert.match(upload, /signed-agreements/, "stored in the private bucket");
  assert.match(review, /isStaff\(ctx\.role\)/, "only Operations or Super Admin review");
  assert.match(review, /\.eq\("status", "pending"\)/, "an upload can be reviewed only once");
  assert.match(review, /decision === "rejected" && note\.length < 3/, "a rejection must say what to fix");
  const v3 = read("components/sheplates-v3.tsx");
  assert.match(v3, /agreementDone === false/, "approval waits for both documents");
  assert.match(v3, /<OpsAgreementPanel /);
  assert.match(v3, /<AgreementPanel /);
  assert.match(read("components/vendor-compliance.tsx"), /agreement-next-step/, "onboarding tells the vendor about both ways to sign");
});
