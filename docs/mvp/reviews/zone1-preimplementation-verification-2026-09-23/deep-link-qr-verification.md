# Zone 1 — Cross-Branch Deep-Link / QR Verification

Object type used: `warehouse.location` (part of the current pitch demo). Live-code verified today.

## Architecture

Two thin page wrappers (`apps/web/src/app/qr/[token]/page.tsx`, `apps/web/src/app/[locale]/qr/[token]/page.tsx`) delegate entirely to `resolvePublicQrToken(token, {locale})` in `apps/web/src/server/qr/public-token-resolver.ts`. The `warehouse.location` registry entry lives in `apps/web/src/server/qr/target-registry.ts:88-135`.

**Critical architectural fact**: `resolvePublicQrToken` uses `createServiceClient()` (service-role, RLS-bypassing) and performs **zero authentication and zero permission check** — no `getUser()`, no `requiredReadPermission` check anywhere in this file (confirmed via repo-wide grep: that permission IS enforced in `qr.service.ts`, the labels API route, attachments, and comments — but never in this specific resolver). The only checks performed are: QR exists/active/assigned, target row exists/not-soft-deleted, and `target.organization_id === qrCode.organization_id` (cross-org rejection). This is a deliberate design property (a public, anonymous QR resolver by definition can't require auth up front) — not itself a vulnerability given the findings below, but the `QrTargetDescriptor.validate()` JSDoc's claim that it "runs with the authenticated Supabase client (RLS enforced)" is **factually incorrect for this specific caller** — a stale/misleading doc comment worth correcting, though not a live security issue.

**Redirect target for `warehouse.location`**: `/dashboard/warehouse/locations?selected=<id>&view=tree` — no location name/code/metadata is ever embedded in the URL or in any error page (errors only echo back the raw scanned token).

## Scenario A — Branch A active, target in Branch B, user HAS access to B

The resolver redirects unconditionally, regardless of active branch. On arrival, the Locations page loads locations scoped to the CURRENT active branch (still A) — `selected=<B's location id>` matches nothing in that list. An explicit effect (`LocationsPage.tsx:485-490`, its own comment: "Reset selected location when the locations list changes (e.g. branch switch)") then falls back to `locations[0]` of branch A.

**Net effect: the deep link is silently dropped.** The user lands on Branch A's Locations page with an arbitrary Branch-A location selected instead — no error, no prompt, no indication the QR target existed on another branch. **No confirm-then-switch dialog exists at all for this flow** — a genuine gap against the accepted Decisions 24-27.

## Scenario B — Branch A active, target in Branch B, user LACKS access to B

Identical redirect happens (the resolver performs no access check either way). The same silent-drop-to-branch-A-first-location behavior occurs downstream, since the destination page's own location list is always scoped to branches the user can actually resolve. **No metadata leaks** (confirmed — nothing about the Branch-B location ever renders). **No branch switch occurs.** However there is also no explicit "access denied" signal distinguishing this from Scenario A — the denial is safe-by-accident (relies on the destination page's own independent scoping, not on the resolver enforcing anything explicitly).

## Scenario C — Logged out, scans QR

The QR resolver path itself is intentionally excluded from the session-required middleware matcher (`proxy.ts:10-21` doesn't match `/qr/*`). Its redirect target (`/dashboard/warehouse/locations?...`) DOES match, and IS correctly intercepted — unauthenticated users get redirected to sign-in with `returnUrl` set to the relative path (never absolute/attacker-controlled). Post-login, `signInAction` **explicitly validates** the returnUrl is same-origin (`startsWith("/") && !startsWith("//")`) — a genuine, confirmed open-redirect protection — then redirects there. It does not explicitly re-run the QR resolution, but this is safe: the destination page independently re-derives org/branch/authorization from the now-authenticated session, so the same Scenario A/B fallback logic applies post-login regardless.

## Direct-URL vs. QR parity

Confirmed functionally identical once past the token-resolution hop — the QR resolver is a pure redirect-URL builder with no bespoke branch-switch or authorization logic of its own beyond the cross-org check. This is a genuinely good architectural property (no divergent QR-specific security model) — but it also means the QR resolver contributes nothing toward the "confirm before switching branch" requirement, since that logic doesn't exist on either path today.

## Smallest implementation gap for the pitch path

**Not a security leak** — verified: no metadata leak, no silent unconsented branch switch, no open-redirect, org/branch scoping is always independently re-derived server-side downstream. **It is a missing UX feature**: the deep-link intent (open Branch B's specific location) is silently discarded in favor of "first location in whatever branch happens to be active," rather than the accepted confirm-then-switch prompt.

**Smallest fix, reusing existing pieces** (design sketch only, not implemented):

1. `resolvePublicQrToken` already resolves the target's own `branchId` — it would need to additionally know the CALLER's current active branch (requires reading `user_preferences` for logged-in requests, which this fully-anonymous resolver doesn't do today) and encode a `?crossBranch=<targetBranchId>` flag instead of a bare `selected=` param.
2. The Locations page's EXISTING reset-effect (`LocationsPage.tsx:485-490`) is the natural interception point — if a `crossBranch` param is present, render a confirm dialog instead of silently falling back; on confirm, call the ALREADY-EXISTING, ALREADY-VALIDATED `changeBranch()` server action (verified correct in `authorization-model-verification.md`, item 9) and re-navigate; on cancel, clear the param (today's behavior).
3. **No new authorization primitive is needed** — `changeBranch()` already performs the exact "does this user have access to branch B" check the contract requires. The gap is purely missing confirmation UI/state wiring between the QR/deep-link landing and that already-correct existing action.

This narrow extension applies to `warehouse.location` specifically; `helpdesk.ticket`/`planning.task` in the same registry would need the identical UI-layer intercept added at their own destination pages if desired later — the underlying `changeBranch` reuse pattern would be the same.
