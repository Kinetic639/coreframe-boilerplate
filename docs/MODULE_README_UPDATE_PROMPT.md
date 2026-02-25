---

# 🔒 MANDATORY MODULE PASSPORT SYNC (MODULE.md)

You are modifying or creating a module.

This system requires that every module has a living documentation file:

    src/modules/<module>/MODULE.md

This file is the module’s passport and MUST always reflect the current implementation state.

## NON-NEGOTIABLE RULES

1. If this prompt creates a new module:
   - You MUST create `MODULE.md` using the approved template.
   - You MUST populate it with real values (no placeholders).

2. If this prompt modifies an existing module:
   - You MUST update the existing `MODULE.md`.
   - You MUST synchronize it with ALL changes introduced in this task.

3. The file must include:
   - Module slug constant (MODULE_*)
   - Permission constants (PERM_*) + matching DB slugs
   - Entitlements gating decision (plan-gated or not)
   - Page-level guard enforcement
   - Server action enforcement
   - Sidebar registry entries added/modified (id, href, requiresModules, requiredPermissions)
   - Tables added/modified
   - RLS policies added/modified
   - Tests added/modified (file paths)
   - Any new limits or constraints

4. No raw strings allowed in TS references.
5. No placeholders.
6. No outdated entries.
7. If something was removed in this task → remove it from MODULE.md.

---

## REQUIRED OUTPUT SECTION

At the end of your response, add:

### MODULE.md Synchronization Report

- File: `src/modules/<module>/MODULE.md`
- Status: Created / Updated
- Sections modified:
  - ...
  - ...
- Confirm:
  - [ ] Entitlements section accurate
  - [ ] Permissions section accurate
  - [ ] Sidebar section accurate
  - [ ] RLS summary accurate
  - [ ] Tests section accurate
  - [ ] No placeholders remain
  - [ ] No raw strings used in TS references

If MODULE.md was not updated, the task is considered incomplete.

---

Fail-closed principle applies.
No module change is complete without MODULE.md synchronization.
