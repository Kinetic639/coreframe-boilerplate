# <Module Name> (`<module_slug>`)

## Purpose

- **What this module does:**
- **Who uses it (roles):**
- **Primary workflows:**
  -
  -

## Status

- **Implementation:** ⬜ planned / ⬜ in progress / ⬜ done
- **Last updated:** YYYY-MM-DD
- **Owner:** <name/handle>

---

## Entitlements

- **Plan-gated:** ✅ / ❌
- **Module constant:** `MODULE_<UPPER_SNAKE>`
- **Entitlements source of truth:** `organization_entitlements.enabled_modules` (compiled)
- **Where enforced:**
  - Page guard: `entitlements.requireModuleOrRedirect(MODULE_<...>)`
  - Server actions: `entitlements.requireModuleAccess(MODULE_<...>)`

### Verification checklist

- [ ] Module slug present in entitled org’s `organization_entitlements.enabled_modules`
- [ ] Module slug absent for free org
- [ ] Sidebar item hidden when not entitled
- [ ] Direct route access denied (server guard) when not entitled

---

## Permissions (Permission Service V2)

### Permission constants used

> No raw strings. Must match DB slugs exactly.

| Action | Permission constant | DB slug |
| -----: | ------------------- | ------- |
|   Read | `PERM_...`          | `...`   |
| Create | `PERM_...`          | `...`   |
| Update | `PERM_...`          | `...`   |
| Delete | `PERM_...`          | `...`   |

### Where enforced

- Server Components: permission gates used for UX only (optional)
- Server Actions: **must enforce** via `requirePermission(...)` / `enforcePermission(...)` (per guide)
- RLS: **final boundary** (must exist)

### Verification checklist

- [ ] Permission constants exist in `src/lib/constants/permissions.ts`
- [ ] DB has matching slugs in `permissions` table
- [ ] RLS policies enforce at least read/write boundaries
- [ ] Server actions deny when permission missing
- [ ] Sidebar hides items when permission missing

---

## Sidebar V2 Registry

### Navigation entries

> Sidebar V2 registry is the only navigation authority.

| Location    | Item id | Label key | Href  | requiresModules | requiredPermissions |
| ----------- | ------- | --------- | ----- | --------------- | ------------------- |
| MAIN/FOOTER | `...`   | `...`     | `...` | `[...]`         | `[...]`             |

### Files changed

- Registry file(s):
  - `...`
- SSR sidebar tests updated:
  - `...`

### Verification checklist

- [ ] Item appears for entitled + permitted user
- [ ] Item hidden for not entitled user
- [ ] Item hidden for missing permission user
- [ ] SSR sidebar tests cover this module visibility

---

## Data Model

### Tables

- `...`
- `...`

### Columns of note

- `organization_id` / `branch_id` scoping:
- soft delete: `deleted_at` ✅/❌
- audit columns: `created_at`, `updated_at`, `created_by`, etc.

### Indexes

- `...`

---

## RLS Policies

### Policies summary

| Table | Operation | Policy name | Conditions                   |
| ----- | --------- | ----------- | ---------------------------- |
| ...   | SELECT    | ...         | ...                          |
| ...   | INSERT    | ...         | ...                          |
| ...   | UPDATE    | ...         | USING + WITH CHECK mirror ✅ |
| ...   | DELETE    | ...         | ...                          |

### Notes

- Escalation logic (update→delete permission) used: ✅/❌
- Any special cases:

---

## API Surface

### Server actions

| Action | File | Input schema | Permission(s) | Entitlement enforced |
| ------ | ---- | ------------ | ------------- | -------------------- |
| ...    | ...  | ...          | ...           | ✅/❌                |

### Services

- `...service.ts` responsibilities:
  -
  -

### React Query hooks

- `use<...>()`
- `use<...>Mutation()`

---

## UI

### Routes

- `/dashboard/...`
- `/dashboard/...`

### Components

- Server:
  -
- Client:
  -

### Mobile responsiveness notes

- Verified at 390px: ✅/❌
- Known constraints:
  -

---

## Tests

### Coverage map

- Unit tests:
  -
- Integration / RLS tests:
  -
- Sidebar SSR tests:
  -

### Manual test checklist

- [ ] Create flow
- [ ] Update flow
- [ ] Permission denied behavior
- [ ] Entitlement denied behavior
- [ ] Mobile layout sanity

---

## Operational Notes

### Telemetry / logging

- Action error logging:
- Audit log integration (if any):

### Performance considerations

- N+1 risks:
- Cached queries:
- Index reliance:

---

## Changelog

- YYYY-MM-DD — <summary of what changed>
