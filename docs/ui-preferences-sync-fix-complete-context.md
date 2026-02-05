# UI Preferences Sync — Enterprise-Grade Plan (Next.js 16 / App Router / Supabase / Zustand)

**Goal:** Persist UI preferences (sidebar collapsed, theme, color theme, etc.) with **instant local UX** and **silent cross-device sync** — **no route refresh**, **no RSC churn**, **no dashboard-wide re-render cascade**.

This plan replaces Server Actions + React Query cache writes for UI prefs with a **Route Handler + deterministic sync pipeline** (local authoritative, server eventual).

---

## 0) Non-Negotiables (Design Rules)

1. **UI prefs must never go through Server Actions** if they can affect the current route’s RSC refresh.
2. **Local state is authoritative** for UX. Server sync is best-effort.
3. **Never “pretend success”**:
   - Don’t return 204 on DB failure.
   - Don’t update `_lastSynced*` unless server confirms.
4. **Conflict resolution must not rely on client clocks**.
   - Use **server revision** (monotonic) and/or server timestamp.
5. **Sync must not touch global query caches** that the dashboard shell/loader subscribes to.
6. **Retries must exist** (online event + backoff). Beacon is only a last-chance helper.

---

## 1) Data Model (DB)

### 1.1 Table / columns (recommended)

In `user_preferences` (or a dedicated `user_ui_preferences`):

- `dashboard_settings jsonb NOT NULL DEFAULT '{}'::jsonb`
- `dashboard_settings_updated_at timestamptz NOT NULL DEFAULT now()`
- `dashboard_settings_revision bigint NOT NULL DEFAULT 0`

**Why revision:** Timestamps can collide; revision is deterministic ordering and makes debugging easier.

### 1.2 RLS policies (must)

- Only the authenticated user can `SELECT/UPDATE` their row.
- Ensure updates cannot target other users’ rows.

---

## 2) API Layer (Route Handler, not Server Actions)

### 2.1 Endpoints

- `GET  /api/ui-settings` — boot-time fetch
- `POST /api/ui-settings` — silent sync write (debounced + retries client-side)

### 2.2 Response semantics

- **POST success:** `200` + `{ serverUpdatedAt, revision }`
- **POST failure:** `4xx/5xx` + `{ error }`
- **GET success:** `200` + `{ data: { ui, serverUpdatedAt, revision } }` with **no-store headers**

### 2.3 Body parsing (fetch + beacon)

`sendBeacon()` may arrive as `text/plain` and cannot set headers. Handle both:

- If `content-type` includes `application/json` → `await request.json()`
- Else → `await request.text()` and `JSON.parse(...)`

### 2.4 Validation (Zod strict)

- `.strict()` — reject unknown keys
- limit arrays sizes
- enforce enums for theme/colorTheme when possible
- optional payload size guard (basic abuse prevention)

---

## 3) Client State (Zustand) — Authoritative UX + Sync Metadata

### 3.1 Store fields

Persisted:

- `sidebarCollapsed: boolean`
- `theme: "light" | "dark" | "system"`
- `colorTheme: string`
- (optional) `collapsedSections: string[]`

Sync metadata (persisted):

- `_lastLocalChangeAt: string | null` (ISO)
- `_lastSyncedRevision: number | null`
- `_lastSyncedAt: string | null` (serverUpdatedAt)

Not persisted (in-memory):

- `_hasHydrated: boolean`
- `_setHasHydrated(flag: boolean)`
- `_syncVersion: number` (transient counter for change detection)

### 3.2 Required behaviors

- Every UI setter **must**:
  - update UI value immediately
  - bump `_syncVersion`
  - set `_lastLocalChangeAt = new Date().toISOString()`

- After successful server sync:
  - set `_lastSyncedRevision = revision`
  - set `_lastSyncedAt = serverUpdatedAt`

### 3.3 Derived pending state (no persisted boolean)

Pending sync exists if:

- `_lastLocalChangeAt` is set AND
- (`_lastSyncedRevision` is null OR `_lastLocalChangeAt > _lastSyncedAt`)

(If you adopt revision strictly, you can instead track `_lastLocalChangeSeq` locally; but timestamp compare is fine for “is pending” as long as revision is canonical on the server.)

---

## 4) Sync Engine (Client) — One Component Mounted Once

### 4.1 Placement (must)

Mount once at dashboard root (e.g. `_providers.tsx` inside the dashboard layout), not per-page.

### 4.2 Responsibilities

1. **Wait for Zustand hydration** (`onRehydrateStorage` sets `_hasHydrated`)
2. **Boot reconcile** (GET server prefs, merge if server newer)
3. **Debounced sync** on `_syncVersion` changes
4. **In-flight ordering guard** (token or AbortController)
5. **Retry loop**
   - retry on `online`
   - periodic backoff while pending (e.g. 5s → 30s)
6. **Last-chance beacon**
   - on `visibilitychange` hidden
   - optionally `pagehide` (better than beforeunload in many browsers)

### 4.3 Boot-time reconcile rules (canonical ordering)

Prefer **revision**:

- If server revision > local `_lastSyncedRevision` → hydrate local from server
- Else if local has pending → POST local
- Else do nothing

If revision absent, fallback to serverUpdatedAt timestamps.

---

## 5) Dashboard Initial Loader (critical to stop cascade)

### 5.1 Rule

The dashboard wrapper **must not** subscribe to a query that changes during UI-pref sync.

### 5.2 Implementation

Gate on Zustand hydration:

- In `ui-store` persist config, set `_hasHydrated=true` in `onRehydrateStorage`.
- In `DashboardInitialLoader`, render children only when `_hasHydrated` is true.
- Do NOT wrap all dashboard children in a component that subscribes to `useDashboardSettingsQuery()`.

