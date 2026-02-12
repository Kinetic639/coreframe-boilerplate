You are working in an existing Next.js + Supabase SaaS codebase.

You MUST follow the attached "Coreframe Module Development Guide" exactly.
Do NOT introduce new patterns, abstractions, or shortcuts.
Do NOT simplify permissions or RLS.

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

Task:
Create a new module with the following requirements:

- Module name: <name>
- Purpose: <what it does>
- Data classification: <A / B / C>
- Required permissions: <list>
- Org-scoped or branch-scoped: <explicit>
- Key features:
  - <feature 1>
  - <feature 2>
  - <feature 3>

Output:

- SQL migration
- RLS policies
- Permissions + role assignments
- Service layer
- Zod schemas
- Server actions
- React Query hooks
- Page + client components
- Tests (unit + RLS integration stubs)

Follow the guide strictly. If something is unclear, ask before inventing.
