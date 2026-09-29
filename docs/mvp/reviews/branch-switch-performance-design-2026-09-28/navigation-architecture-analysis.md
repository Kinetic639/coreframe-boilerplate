# Navigation Architecture Analysis (Problem B: action resolved → branch-correct UI, observed 5–10 s after the toast)

## Post-toast delay, explained

After `changeBranch` resolves, the client runs **two strictly serial server renders**:

| Step                                                                                                      | Calls  | At 0.10–0.15 s/call |
| --------------------------------------------------------------------------------------------------------- | ------ | ------------------- |
| `router.replace("/dashboard/start")`, page segment only                                                   | 12     | 1.2–1.8 s           |
| `router.refresh()`, queued, full tree including the layout                                                | 19     | 1.9–2.9 s           |
| plus browser↔function ×2, possible cold start of the `/dashboard/start` function, RSC streaming/hydration | —      | 0.5–3 s             |
| **Total**                                                                                                 | **31** | **~3.6–7.7 s**      |

This matches the observed 5–10 s with no unexplained remainder. When the switch starts from `/dashboard/start`, `HomeScopeBoundary` adds a third, overlapping, wasted render. It costs server load, not serial time.

## What "success" should mean

Today "success" = _the preference row was updated_. The user can't observe that. What they can observe, and what they need, is:

> **A switch has succeeded when the branch-B server-rendered shell (layout + target page) is committed on screen, and client stores agree with it.**

So:

- the success toast must fire only on that commit;
- between click and commit, the UI must show an explicit pending state that names the target branch;
- on failure, the pending state clears and the old branch stays authoritative (unchanged from today).

## Correctness requirements (derived first, before choosing a mechanism)

| #   | Requirement                                                                                                                                            | Why                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | The shared `dashboard/layout.tsx` must be re-rendered with branch B                                                                                    | It holds the sidebar model, accessible branches, and the context + permission snapshot handed to providers. A page-only navigation leaves it A-rendered (verified via partial rendering)                                                                                                                                                                                                               |
| R2  | The target page must be rendered with branch B                                                                                                         | branch-scoped widgets                                                                                                                                                                                                                                                                                                                                                                                  |
| R3  | Rendered exactly **once** per switch                                                                                                                   | there is no semantic reason for two renders                                                                                                                                                                                                                                                                                                                                                            |
| R4  | Client stores must converge to the **server-rendered** branch, not the other way round                                                                 | server-authoritative invariant                                                                                                                                                                                                                                                                                                                                                                         |
| R5  | **The per-tab sessionStorage branch must be B before the new context's hydration effect runs**                                                         | `_providers.tsx:55-89`: on every context change, if `sessionStorage` holds an accessible branch, it **overrides** the server's `activeBranchId`. If it still holds A, a correctly B-rendered shell would be flipped back to A on the client. (Today `setActiveBranch(B)` writes the entry before navigating, so this works; any redesign that stops calling `setActiveBranch` early must preserve it.) |
| R6  | The store/server branch mismatch must not trigger `HomeScopeBoundary`'s corrective navigation during a switch                                          | a wasted render, plus a race                                                                                                                                                                                                                                                                                                                                                                           |
| R7  | Must not depend on client-supplied `branchId` for authorization                                                                                        | Zone 1 invariant                                                                                                                                                                                                                                                                                                                                                                                       |
| R8  | Failure leaves A fully authoritative, including sessionStorage                                                                                         | existing Zone 1 behavior/tests                                                                                                                                                                                                                                                                                                                                                                         |
| R9  | Target = `/dashboard/start` (product default). The current page is not a safe target in general: a detail route for an A-object is meaningless under B | the cross-branch QR flow is the exception: it targets an exact object that is known to be in B                                                                                                                                                                                                                                                                                                         |

## Candidate mechanisms against R1–R9

| Mechanism                                                      | R1                                                                              | R3 (renders)          | Requests after click                                                                                           | Notes                                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Today: action → `replace` → `refresh`                          | ✔                                                                               | ✘ (2)                 | 3 serial                                                                                                       | R5 ✔ (early `setActiveBranch`); R6 ✘                                                                                              |
| Action → `refresh()` only                                      | ✔                                                                               | ✔ (1)                 | 2                                                                                                              | stays on the current page (✘ R9 in general)                                                                                       |
| Action → `router.push` to a URL that forces a full-tree render | partial                                                                         | ✔ (1)                 | 2                                                                                                              | there is no public "navigate + refetch root" API in Next 16. Would rely on internals                                              |
| **Action calls `redirect(localized /dashboard/start)`**        | ✔ (the internal fetch drops `Next-Router-State-Tree`, so the full tree renders) | ✔ (1)                 | **1** (action + tree streamed in the same response; Next falls back to a client navigation if streaming fails) | fits R9. R5/R6 need the handshake below                                                                                           |
| Route Handler POST → 303 → full document load                  | ✔                                                                               | ✔ (1 SSR + hydration) | 1 document                                                                                                     | resets all client state (strong R4) but bypasses server-action origin protection, so CSRF must be done by hand; full reload flash |
| Client-side optimistic switch, then background persist         | ✘                                                                               | —                     | —                                                                                                              | violates R4/R7: UI claims B before the server agrees                                                                              |

**Chosen mechanism: server action + `redirect()` with a one-shot "switched" handshake.**

```
click B
 → UI: pending state "Switching to <B>…" (instant)
 → client: remember pendingSwitch = {orgId, from: A, to: B} (in memory)
 → changeBranch(B)   (unchanged authorization; on success: redirect(`/<locale>/dashboard/start?switched=<B>`))
      server streams the FULL branch-B tree in the same response
 → providers hydration effect sees context.app.activeBranchId === B
      AND the URL/pendingSwitch hint says "switched to B"
      → write sessionStorage = B (adopt the server branch), skip the session override once   (R5)
      → strip ?switched from the URL (history.replaceState, not a router navigation)
 → commit → toast.success("Switched to <B>"), pending state clears                              (success = committed)
 → failure (action returns {success:false} / throws): no redirect happens; clear the pending state;
      sessionStorage/store untouched (A stays authoritative); toast.error                         (R8)
```

- The `switched` hint is **never authorization**. It only tells the client to trust the server-rendered `activeBranchId` over its own sessionStorage. That value is already server-authoritative. If the hint doesn't equal `context.app.activeBranchId`, it is ignored (R7).
- The store is updated by `hydrateFromServer` from the B context, so store and server-rendered page agree. `HomeScopeBoundary` sees no mismatch (R6).
- `PermissionsSync` should be seeded with the SSR snapshot for `[org, B]` so the branch change doesn't enqueue `getBranchPermissions` (see `context-auth-analysis.md`).
- The second caller, the cross-branch QR confirm in `ambra-locations-client.tsx`, targets `/dashboard/warehouse/locations?selected=…`. It should use the same action with a validated, app-relative redirect target chosen from an allowlist: a route name, not a free-form URL, to avoid an open redirect. Or it keeps its current replace + refresh as a documented exception in the first implementation stage.

## What must be verified during implementation (not assumed)

1. How the calling promise and `startTransition`/`isPending` behave when a server action redirects, in Next 16.1.7. The UI must stay pending until the redirected tree commits.
2. That `createRedirectRenderResult` succeeds on Vercel. The internal fetch goes to `https://<host>` through Vercel's edge and the proxy again. With Deployment Protection on previews, the forwarded cookies must include the bypass. If streaming fails, Next falls back to a client navigation: still correct, but 2 requests.
3. That the `next-intl` locale prefix is preserved in the redirect target.