---

## 6) React Query Policy (for prefs specifically)

- Do **not** use React Query for UI pref sync.
- Do **not** `setQueryData` for anything the dashboard shell depends on.
- React Query remains for real server state (lists, entities, etc.), not for preferences telemetry.

---

## 7) Concrete File Plan

### 7.1 Create: `src/app/api/ui-settings/route.ts`

- `export const dynamic = "force-dynamic";`
- `GET`: auth → fetch settings → return `no-store` headers
- `POST`: auth → parse json/text → zod validate strict → write DB (increment revision, set now()) → return `{ serverUpdatedAt, revision }`
- On error: return 500/401/etc. (no fake success)

### 7.2 Create: `src/lib/api/ui-settings.ts`

Functions:

- `fetchUiSettings(): Promise<{ ui; serverUpdatedAt; revision } | null>`
- `postUiSettings(payload): Promise<{ serverUpdatedAt; revision } | null>`
- `sendBeaconUiSettings(payload): boolean` (best-effort)

### 7.3 Modify: `src/lib/stores/v2/ui-store.ts`

Add:

- `_lastLocalChangeAt`
- `_lastSyncedAt`
- `_lastSyncedRevision`
- `_hasHydrated` (not persisted)
- `_setHasHydrated`
- Ensure setters bump `_syncVersion` + `_lastLocalChangeAt`

Persist `partialize` should include only:

- UI values
- `_lastLocalChangeAt`
- `_lastSyncedAt`
- `_lastSyncedRevision`

### 7.4 Modify: `src/app/[locale]/dashboard/_components/ui-settings-sync.tsx`

Rewrite as a pure sync engine:

- waits for `_hasHydrated`
- boot reconcile with GET
- debounced POST on `_syncVersion`
- request token guard
- retry loop + online handler
- beacon on `visibilitychange` + `pagehide`

### 7.5 Modify: `src/app/[locale]/dashboard/_components/dashboard-initial-loader.tsx`

- Remove React Query prefs subscription
- Gate on `_hasHydrated` only (deterministic)

### 7.6 Deprecate after 1 week stable

- Server Action `syncUiSettingsAction`
- React Query hooks for syncing prefs

---

## 8) Server Write Strategy (must be monotonic)

When POST receives `ui` payload:

1. Read current row (or update directly).
2. Update `dashboard_settings` to merged result.
3. Set `dashboard_settings_updated_at = now()`
4. Increment `dashboard_settings_revision = dashboard_settings_revision + 1`
5. Return new `{ revision, serverUpdatedAt }`

**Merge semantics**

- Either full replace (simpler)
- Or patch merge (jsonb merge) if you send partial updates

Given payload is tiny, **full replace is fine** for enterprise here.

---

## 9) Sync Semantics (client)

### 9.1 Debounce

- `500ms` default
- optional: adapt to user activity (250–1000ms)

### 9.2 Ordering guard

- Maintain `latestTokenRef`
- Each sync increments token; apply response only if token matches

### 9.3 Retry

- If POST fails:
  - do not change `_lastSyncedAt/_lastSyncedRevision`
  - mark pending derived from timestamps
- On `online` event:
  - if pending, attempt sync immediately
- Backoff:
  - while pending and online: retry after 5s, then 30s, then 2m

### 9.4 Beacon (last chance)

On `document.visibilityState === "hidden"` or `pagehide`:

- queue a beacon with the latest settings payload
- never assume it succeeded

---

## 10) Testing Checklist (must pass)

### 10.1 Sidebar toggle (critical)

- Toggle repeatedly fast
- No page refresh, no UI freeze
- Only one POST after debounce

### 10.2 Theme & color theme

- Instant UI response
- POST after debounce
- No flicker from loader or route refresh

### 10.3 Cross-device

- Device A changes sidebar
- Device B loads dashboard → GET pulls and hydrates if server revision newer

### 10.4 Offline

- Toggle while offline
- No UI errors
- Pending state persists (via `_lastLocalChangeAt`)
- When back online → auto-sync

### 10.5 Close tab quickly

- Toggle then close before debounce
- Beacon queued (maybe)
- On next open: pending detection triggers POST if needed

### 10.6 Abuse / schema

- Send extra keys → rejected by `.strict()`
- Very large payload → rejected (optional size guard)

---

## 11) “Enterprise Polish” Optional Add-ons

1. **Rate limiting** per user (e.g. 10 req / 10s)
2. **Realtime** subscription to `user_preferences` changes
   - apply only if server revision > local synced revision
3. **Outbox persistence** (store last payload for exact resend)
4. **Observability**
   - server logs with user id + revision
   - client debug flag for sync traces

---

## 12) Final Acceptance Criteria

- ✅ Sidebar/theme interactions never block or freeze
- ✅ No RSC route refresh triggered by preference sync
- ✅ No dashboard-wide re-render cascade from sync
- ✅ Server state converges across devices
- ✅ Offline changes eventually sync
- ✅ No silent data loss (server must confirm before updating synced markers)

---

## Implementation Order (recommended)

1. Add DB revision + updated_at (if missing)
2. Implement `/api/ui-settings` route (GET+POST) with strict validation + beacon parsing
3. Update Zustand store with hydration flag + sync metadata
4. Rewrite `UiSettingsSync` to new engine (no React Query)
5. Fix `DashboardInitialLoader` to gate on Zustand hydration
6. Remove old Server Action sync path and query cache writes
7. Run test checklist + ship behind feature flag if desired
8. Remove deprecated code after 1 week stable

---
