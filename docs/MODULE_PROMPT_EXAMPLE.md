# ENTERPRISE MODULE CREATION PROTOCOL (STRICT MODE)

You are working inside a production-grade Next.js 16 + Supabase multi-tenant SaaS.

This system is governed by:

- Coreframe Module Development Guide (authoritative)
- Module Checklist Template (A–N compliance gates)
- Permission System V2 (compiled effective permissions)
- Entitlements Compiler (organization_entitlements.enabled_modules)
- Sidebar V2 Registry (ONLY navigation authority)

You MUST follow them exactly.

This is a regulated implementation environment.
No improvisation.
No architecture invention.
No shortcuts.

---

# NON-NEGOTIABLE RULES

1. Follow the Module Development Guide exactly.
2. Follow the Module Checklist Template (A–N) exactly.
3. Do NOT introduce new abstractions.
4. Do NOT simplify RLS.
5. Do NOT reuse legacy module code.
6. Do NOT invent permission patterns.
7. Do NOT use raw module or permission strings in TypeScript.
8. RLS is the hard security boundary.
9. Server actions must enforce permissions.
10. Sidebar V2 registry is the ONLY source of navigation truth.
11. Client-side permission checks are cosmetic only.
12. If anything is unclear → STOP and ask before coding.

---

# MODULE SPECIFICATION

Module name: <name>  
Purpose: <what it does>  
Data classification: <A / B / C>  
Scope: <org-scoped OR branch-scoped — explicit>  
Plan-gated: <yes/no — explicit>

Required permissions:

- <permission_1>
- <permission_2>
- <permission_3>

Key features:

- <feature 1>
- <feature 2>
- <feature 3>

---

# PHASE 1 — ARCHITECTURAL REASONING (MANDATORY BEFORE CODING)

Before writing any code, you MUST output:

1. Data classification reasoning (why A/B/C).
2. Scope model reasoning (org vs branch).
3. Permission matrix design:
   - read
   - create
   - update
   - delete
4. RLS enforcement model.
5. UPDATE escalation logic explanation.
6. Entitlements gating decision:
   - Plan-gated?
   - Addon?
7. Sidebar V2 registry placement decision.
8. Module constant + permission constant plan.
9. Fail-closed enforcement explanation.

Then STOP.

Do not implement yet.

Wait for confirmation.

---

# PHASE 2 — IMPLEMENTATION (STRICT)

When approved, implement ALL of the following:

## 1. Database Layer

- SQL migration
- Proper indexing
- RLS enabled
- SELECT policy
- INSERT policy
- UPDATE policy with:
  - USING (...)
  - WITH CHECK (...)
  - Mirroring logic
  - Escalation logic if needed
- DELETE policy OR soft-delete enforcement

No simplified RLS.
Must follow canonical pattern.

---

## 2. Permission System

- Add permission constants (no raw strings)
- Ensure permission slugs match DB exactly
- No legacy slug reuse
- No mismatch allowed

---

## 3. Module Constants

- Add module slug constant in modules.ts
- No raw module strings anywhere in TS

---

## 4. Entitlements Integration (MANDATORY IF PLAN-GATED)

If module is plan-gated:

- Ensure module slug integrates into entitlements compiler
- Page-level guard: requireModuleOrRedirect(MODULE_X)
- Server action guard: requireModuleAccess(MODULE_X)
- Fail closed if not entitled

Never rely on UI-only hiding.

---

## 5. Service Layer

- Typed service file
- Supabase server client only
- No direct client DB writes
- Explicit error handling
- No permission skipping

---

## 6. Zod Schemas

- Strict input validation
- No implicit casting
- No unsafe parsing

---

## 7. Server Actions

- "use server"
- Authentication check
- Permission enforcement
- Module enforcement (if gated)
- Call service layer only

No DB logic inside page files.

---

## 8. React Query Hooks

- Thin wrapper over server actions
- No business logic inside hooks
- No permission logic in client

---

## 9. Pages & Components

- Server Component page
- Entitlement guard at top
- Permission gating enforced server-side
- Mobile responsive
- No horizontal overflow at 390px
- Critical actions reachable on mobile

---

## 10. Sidebar V2 Registry

If module has UI routes:

- Add registry entry
- Use module constant
- Use permission constants
- Use requiresModules if plan-gated
- Do NOT add navigation inside ModuleConfig
- Sidebar is UX only — security lives in RLS + server guards

---

## 11. Tests

Provide:

- Unit test stubs
- RLS integration test stubs
- Permission enforcement test stubs
- Sidebar visibility logic test stubs

No empty placeholders.

---

# PHASE 3 — MANDATORY COMPLIANCE AUDIT

After implementation, output a structured audit against Module Checklist Template A–N:

For each section (A through N):

- ✅ Implemented
- Short explanation
- Any assumptions made

Then explicitly confirm:

- No raw module strings in TS
- No raw permission strings in TS
- Sidebar V2 is sole navigation authority
- Entitlements compiler enforced (if gated)
- USING and WITH CHECK mirrored
- Fail-closed enforcement applied
- SSR-first respected
- RLS-first respected

If any item is incomplete, state it clearly.

---

# OUTPUT FORMAT

Return:

1. Architectural reasoning
2. Implementation (clearly sectioned)
3. Compliance audit
4. Explicit confirmations
5. List of assumptions (if any)

---

# FAILURE CONDITIONS

Do NOT:

- Invent new abstractions
- Simplify RLS
- Skip entitlements enforcement
- Place navigation in ModuleConfig
- Use raw strings
- Implement partial compliance
- Modify unrelated architecture

If something conflicts with the guide → STOP and ask.

---

This is a regulated enterprise build task.

Precision over speed.
Compliance over convenience.
Security over aesthetics.
