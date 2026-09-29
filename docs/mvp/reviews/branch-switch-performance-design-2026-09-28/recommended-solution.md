# Recommended Solution

**Decision: ALT-2 (single-request, server-authoritative switch, off the contended action queue), combined with ALT-5 (function co-location), delivered in stages.** Each stage is independently shippable and measurable, and each keeps every Zone 1 invariant.

## Stage 0: Production measurement gate (no code, ~15 min, human)

Capture the data in `measurement-plan.md` for 3 switches on the Vercel deployment. It **doesn't change the design**. It sets the baseline, confirms the region, and ranks H1–H5 so each stage's gain can be proven.

Stop and re-decide only if it reveals a cause outside H1–H5. For example: a single Supabase call taking seconds, or Auth throttling.

## Stage 1: Co-locate functions with Supabase (config, owner decision)

- Set the Vercel project Function Region to **`dub1`** (Dublin, same metro as Supabase eu-west-1). Use Settings → Functions, or `apps/web/vercel.json` `{"regions":["dub1"]}`.
- Enable Fluid compute if it's available and off.
- Before switching, check that no other latency-critical upstream is US-only.
- Expected effect: per-call ~0.10–0.15 s → ~0.01–0.03 s on **every** dashboard request, not just the switch. The pre-toast queue terms shrink by the same factor.
- **Requires the product owner's approval** (it's a deployment setting). It is not a runtime code change in the sense of this review.

## Stage 2: Honest UX and queue decontention (client-only, low risk)

1. **Pending UI.** A spinner and "Switching to <B>…" on the switcher, `aria-busy` + a dim on main, and an `aria-live` announcement. Same pattern in the cross-branch QR confirm button.
2. **Success on commit.** Move `toast.success` so it fires once the branch-B shell is committed. In the current flow that is when `isPending` turns false after `refresh`; in Stage 3 it is the handshake.
3. **Poll suppression.** The status-bar poll skips while a switch is pending, and debounces focus/visibility triggers (e.g. no focus-poll within 10 s of the previous one).
4. **Seed `PermissionsSync` from SSR.** Pass `initialData` from `context.user.permissionSnapshot` for `[v2, permissions, orgId, activeBranchId]`, so full mounts don't enqueue `getBranchPermissions`.

Items 3 and 4 remove the known queue contenders without moving any server code.

## Stage 3: Single-request switch

1. `changeBranch(branchId, target?)`:
   - authorization unchanged (`getUser` → `loadDashboardContextV2` → org membership → `isBranchAccessible` → `UPDATE`);
   - on success, `redirect()` to `/<locale>` + a **server-chosen** target from an allowlist: `start` (default), or `warehouse.locations` with a validated `selected` id for the QR flow;
   - the target carries `switched=<branchId>`;
   - on failure it returns `{ success:false, error }` as today, with no redirect.
2. Switcher and QR confirm stop calling `setActiveBranch`, `router.replace` and `router.refresh`.
3. Providers hydration effect (`_providers.tsx`): if `switched` equals `context.app.activeBranchId`, then:
   - write sessionStorage = that branch and skip the session override once;
   - strip the param with `history.replaceState`;
   - emit the "switch committed" signal → toast + clear pending.

   Any other value → ignore.

4. Keep `HomeScopeBoundary` unchanged. With store == server branch it no longer fires during a switch.
5. Fallback: if Next can't stream the redirect target (`createRedirectRenderResult` failure), it performs a client navigation. That is still one render of the full tree, just 2 requests.

## Stage 4: Shrink the per-request serial chain (server, same semantics)

1. Request-scoped `getAuthUser()` (React `cache()` around the same `supabase.auth.getUser()`). Used by `changeBranch`, the app/user/admin loaders and `getBranchPermissions`.
2. Parallelize inside `loadAppContextV2` / `loadUserContextV2` / `getPermissionSnapshotForUser`, per the safety table in `context-auth-analysis.md`.
3. `loadAdminContextV2` reuses the request's user context.
4. Layout post-context loaders in parallel (`Promise.all`/`allSettled`, preserving today's degradation).
5. Status-bar latest activity → a `GET` Route Handler with the same auth + RLS and a lightweight org lookup. It is fetched outside the router queue.

## Expected result

| After stage | Serial calls on switch path | Transatlantic (iad1) | Co-located (dub1) |
| ----------- | --------------------------- | -------------------- | ----------------- |
| today       | 44 + queue (0–17+)          | 15–25 s observed     | —                 |
| 1           | 44 + queue                  | —                    | ~1.5–3 s (+ cold) |
| 1+2         | 44, no known queue          | —                    | ~1–2 s, honest UX |
| 1+2+3       | 32                          | ~4–5 s               | ~0.6–1.2 s        |
| 1+2+3+4     | ~14                         | ~1.6–2.4 s           | **~0.4–0.8 s**    |

- **Demo target (ACCEPTABLE):** reached by Stage 1+2, or by 2+3+4 without Stage 1.
- **GOOD:** reached by 1+2+3, with margin after 4.

## Explicitly not changed

- DB, RLS, migrations, `user_effective_permissions`, `isBranchAccessible` semantics, the org-membership check.
- `getUser` validation (never `getSession`), the proxy session refresh.
- Tickets/Tasks scope (org-scoped Tickets, access-scoped Tasks: prior verification stands).
- Zone 1 invariant: `changeBranch` is the only persistent switch; `branchId` is never authorization input (the `switched` hint is compared against the server context only).
