# ENTERPRISE AUDIT — VERIFICATION PASS

> Targeted factual verification of 8 high-impact claims from the original audit.
> Source of truth: actual source code + Supabase Target MCP direct DB inspection.
> Date: 2026-03-18
> Branch: event-system

---

## Summary Table

| #   | Claim                                            | Verdict                    | Confidence | Key Correction                                              |
| --- | ------------------------------------------------ | -------------------------- | ---------- | ----------------------------------------------------------- |
| 1   | Warehouse module has zero event emissions        | **TRUE**                   | HIGH       | File count wrong: 34, not 52                                |
| 2   | Auth lifecycle events never emitted              | **FALSE**                  | CERTAIN    | All 5 auth events ARE wired in `actions.ts`                 |
| 3   | `platform_events` not truly append-only          | **TRUE**                   | CERTAIN    | Zero triggers on table confirmed via MCP                    |
| 4   | Missing `branch_id` index                        | **TRUE**                   | CERTAIN    | Confirmed absent via MCP                                    |
| 5   | PII in metadata with no erasure path             | **TRUE**                   | HIGH       | No erasure endpoint or function found anywhere              |
| 6   | `platform_events` absent from generated TS types | **TRUE** (corrected count) | CERTAIN    | 7 functional `as any` casts, not 6 as stated                |
| 7   | Event registry count inconsistency (21 vs 22)    | **TRUE**                   | CERTAIN    | Registry has 22 keys; audit said 21 (undercounted)          |
| 8   | `org.created` double-emission risk               | **FALSE**                  | CERTAIN    | `profile.ts` emits `org.updated` only — never `org.created` |

---

## Detailed Verification

---

### Claim 1 — Warehouse module has zero event emissions

**Claim text (from audit):** "Warehouse module: 52 action files, zero emissions"

#### Evidence

Command run:

```
grep -r "eventService|emitEvent|appendEvent|emit\(" src/app/actions/warehouse/
→ No files found
```

Actual warehouse action file listing (verified via `ls`):

```
approve-movement.ts       get-movement-types.ts
approve-transfer.ts       get-movements.ts
cancel-movement.ts        get-product-locations.ts
cancel-transfer.ts        get-product-summary.ts
create-delivery.ts        get-products-with-stock.ts
create-movement.ts        get-transfer-request.ts
create-sales-order.ts     get-transfer-requests.ts
create-transfer-request.ts process-delivery-receipt.ts
delete-sales-order.ts     receive-transfer.ts
get-branches.ts           reorder-categories.ts
get-deliveries.ts         reorder-locations.ts
get-delivery-receipts.ts  save-draft-delivery.ts
get-delivery.ts           ship-transfer.ts
get-inventory.ts          stock-alerts-actions.ts
get-location-products.ts  submit-transfer.ts
get-locations.ts          update-order-status.ts
                          update-sales-order.ts
                          validate-delivery.ts
```

**Actual count: 34 files** (not 52 as stated in the audit).

#### Verdict: **TRUE — with file count correction**

Zero event emissions in warehouse confirmed. The claim is correct in substance. The stated file count of "52" is wrong — the actual count is **34 files**. No `eventService.emit` call exists in any warehouse action file.

The audit also mentioned the warehouse module has 160 files total — that refers to the full module directory (`src/modules/warehouse/`), not the action files specifically.

---

### Claim 2 — Auth lifecycle events registered but never emitted

**Claim text (from audit):** "Five action keys are registered (`auth.login`, `auth.login.failed`, etc.) but grep confirms no application code calls `eventService.emit` with these keys."

#### Evidence

File `src/app/[locale]/actions.ts` was not in the grep search path (`src/app/actions/`) used by the original audit. Full inspection of this file reveals all 5 auth events are wired:

**`signInAction` (on error):** emits `auth.login.failed`

```typescript
// src/app/[locale]/actions.ts:130-141
const failedLoginResult = await eventService.emit({
  actionKey: "auth.login.failed",
  actorType: "system",
  actorUserId: null,
  organizationId: null,
  entityType: "auth",
  entityId: email,
  metadata: { email, reason: "invalid_credentials" },
  eventTier: "baseline",
  ipAddress,
  userAgent,
});
```

