# Zone 1 / Phase 8 — Mobile / QR Results

**Status: AWAITING HUMAN UAT — none of these scenarios were executed.**

This agent has no physical presentation phone, no camera, and no way to perform an actual QR scan or judge mobile rendering. This is a hard capability boundary, not something more time or effort could close — these scenarios require a human with the actual device, at the actual presentation location (per `presentation-demo-setup.md`'s own note: "Must be tested at the actual presentation location beforehand (camera permissions, HTTPS, lighting)").

## Required scenarios (all pending)

### Same-branch location QR (Section 12)

**Action required of the human tester:**

1. Ensure the presentation environment exists (org, 2 branches, a location in the active branch, a printed/tested QR label for it — see `uat-environment.md`).
2. While logged in and active in Branch A, on the actual presentation phone, scan the Branch-A location's QR label.
3. Verify: correct app/browser opens; the exact location opens; no branch-switch dialog appears; no fallback to the first location in the tree; the correct target is selected in the UI.
4. Record PASS/FAIL with a screenshot or description of what actually happened.

### Accessible cross-branch location QR (Section 13)

**Action required:**

1. Using an account with access to both Branch A and Branch B, while active in Branch A, scan a Branch-B location's QR label.
2. Verify the confirm-then-switch dialog appears (`crossBranchDialog.title`/`description` per `apps/web/messages/pl.json`) and the target is NOT opened before confirmation.
3. Tap Cancel — verify: stays in Branch A, no target opens, dialog closes.
4. Scan again, tap "Switch branch" (Confirm) — verify: switches to Branch B, the exact scanned location opens (not a fallback), the active-branch UI indicator shows B.

### Inaccessible cross-branch QR (Section 14)

**Action required:**

1. Using an account WITHOUT access to Branch B, scan a Branch-B location's QR label (or open the equivalent `/qr/<token>` URL directly in the phone's browser).
2. Verify: NO switch-branch dialog appears; Branch B is not activated; the target does not open; a safe "not found"/unavailable state is shown (per Phase 6 Correction A's design, this should be the QR page's existing `TARGET_NOT_FOUND` card — see `docs/mvp/reviews/zone1-phase6-cross-branch-location-qr-2026-09-24/qr-flow-contract.md`'s "Case C" section for the exact expected behavior); no branch name or location metadata is disclosed beyond what the error card already shows for any not-found target.

**Automated confidence level for this scenario:** HIGH. Phase 6's correction pass added 2 dedicated resolver tests (`public-token-resolver.test.ts` → "Correction A — inaccessible cross-branch...") plus a dedicated client test (`ambra-locations-client.cross-branch.test.tsx` → "inaccessible cross-branch target") proving this exact contract at the unit/component level, and this agent's own desktop check (`desktop-browser-results.md` §4) confirmed the underlying `TARGET_NOT_FOUND` rendering works live against the real DB. This scenario is the LEAST likely of the phone-required scenarios to surface a new finding — but per the task's own explicit instruction, it still cannot be marked PASS without the actual device-level check.

### Logged-out QR return (Section 15)

**Action required:**

1. Log out completely.
2. Scan (or open) a location QR/deep-link.
3. Verify the flow: QR → sign-in page (with the location intent preserved, not lost) → log in → returns through `/qr/<token>` → target intent survives → correct final behavior (same-branch opens directly; accessible-other-branch shows the confirm dialog).
4. Critically verify: the selected target is NOT lost after login, and the user does NOT land on a generic, unfiltered Locations page.

**Automated confidence level:** MEDIUM-HIGH. Phase 6's correction pass added "real auth-return integration" tests that call `resolvePublicQrToken` twice (once simulating the anonymous call, once simulating the post-login re-invocation) and assert the second call reaches the correct outcome — and this agent's own desktop check confirmed the `returnUrl` hidden-field mechanism the round trip depends on. What remains unverified is the actual browser navigation sequence (does `signInAction`'s redirect actually land the browser back on `/qr/<token>` in practice, with real cookies/session state) — this is exactly why the Phase 6 review bundle itself deferred final proof to this phase.

## Mobile UX check (Section 17)

**Status: AWAITING HUMAN UAT.** Requires the physical presentation phone. Checklist for the human tester (from the task):

- QR confirm dialog fits the viewport without horizontal overflow.
- Buttons (Cancel/Switch branch) are comfortably tappable.
- Polish translation text (`crossBranchDialog.*` in `apps/web/messages/pl.json`) is readable at phone size.
- The "Switching..." loading state (while `isSwitchingBranch` is true) is understandable, not just a frozen-looking button.
- The final Locations tree view is usable at phone width for the demo.

This is a presentation-readiness check, not a redesign task — only a clear demo blocker found here should be fixed; general mobile polish is out of scope.
