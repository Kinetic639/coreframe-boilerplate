# Approval Checklist — Every Live-Target-Mutating Action in This Plan

**Nothing below is approved merely because this planning document exists.** Every checkbox is currently unchecked and represents an action this agent has NOT taken and will NOT take without explicit, separate confirmation. This is the single list to review before authorizing execution.

## Organization / Branches / Accounts

- [ ] Create demo organization `Ambra Demo`
- [ ] Create Branch A (`Warszawa`)
- [ ] Create Branch B (`Kraków`)
- [ ] Create/invite USER 1 (Presenter/Admin) account + org membership
- [ ] Create/invite USER 2 (Warehouse Worker) account + org membership
- [ ] Create/invite USER 3 (Advisor/Restricted) account + org membership
- [ ] Assign USER 1's org-wide administrative role
- [ ] Assign USER 2's Manager-level role on Warszawa
- [ ] Assign USER 2's Warehouse-Worker-level role on Kraków
- [ ] Assign USER 3's Advisor-level role on Warszawa (and confirm NO role/access is granted on Kraków)

## Warehouse fixtures

- [ ] Create locations WAW-01, WAW-02 (Warszawa)
- [ ] Create locations KRK-01, KRK-02 (Kraków)
- [ ] Create products AMB-DEMO-001, AMB-DEMO-002, AMB-DEMO-003
- [ ] Post initial stock/balances (Warszawa quantities as specified in `warehouse-fixture-plan.md`)
- [ ] Post initial stock/balances (Kraków quantities, deliberately different, including the AMB-DEMO-002 = 0 case)
- [ ] Post 2-3 representative movements in Warszawa
- [ ] Post 2-3 representative movements in Kraków

## RepairOrder / Matcher

- [ ] Create RepairOrder `RO-DEMO-001` (Warszawa) with its lines
- [ ] Decide, with the product owner: is materialization performed now (fixture) or reserved for the live pitch itself (per `presentation-demo-setup.md`'s own "CREATE DURING DEMO" note)?
- [ ] Create/upload the Matcher source document and session for Warszawa
- [ ] Create/upload the Matcher source document and session for Kraków

## QR

- [ ] Generate QR code for WAW-01 (`QR-A1`)
- [ ] Generate QR code for KRK-01 (`QR-B1`)
- [ ] Assign `QR-A1` → WAW-01 via the Quick-Assign UI
- [ ] Assign `QR-B1` → KRK-01 via the Quick-Assign UI
- [ ] Print both QR labels — **HUMAN ACTION REQUIRED**, this agent cannot print
- [ ] Test both printed labels scan correctly at the actual presentation location (lighting, HTTPS, camera permissions) — **HUMAN ACTION REQUIRED**

## Explicitly requires human decision before ANY of the above proceeds

- [ ] Final choice of real email addresses/credentials for the 3 accounts (this plan uses placeholders only, per instruction)
- [ ] Final choice of the "one administrative action" for the Phase 8 "Gate to DEMO READY" scenario (a role change? an invitation? — `demo-users-and-roles.md` leaves this open, dependent on the final choreography)
- [ ] Confirmation that reusing "Warszawa"/"Kraków" as branch names is acceptable (vs. a different naming choice) for the actual presentation
- [ ] Confirmation of the exact product/part names to use (this plan proposes a shape, not final copy — see `warehouse-fixture-plan.md`'s "final names TBD with the product owner" note)

## No direct SQL is anticipated anywhere in this plan

If execution later reveals a genuine need for one (see `creation-method-matrix.md`'s own "Direct SQL requirement: NONE identified" section), that specific SQL statement will be presented for its own explicit approval before running — never bundled into a blanket "proceed with the plan" approval.
