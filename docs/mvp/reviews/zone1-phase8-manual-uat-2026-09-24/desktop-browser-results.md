# Zone 1 / Phase 8 — Desktop/Browser Results (Claude-Executable Portion Only)

None of these substitute for the required manual scenarios (see `uat-scenarios.md`) — they are the environment-independent subset this agent could genuinely execute: real HTTP requests against a real, locally-running instance of the exact tested SHA, connected to the real target Supabase project. No browser UI, no visual confirmation, no authenticated session.

## Setup

```
cd apps/web && pnpm dev   # bound to 127.0.0.1:3001, Next.js 16.1.7, webpack, .env.local
```

Server confirmed ready ("✓ Ready in 3.3s"). Stopped immediately after these checks (`lsof -ti:3001 | xargs kill -9`), confirmed no longer listening.

## Results

### 1. Home route

```
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/
→ 307 (redirect, expected — next-intl locale routing)
```

### 2. Sign-in page renders

```
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/pl/sign-in
→ 200
```

### 3. Sign-in page preserves `returnUrl` (validates Phase 6 Correction B's client-side half)

```
curl -s "http://127.0.0.1:3001/pl/sign-in?returnUrl=%2Fqr%2Ftest-token-123" | grep -o 'name="returnUrl"[^>]*'
→ name="returnUrl" value="/qr/test-token-123"
```

**Real, live confirmation** that a `returnUrl` query param survives into the sign-in form's hidden field exactly as `signInAction` expects — the mechanism Phase 6's correction relies on for the logged-out QR round trip. This is the strongest evidence this agent can produce for scenario 15 without a real login (which needs a real account).

### 4. QR error page renders correctly for a nonexistent token (validates the resolver's error path against the real DB)

```
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/pl/qr/nonexistent-token-test
→ 200

curl -s http://127.0.0.1:3001/pl/qr/nonexistent-token-test | grep -o "Kod QR nie został znaleziony"
→ Kod QR nie został znaleziony
```

Confirms `resolvePublicQrToken`'s `QR_NOT_FOUND` path executes correctly end-to-end against the real, live `qr_codes` table (service-role client, real query, real "not found" result) and the error card renders with the correct Polish messaging — unchanged by Phase 6's correction, and this exercises the exact same code that Correction A's denial path also uses (`{ok:false, error:"TARGET_NOT_FOUND", token}` reuses this same rendering).

### 5. Dashboard route auth gate

```
curl -s -D - -o /dev/null http://127.0.0.1:3001/pl/dashboard/warehouse/locations
→ HTTP/1.1 307 Temporary Redirect
→ location: /logowanie
```

Confirms the dashboard layout's auth gate is live and redirects an unauthenticated request. **Observation, not a bug:** the redirect's `Location` header did not include a `returnUrl` query param in this curl-based check, even for a request with a query string (`?selected=abc123`), whereas `dashboard/layout.tsx`'s own code builds one from the `x-pathname` header. This may be a dev-server/curl artifact (no real browser navigation, no cookies) rather than a genuine bug — curl does not replicate a browser's actual request/header behavior, and this exact mechanism is `dashboard/layout.tsx`'s own pre-existing code, unmodified by Zone 1 Phase 6/7. **Flagged for the human tester to re-check with a real browser** during scenario 4-11 execution (does the dashboard's own generic returnUrl actually populate for an ordinary deep link, separate from the QR flow's own dedicated mechanism which does not depend on this path at all). Not a Phase 8 blocker on its own since Phase 6's QR flow explicitly bypasses this exact mechanism (see Correction B's design in the Phase 6 review bundle) — but worth confirming for the general (non-QR) deep-link case.

## Not attempted (require an authenticated session and/or prepared demo data, neither of which exists — see `uat-environment.md`)

- Any dashboard page beyond the auth-gate redirect.
- SidebarBranchSwitcher, Locations, Balances, Movements, Products, RepairOrder, Matcher.
- Any authenticated action, branch switch, or permission-context change.
