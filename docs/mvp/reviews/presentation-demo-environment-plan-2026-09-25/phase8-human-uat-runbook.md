# Zone 1 Phase 8 — Human UAT Runbook

Self-contained — follow step by step without needing to read any implementation doc. Fill in the PASS/FAIL and Evidence fields as you go; when finished, this filled-in copy becomes the actual Phase 8 UAT evidence, replacing the pending rows in `docs/mvp/reviews/zone1-phase8-manual-uat-2026-09-24/`.

**Prerequisite:** the demo environment (org `Ambra Demo`, branches Warszawa/Kraków, 3 users, fixtures, 2 printed QR labels) must already exist — see `demo-org-design.md`, `demo-users-and-roles.md`, `warehouse-fixture-plan.md`, `qr-fixture-plan.md`, and `approval-checklist.md`. This runbook does not create anything.

**Record once, at the top, before starting:** Date: **\_\_** Build/commit SHA tested: **\_\_** Tester name: **\_\_**

---

## A. Desktop setup

1. Open the presentation laptop's browser to the app's URL.
2. Confirm the page loads without a console error banner.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## B. Presenter login

1. Log in as **USER 1 (Presenter/Admin)**.
2. Confirm you land on the dashboard, active branch shows **Warszawa**.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## C. Sidebar branch switch (A→B and B→A)

1. **Account:** USER 1. **Starting branch:** Warszawa.
2. **Action:** open any branch-sensitive Warehouse page (e.g. Locations). Use the SidebarBranchSwitcher to switch to Kraków.
3. **Expected:** switch succeeds; browser lands on `/dashboard/start`; no stale Warszawa route remains; active-branch display shows Kraków; no logout; browser Back does not restore an unsafe Warszawa detail page.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

4. **Action:** switch back Kraków → Warszawa.
5. **Expected:** same, symmetric behavior.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## D. Permission context switch

1. **Account:** USER 2 (Warehouse Worker). **Starting branch:** Warszawa (Manager-level role here).
2. **Action:** note which actions/navigation items are visible (the broader Manager set). Switch to Kraków (Warehouse-Worker-level role here) via the SidebarBranchSwitcher.
3. **Expected:** active branch becomes Kraków; navigation/actions visibly narrow to the Warehouse-Worker set; no Warszawa-Manager-only action remains available/clickable; no logout, no manual reload needed.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

4. **Action:** switch back to Warszawa.
5. **Expected:** the broader Manager permission set correctly restores.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## E. Locations

1. **Account:** USER 1. **Starting branch:** Warszawa.
2. **Action:** open Locations, note the visible Warszawa locations (WAW-01, WAW-02).
3. **Action:** switch to Kraków.
4. **Expected:** Warszawa's location list does not remain visible; Kraków's locations (KRK-01, KRK-02) load; no incorrectly-surviving selected-Warszawa-location state.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

5. **Action:** switch back to Warszawa; repeat the check in reverse.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## F. Inventory Balances

1. **Account:** USER 1. **Starting branch:** Warszawa.
2. **Action:** open Inventory Balances, note a recognizable Warszawa value (e.g. AMB-DEMO-001 quantity).
3. **Action:** switch to Kraków.
4. **Expected:** Warszawa's balance list is not reused; Kraków's own (deliberately different) balances appear; no stale cached Warszawa row remains (the AMB-DEMO-002 = 0-in-Kraków fixture is a good specific thing to check here).

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

5. **Action:** switch back; repeat in reverse.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## G. Inventory Movements

1. **Account:** USER 1. **Starting branch:** Warszawa.
2. **Action:** open Movements, note recognizable Warszawa data.
3. **Action:** switch to Kraków.
4. **Expected:** correct Kraków movement list; no Warszawa cached list reused.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

5. **Action (Phase 1 redirect check):** open a movement detail while in Warszawa, then use the branch switcher.
6. **Expected:** redirected away to the safe start page; the old movement detail does not remain mounted/usable.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## H. Inventory Products

1. **Account:** USER 1. **Starting branch:** Warszawa.
2. **Action:** open Products, note Warszawa data. Switch to Kraków.
3. **Expected:** correct Kraków products; no stale Warszawa cache.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

4. **Action:** switch back Kraków → Warszawa.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## I. RepairOrder / RSC safe redirect

