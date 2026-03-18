You are working in an existing Next.js + Supabase SaaS codebase.

There is an EXISTING legacy module in the repo that implements similar functionality.
You MAY look at it for DOMAIN UNDERSTANDING ONLY (naming, concepts, workflows).

Rules:

- The Coreframe Module Development Guide is the single source of truth.
- Security, RLS, and Permission System V2 correctness are non-negotiable.
- Do not invent patterns, shortcuts, or abstractions.
- Do not reuse or copy legacy code, even if it exists.
- If a legacy module exists, it is for DOMAIN UNDERSTANDING ONLY, not implementation.
- Build everything from scratch following the guide (backend + frontend).
- RLS is the hard security boundary; server actions must enforce permissions.
- Client-side permission checks are cosmetic only.

Goal:
Produce a production-ready, enterprise-safe module that matches the guide exactly,
even if that means discarding existing implementations.

IMPORTANT CONSTRAINTS (NON-NEGOTIABLE):

1. This is a CLEAN-ROOM REIMPLEMENTATION.
   - Do NOT copy code, patterns, queries, RLS policies, services, hooks, or components from the legacy module.
   - Do NOT mirror its structure or files.
   - Assume the legacy implementation is architecturally incorrect and insecure.

2. The legacy module is a _reference_, NOT a template.
   - You may extract:
     - business concepts
     - domain language
     - feature expectations
   - You may NOT reuse:
     - SQL
     - RLS policies
     - permission logic
     - pagination/search patterns
     - client data-fetching logic
     - error handling
     - UI composition

3. You MUST follow the attached "Coreframe Module Development Guide" EXACTLY.
   - This guide overrides ANY existing code in the repository.
   - If the legacy module conflicts with the guide, the guide always wins.

4. Build everything FROM SCRATCH:
   - New SQL migration
   - New RLS policies
   - New permissions (V2 compiler model)
   - New services
   - New server actions
   - New React Query hooks
   - New pages and components
   - New tests

5. Security posture:
   - Assume zero trust.
   - Assume legacy code has security flaws.
   - RLS is the hard boundary.
   - Server actions must validate permissions explicitly.

Task:
Rebuild a new module with the following requirements:

- Module name: <name>
- Domain reference module: <legacy module name/path>
- Purpose: <what it does>
- Data classification: <A / B / C>
- Org-scoped or branch-scoped: <explicit>
- Required permissions: <list>
- Required features:
  - <feature 1>
  - <feature 2>
  - <feature 3>

Output MUST include:

- SQL migration + RLS policies
- Permissions + role assignments (V2-safe)
- Service layer
- Zod schemas
- Server actions
- React Query hooks
- Page + client components
- Tests (unit + RLS integration stubs)

If you find a useful idea in the legacy module:

- Explain the idea briefly
- Then implement it correctly according to the guide

If anything is ambiguous:

- Ask BEFORE inventing or copying.

Do NOT optimize or refactor legacy code.
Do NOT attempt partial reuse.
This is a full replacement built to current standards.

Before writing code, briefly list:

- Which concepts you learned from the legacy module
- Which parts you intentionally discarded and why
  Then proceed with the implementation.

How to use it (recommended)
When talking to Claude, structure your message like this:
Paste the Summary block above
Paste one of the prompts (Greenfield or Clean-Room)
Paste the Module Development Guide
Describe the module features
This ordering dramatically reduces:
legacy-code contamination
security regressions
“helpful” AI shortcuts
architecture drift
If you want, next I can:
inline this summary directly into PROMPTS.md in the right place, or
compress it even further into a single paragraph “hard constraint notice” for system prompts
