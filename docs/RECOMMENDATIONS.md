# Future spec upgrades (recommended, not yet approved)

Parking lot for improvements that are sound but deferred for product/behaviour
reasons. Revisit per release.

## R1 — Persist the decoded CCCD QR payload alongside the image
**Status:** Recommended; **deferred** (2026-06-08). Current end-users rely on the
**QR image itself** (they copy/paste the scannable image downstream), not a string
data field, so we are NOT persisting the decoded string yet.

**Proposal:** at capture the QR is already decoded → also store the raw QR payload
(e.g. `students.cccd_qr_raw TEXT`) and/or the parsed fields. Benefits:
- Downstream consumers (admins) no longer need to re-scan the image — the
  authoritative data is already on the record; the image becomes audit/legal proof.
- Decouples data integrity from image scannability (image quality stops being a
  hard dependency for data correctness).
- Enables search/validation on CCCD number without OCR/QR at all.

**Cost:** one nullable column + populate it in the create/QR flow; a small UI hint.
**Adopt when:** the team is ready to shift downstream behaviour away from
"paste the QR image" toward consuming structured data.
