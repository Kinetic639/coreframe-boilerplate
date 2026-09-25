# Ambra — Current Presentation Demo Setup

Defines the exact demo environment required for the current pitch, per `docs/mvp/ambra-skrypt-prezentacji.md` and `docs/mvp/reviews/pitch-readiness-rebaseline-2026-09-23/`. **Supersedes `docs/mvp/mvp-readiness-test-org-setup.md`** (2026-08-12, covered only QR/locations + Help Desk — predates RepairOrders/Matcher-approval/receiving/putaway/containers/issue entirely).

**This document does NOT create the data.** It specifies what must exist before rehearsal.

## Organization

- One demo organization.

## Branches

- **At least two branches**, so Zone 1 branch switching can be demonstrated/verified live (this is the exact mechanism the confirmed Zone 1 bugs affect — the demo itself must exercise a real branch switch, not merely claim the capability). CREATE BEFORE REHEARSAL.

## Users

- **Presenter/admin** — full access, the account driving most of the demo. CREATE BEFORE REHEARSAL.
- **Warehouse user** — a distinct role from admin, used to demonstrate role-scoped access and the branch-switch scenario. CREATE BEFORE REHEARSAL.
- **Advisor/acceptor** — a second, contrasting role, used if the chosen Zone 1 administrative scenario (role change or invitation) needs a second account. CREATE BEFORE REHEARSAL.
- **Optional Help Desk second user** — only if Zone 8's two-account ticket scenario (create → comment → accept) is included in the final choreography. CREATE BEFORE REHEARSAL if used.

## Data

| Datum                                                                   | Timing                                                                                                                                                          |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Representative products/SKUs                                            | CREATE BEFORE REHEARSAL                                                                                                                                         |
| Warehouse locations (a small, named set with unique codes)              | CREATE BEFORE REHEARSAL                                                                                                                                         |
| Receiving location (designated per branch)                              | CREATE BEFORE REHEARSAL                                                                                                                                         |
| One RepairOrder with representative lines                               | CREATE BEFORE REHEARSAL (or live during Matcher demo — see below)                                                                                               |
| One Matcher source session that materializes into the RepairOrder above | CREATE DURING DEMO (this is the live-demoed step itself — §3/§6 of the script)                                                                                  |
| One reservation                                                         | CREATE DURING DEMO (part of the live container-workflow chain, once Phase 10D/10E land)                                                                         |
| One allocation                                                          | CREATE DURING DEMO (same chain)                                                                                                                                 |
| One container                                                           | CREATE DURING DEMO (same chain)                                                                                                                                 |
| Container QR (after Phase 10D lands)                                    | CREATE DURING DEMO — printed/assigned live as part of the container step                                                                                        |
| Location QR (printed labels for the demo location set)                  | CREATE BEFORE REHEARSAL — must be physically printed and tested on the presentation printer ahead of time, not generated live                                   |
| Stock sufficient for putaway/relocation/issue                           | CREATE BEFORE REHEARSAL (the underlying delivery/receiving quantities); the putaway/relocation/issue operations THEMSELVES are performed live                   |
| One ticket, if Help Desk is shown                                       | CREATE DURING DEMO (the create step is itself part of the Zone 8 demo) — or CREATE BEFORE REHEARSAL if the chosen choreography instead opens an existing ticket |
| One planning task, only if Planning is shown                            | CREATE BEFORE REHEARSAL, if the narrow Zone 9 example is included                                                                                               |

## Devices

- **Presentation laptop** — primary driving device for Matcher, RepairOrder detail views, search/relocation UI, dashboard.
- **Presentation phone** — required for: QR scanning (location + container once Phase 10D lands), mobile putaway (once built, P0-3), ticket QR scan (if Zone 8 shown). Must be tested at the actual presentation location beforehand (camera permissions, HTTPS, lighting) — per `mvp-readiness.md`'s own risk table.
- **Printer** — only if label printing itself will be demonstrated live; otherwise labels are pre-printed (see Data table above) and the printer is not part of the live demo path.

## Sequencing note

This setup document assumes the P0 blockers in `presentation-ready-gate.md` are resolved before rehearsal — several data rows above (container, container QR, mobile putaway session) depend on code that does not exist yet as of 2026-09-23. Do not attempt to prepare those specific data rows until the corresponding P0 item has landed.

## Manual UAT scenarios this setup must support

Cross-referenced from `mvp-readiness.md`'s own "Globalny plan weryfikacji ręcznej" table and `presentation-ready-gate.md`'s own done-criteria — this setup's org/branch/user/data combination must be sufficient to execute, in order: Access (Zone 1, including a real branch switch) → Matcher public + persistent → RepairOrder + attachments → Receiving/putaway → Search/relocation (including container QR relocation) → Issue (201/WZ) → Access administration → Ticket (if shown) → full dress-rehearsal run.

## Browser/device matrix

- Desktop browser on the presentation laptop (primary driving device for non-phone steps).
- Mobile browser on the presentation phone (camera-based QR scanning, mobile putaway).
- No other device/browser combination is required — the product is a responsive web app, not a native mobile app; there is no separate "mobile app" build to test.