**`signInAction` (on success):** emits `auth.login`

```typescript
// src/app/[locale]/actions.ts:164-176
const loginResult = await eventService.emit({
  actionKey: "auth.login",
  actorType: "user",
  actorUserId: signInData.user.id,
  organizationId: null,
  entityType: "user",
  entityId: signInData.user.id,
  metadata: { email: signInData.user.email },
  eventTier: "baseline",
  ipAddress: loginIp,
  userAgent: loginUa,
});
```

**`forgotPasswordAction`:** emits `auth.password.reset_requested`

```typescript
// src/app/[locale]/actions.ts:246-257
const resetRequestedResult = await eventService.emit({
  actionKey: "auth.password.reset_requested",
  actorType: "system",
  actorUserId: null,
  organizationId: null,
  entityType: "auth",
  entityId: email,
  metadata: { email },
  eventTier: "baseline",
  ...
});
```

**`resetPasswordAction`:** emits `auth.password.reset_completed`

```typescript
// src/app/[locale]/actions.ts:386-398
const resetCompletedResult = await eventService.emit({
  actionKey: "auth.password.reset_completed",
  actorType: "user",
  actorUserId: resetUser.id,
  organizationId: null,
  entityType: "user",
  entityId: resetUser.id,
  metadata: {},
  eventTier: "baseline",
  ...
});
```

**`signOutAction`:** emits `auth.session.revoked`

```typescript
// src/app/[locale]/actions.ts:442-454
const sessionRevokedResult = await eventService.emit({
  actionKey: "auth.session.revoked",
  actorType: "user",
  actorUserId: signingOutUser.id,
  organizationId: null,
  entityType: "user",
  entityId: signingOutUser.id,
  metadata: { reason: "voluntary_signout" },
  eventTier: "enhanced",
  ...
});
```

**File also captures IP address and user-agent via `getRequestContext()`** — a helper function that reads `x-forwarded-for` and `user-agent` headers and passes them to every auth event emit.

#### Why the original audit missed this

The original audit's grep was scoped to `src/app/actions/` (the server actions directory). The auth actions live in `src/app/[locale]/actions.ts` — a different directory used for Next.js route-level form actions. This directory was not searched.

#### Verdict: **FALSE — The original audit claim is incorrect**

All 5 registered auth action keys (`auth.login`, `auth.login.failed`, `auth.password.reset_requested`, `auth.password.reset_completed`, `auth.session.revoked`) are emitted from `src/app/[locale]/actions.ts`. The audit's claim that they are "never emitted" is a **factual error** caused by an incomplete file search scope.

Additionally, the implementation includes IP address and user-agent capture for all auth events — which is more complete than the audit implied.

---

### Claim 3 — `platform_events` is not truly append-only

**Claim text (from audit):** "No DB trigger preventing UPDATEs/DELETEs even for service_role. The architectural comment says append-only but this isn't enforced at the DB level."

#### Evidence

**Query 1:** `SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'platform_events'`
**Result:** 0 rows

**Query 2 (via pg_trigger):** `SELECT ... FROM pg_trigger JOIN pg_class ON pg_class.relname = 'platform_events'`
**Result:** 0 rows

**RLS policy inventory (via MCP):**
Only one policy exists on `platform_events`:

```
name:    platform_events_org_members_read
command: SELECT
qual:    (organization_id IS NOT NULL) AND is_org_member(organization_id)
```

No UPDATE or DELETE policy exists for any role. No BEFORE UPDATE/DELETE trigger exists. The service-role client bypasses all RLS policies, meaning application code with the service-role key can freely issue `UPDATE` or `DELETE` against `platform_events`.

**Additional RLS detail:** The MCP `pg_policy` query shows `roles: {}` (empty array), meaning the SELECT policy applies to ALL database roles. This is equivalent to what the original audit described as `{public}` — the `pg_policies` view renders an empty roles array as `{public}`. Both representations describe the same state: the policy is not restricted to `{authenticated}`.