1. **Account:** USER 1. **Starting branch:** Warszawa.
2. **Action:** open the RepairOrder detail page (`RO-DEMO-001`). Use the branch switcher to go to Kraków.
3. **Expected:** redirect to the safe start route; the RepairOrder detail is gone, not stale/still-usable; no 404/`notFound()` trap occurs during the transition. (Do not test unsaved-form protection here — that's PILOT Phase F, out of scope.)

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## J. Matcher

1. **Account:** USER 1. **Starting branch:** Warszawa.
2. **Action:** open Matcher, note the recognizable Warszawa session. Switch to Kraków.
3. **Expected:** the Warszawa session disappears; the Kraków session appears; no stale Warszawa session-list cache reused.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

4. **Action:** switch back to Warszawa.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

5. **If the live choreography includes approval/materialization:** perform the normal rehearsed flow now and confirm the session list refreshes correctly afterward. Do not broaden into unrelated Matcher testing.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## K. Same-branch location QR — REAL PHONE

1. **Account:** logged in as USER 1 on the presentation phone. **Starting branch:** Warszawa.
2. **Action:** scan the physical QR-A1 label (WAW-01).
3. **Expected:** correct app/browser opens; WAW-01 opens exactly; no branch-switch dialog; no fallback to the first location; correct target selected.

- [ ] PASS / [ ] FAIL — Evidence (photo/description): ************\_\_\_************

## L. Accessible cross-branch QR — cancel — REAL PHONE

1. **Account:** USER 1 or USER 2, phone. **Starting branch:** Warszawa.
2. **Action:** scan the physical QR-B1 label (KRK-01).
3. **Expected:** the confirm-then-switch dialog appears; the target is NOT opened before confirmation.
4. **Action:** tap Cancel.
5. **Expected:** stays in Warszawa; no target opens; dialog closes.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## M. Accessible cross-branch QR — confirm — REAL PHONE

1. **Account:** same as L. **Action:** scan QR-B1 again, tap "Switch branch" (Confirm).
2. **Expected:** switches to Kraków; the exact scanned location (KRK-01) opens, no fallback; active-branch UI shows Kraków.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## N. Inaccessible cross-branch QR — REAL DEVICE

1. **Account:** USER 3 (Advisor/Restricted — no Kraków access at all). **Starting branch:** Warszawa.
2. **Action:** scan the SAME physical QR-B1 label.
3. **Expected:** NO switch-branch dialog; Kraków is NOT activated; target is NOT opened; a safe not-found/unavailable state appears; no branch name or location metadata is unnecessarily disclosed.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## O. Logged-out QR — REAL PHONE/BROWSER

1. **Action:** log out completely. Scan/open a location QR (either label).
2. **Expected flow:** QR → sign-in page → log in → returns through `/qr/<token>` → target intent survives → then, depending on the target: same-branch opens directly, or accessible-other-branch shows the confirm dialog.
3. **Critically verify:** the selected target is NOT lost after login; the user does NOT land on a generic, unfiltered Locations page.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

4. **If feasible, also verify:** the inaccessible-target denial still works correctly after a fresh login as USER 3.

- [ ] PASS / [ ] FAIL — Evidence: ************\_\_\_************

## P. Console / network sanity (performed throughout A-O, recorded once here)

Check for: uncaught console errors, repeated failing requests, infinite refetch loops, hydration errors, branch-switch request failures, QR resolver failures. Warnings unrelated to the flow under test do not automatically fail UAT.

- [ ] Clean / [ ] Issues found — Evidence: ************\_\_\_************

---

## Mobile UX check (presentation phone, alongside K-O)

- [ ] QR dialog fits viewport, no horizontal overflow
- [ ] Buttons are tappable
- [ ] Polish translation text is readable
- [ ] "Switching..." loading state is understandable, not frozen-looking
- [ ] Final Locations view is usable for the demo

## Bug rule

If any step above fails: classify as **A. DEMO BLOCKER**, **B. SHOULD FIX**, or **C. PILOT/DEFER**, and record reproduction/expected/actual/likely-ownership in `docs/mvp/reviews/zone1-phase8-manual-uat-2026-09-24/bugs-found.md` (or its successor once this runbook's results are merged back in). A DEMO BLOCKER means Phase 8 is not DONE yet, even if every other row passed.