#### Verdict: **TRUE — Confirmed**

Zero triggers on `platform_events`. Append-only is a convention enforced architecturally (service-role inserts via `event.service.ts` only) but not at the database level. A `BEFORE UPDATE OR DELETE` trigger that raises an exception does not exist.

---

### Claim 4 — Missing `branch_id` index on `platform_events`

**Claim text (from audit):** "No index on `platform_events.branch_id`. Branch-filtered queries do a sequential scan scoped by organization_id only."

#### Evidence

Full index listing for `platform_events` via MCP:

| Index Name             | Definition                                                            |
| ---------------------- | --------------------------------------------------------------------- |
| `platform_events_pkey` | UNIQUE btree(id)                                                      |
| `pe_org_created_idx`   | btree(organization_id, created_at DESC) WHERE org IS NOT NULL         |
| `pe_actor_user_idx`    | btree(actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL |
| `pe_action_key_idx`    | btree(action_key, created_at DESC)                                    |
| `pe_entity_idx`        | btree(entity_type, entity_id, created_at DESC)                        |
| `pe_request_id_idx`    | btree(request_id) WHERE request_id IS NOT NULL                        |

No index containing `branch_id` in its definition. Six total indexes — none covers branch filtering.

Query path when `branchId` is provided to `fetchPlatformEvents`:

```typescript
// _query.ts:124-126
if (branchId) {
  query = query.eq("branch_id", branchId);
}
```

This adds a filter on `branch_id` after the `organization_id` equality filter. Postgres will use `pe_org_created_idx` to scan all org events, then filter by `branch_id` in a secondary pass. For orgs with high event volume across multiple branches, this is O(org total events) per query.

#### Verdict: **TRUE — Confirmed**

No `branch_id` index exists. The claim is accurate.

---

### Claim 5 — PII in metadata with no erasure path

**Claim text (from audit):** "`platform_events.metadata` can contain PII. No data retention policy, no erasure endpoint, and no mechanism to redact metadata on a specific event exists."

#### Evidence

**PII confirmed in registry schema** (`src/server/audit/event-registry.ts`):

- `org.member.invited`: `metadataSchema` includes `invitee_email: z.string().email()`, `invitee_first_name`, `invitee_last_name`
- `org.invitation.cancelled`: includes `invitee_email: z.string().email().optional()`
- `org.invitation.resent`: includes `invitee_email: z.string().email().optional()`
- `auth.login.failed`: includes `email: z.string().email().optional()`
- `auth.login`: includes `email: z.string().email().optional()` (from `signInData.user.email`)
- `auth.password.reset_requested`: includes `email: z.string().email().optional()`

**Erasure path search** — grep for: `erase`, `anonymize`, `redact`, `purge`, `gdpr`, `UPDATE.*platform_events`, `DELETE.*platform_events` across all `src/` TypeScript files (excluding test files):
**Result: 0 matches** (no erasure-related code found).

**No GDPR/retention function in DB** — the MCP functions list contains no function named with `erase`, `anonymize`, `purge`, or `redact`.

**The `sensitiveFields` array in registry entries** strips PII at read/projection time, but the raw data remains stored in `platform_events.metadata` permanently. This is a read-time filter only, not an erasure mechanism.

#### Verdict: **TRUE — Confirmed**

PII (email addresses, names) is written into `platform_events.metadata` and no server-side, client-side, or database-level mechanism exists to erase or redact it.

---

### Claim 6 — `platform_events` absent from generated TypeScript types

**Claim text (from audit):** "`platform_events` not in `supabase/types/types.ts`. Six `as any` casts exist across the codebase."

#### Evidence

**Grep for `platform_events` in `supabase/types/types.ts`:**

```
Result: No files found (0 matches)
```

The types file is 7,470 lines. `platform_events` does not appear anywhere in it.

**Actual `as any` cast count** — verified by inspecting all three files:

`src/server/services/event.service.ts`:

```
line 116: const { data, error } = await (client as any)
```

→ **1 functional cast**

`src/app/actions/audit/_query.ts`:

```
line 118: let query = (supabase as any).from("platform_events")...
line 176: const { data, error } = await (supabase as any)
line 232: const { data, error } = await (client as any)
```

→ **3 functional casts** (lines 5 and 116 are comments, not casts)

`src/server/audit/reference-enrichment.ts`:

```
line 414: const { data, error } = await (client as any)
line 462: const { data, error } = await (client as any)
line 500: const { data, error } = await (client as any)
```

→ **3 functional casts**

**Total: 7 functional `as any` casts** (not 6 as stated in the audit).

#### Verdict: **TRUE — with count correction**

`platform_events` is confirmed absent from generated types. The `as any` cast count is **7**, not 6. The audit undercounted by one.

---

### Claim 7 — Event registry count inconsistency (audit said 21)

**Claim text (from audit):** "Event Registry contains 21 registered action keys."

#### Evidence

**Command:** `grep "actionKey:" src/server/audit/event-registry.ts | grep -v "//"` — piped to extract action key values.

**Full list of action keys extracted from registry (deduplicated, excluding function signature):**

```
1.  auth.login
2.  auth.login.failed
3.  auth.password.reset_requested
4.  auth.password.reset_completed
5.  auth.session.revoked
6.  org.created
7.  org.updated
8.  org.member.invited
9.  org.member.removed
10. org.invitation.accepted
11. org.invitation.cancelled
12. org.invitation.resent
13. org.invitation.declined
14. org.role.created
15. org.role.updated
16. org.role.deleted
17. org.member.role_assigned
18. org.member.role_removed
19. org.branch.created
20. org.branch.updated
21. org.branch.deleted
22. org.onboarding.completed
```

`grep -c "actionKey:"` returned **23** total matches. Of these, 22 are actual registry entry `actionKey:` fields, and 1 is the `getRegistryEntry(actionKey: string)` function parameter declaration. Therefore **22 registered action keys**.

The audit stated 21. The missed entry is `org.onboarding.completed` — it was listed in the audit's own registry table but the summary count was off by one.

#### Verdict: **TRUE — Audit undercounted**

The registry contains **22 action keys**. The audit claimed 21. The discrepancy is in the count stated in the summary ("21 registered action keys") versus the actual registry table the audit itself listed (which when counted contains 22). The registry count of 22 is confirmed.

---

### Claim 8 — `org.created` double-emission risk

**Claim text (from audit):** "Both `organization/profile.ts` and `onboarding/index.ts` emit `org.created`. If both code paths are reachable for a single org creation, the event is emitted twice."

#### Evidence

**Grep for `org.created` in `src/app/actions/`:**

Matches found only in:

- `src/app/actions/onboarding/index.ts` — line 116: `actionKey: "org.created"` ✅
- `src/app/actions/__tests__/event-wiring.test.ts` — test references only, not production emission

**Full inspection of `src/app/actions/organization/profile.ts`:**

Three emit calls found, all with `actionKey: "org.updated"`:

- `updateOrgProfileAction` (line 85): `actionKey: "org.updated"`
- `uploadOrgLogoAction` (line 139): `actionKey: "org.updated"`
- `removeOrgLogoAction` (line 193): `actionKey: "org.updated"`

`org.created` does not appear anywhere in `profile.ts`.

**Onboarding flow (`onboarding/index.ts`):**
`org.created` is emitted exactly once, inside a conditional block that guards on `onboardingUser?.id` being present. The two events (`org.created` and `org.onboarding.completed`) share a `requestId` generated from a single `crypto.randomUUID()` call — this is the correlation mechanism.

```typescript
// onboarding/index.ts:112-128
const requestId = crypto.randomUUID();
const orgCreatedResult = await eventService.emit({
  actionKey: "org.created",
  ...requestId,
});
```

There is no second code path in production code that emits `org.created`.

#### Verdict: **FALSE — The original audit claim is incorrect**

`profile.ts` does not emit `org.created` — it emits `org.updated`. The audit incorrectly attributed the profile actions' three emit calls (all for `org.updated`) to `org.created`. The double-emission risk described in the audit **does not exist**. `org.created` is emitted exactly once, in `onboarding/index.ts`, under a single conditional guard.

---

## Corrections to Original Audit

### Incorrect Claims (must be retracted or corrected)

**Claim 2 — Auth lifecycle events "never emitted"**

- **Status: INCORRECT**
- **Correction:** All 5 auth events (`auth.login`, `auth.login.failed`, `auth.password.reset_requested`, `auth.password.reset_completed`, `auth.session.revoked`) are fully wired in `src/app/[locale]/actions.ts`. The file includes IP and user-agent capture. The original audit searched only `src/app/actions/` and missed the route-level actions file at `src/app/[locale]/actions.ts`.
- **Impact on audit score:** Layer 1 score of 5/10 was partly based on this false gap. With auth events implemented, the emission coverage is meaningfully higher than stated.

**Claim 8 — `org.created` double-emission risk**

- **Status: INCORRECT**
- **Correction:** `organization/profile.ts` emits `org.updated` in three places (updateProfile, uploadLogo, removeLogo) — never `org.created`. The double-emission risk claimed in the audit does not exist.
- **Impact on audit score:** Listed as a Critical Gap — it should be removed.

### Claims with Factual Errors in Supporting Detail

**Claim 1 — Warehouse file count**

- **Status: CORRECT in substance, wrong in number**
- **Correction:** The audit stated "52 action files" in the warehouse action directory. The actual count is **34 files**. The "52" figure likely came from an earlier exploration of a broader scope that included non-action files.

**Claim 6 — `as any` cast count**

- **Status: CORRECT in substance, wrong in count**
- **Correction:** The audit stated 6 `as any` casts. The actual count is **7** functional casts across the three files.

**Claim 7 — Registry count**

- **Status: CORRECT in substance, wrong in summary count**
- **Correction:** The audit's body table listed 22 events correctly, but the summary said "21 registered action keys." The registry contains **22 action keys**.

### Partially Correct with Important Nuance

**Claim 3 — Append-only guarantee**

- **Nuance:** The original audit described the RLS policy as applying to `{public}` role. The `pg_policy` raw query shows `roles: {}` (empty), which PostgreSQL renders as `PUBLIC` in the `pg_policies` view. Both are the same state. The core claim (no immutability trigger) is correct.

---

## Final Verdict

### Is the audit accurate, partially accurate, or unreliable?

**Verdict: PARTIALLY ACCURATE — contains two significant factual errors that materially affect the audit's conclusions.**

### Accurate claims (6 of 8):

Claims 1, 3, 4, 5, 6, and 7 are all directionally correct and confirmed. The errors in these claims are in supporting detail (file counts, cast counts) rather than in the core finding.

### Incorrect claims (2 of 8):

**Claim 2** is a significant error. Stating that auth lifecycle events are "never emitted" when they are fully implemented in `src/app/[locale]/actions.ts` — including IP/user-agent capture — is a meaningful factual failure. This error originated from an incomplete grep scope: the audit searched `src/app/actions/` but the auth actions live one directory level up in `src/app/[locale]/actions.ts`, which uses the same `eventService.emit` API.

**Claim 8** is also incorrect. `profile.ts` emits `org.updated`, not `org.created`. This was listed as a Critical Gap in the original audit and should be removed entirely.

### Impact on the original audit's Layer 1 score and Critical Gaps:

The Layer 1 score of 5/10 cited auth events as a major gap. With auth events confirmed as implemented, the effective emission coverage is higher than stated. The warehouse gap remains the dominant issue, but the system also has complete auth observability (login, failed login, password reset, logout) with request context (IP/UA). A revised Layer 1 score would be in the **6-7/10 range** given the confirmed warehouse gap remains real.

**Critical Gap 2** ("Auth lifecycle events never emitted") from the original audit should be **removed** as it is factually false.

**Critical Gap 8** ("org.created double-emission risk") from the original audit should be **removed** as it is factually false.

The remaining 4 critical gaps (warehouse zero emissions, platform_events not append-only at DB level, missing branch_id index, PII with no erasure path) are all confirmed TRUE and stand.
