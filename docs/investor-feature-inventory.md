# Ambra — Investor Feature Inventory & Pitch Readiness

_Last verified against the codebase: 2026-07-27. This document is a code-audited, honest snapshot — not aspirational marketing copy. Every "Done" claim below was traced to a real file in the repository. Where the existing internal documentation (CLAUDE.md, module docs) overstates what's built, this document corrects it._

---

## 1. Product Overview

**Ambra** is a multi-tenant B2B SaaS platform for warehouse, logistics, and inventory operations, built as a monorepo of three Next.js applications that share a common Supabase backend and permission model:

1. **`apps/web` — the main ERP application** (deployed at `app.ambra-system.com`). This is the core product: a multi-tenant warehouse management system where an organization (a company) manages one or more branches (physical locations/warehouses), invites team members with role-based permissions, and runs day-to-day warehouse operations — product/inventory management, stock movements, audits, help desk ticketing, task/project planning, and a specialized logistics document-processing tool.

2. **`apps/vmi-client` — the VMI (Vendor-Managed Inventory) client portal** (deployed at `vmi.ambra-system.com`). This is a separate, B2B-facing app aimed at Ambra's warehouse customers' own clients — companies that buy from Ambra's users and want visibility into stock levels, replenishment proposals, and order history without needing full ERP access. It is currently a **UI prototype with no live backend** (see Section 3).

3. **`apps/public-web` — the marketing & B2B marketplace site** (deployed at `www.ambra-system.com`). This is the public-facing website: product marketing pages, pricing, a working B2B marketplace where suppliers list products/catalogs/flyers and buyers can submit quotation requests, and the entry point for sign-up/onboarding into the main app.

### Who it's for

- **Primary customer**: SMB-to-mid-market companies that operate a physical warehouse or multiple branches and need inventory control, stock movement tracking, and team/role management — e.g., auto parts distributors, wholesalers, light manufacturing with logistics needs (the seed/demo content and "SVWMS WDD-matcher" tool are specifically tailored to automotive parts distribution logistics documents).
- **Secondary customer (via VMI)**: the buying-side companies of Ambra's warehouse customers, who want a lightweight portal to monitor stock and place replenishment orders without full system access — this is the concept of the VMI module, though it's not yet backed by real data.
- **Tertiary audience**: B2B suppliers who want to list products/catalogs on Ambra's public marketplace to reach buyers.

### Core value proposition, module by module

- **Multi-tenant organization & branch model** with a genuinely sophisticated **compiled permission system** (roles are pre-computed into an `user_effective_permissions` table with wildcard expansion, rather than evaluated at request time) — this is real, production-grade infrastructure, not a toy RBAC.
- **Warehouse core**: product/variant catalog, per-location stock, SAP-style numbered stock movement types (goods receipt, issue, transfer, adjustment, reservation, e-commerce sync), hierarchical location trees with QR codes, and stock audits with a guided count workflow.
- **Help Desk** and **Planning** (tasks, kanban boards, calendar) modules for internal team collaboration.
- **SVWMS WDD-Matcher**: a specialized document-parsing tool (largest single feature in the codebase) that ingests logistics delivery documents and matches/imports them into stock movements — this is a genuine competitive/technical asset, not boilerplate.
- **QR code system** for physical location/product labeling and mobile scan-to-navigate workflows.
- **B2B marketplace** (on the public site): suppliers list products/catalogs/promotional flyers; buyers browse and submit quotation requests — a real, working lead-generation surface.
- **VMI portal concept**: a vendor-managed-inventory client portal — the idea (and a well-designed UI for it) exists, but it is not yet connected to real data (see honesty notes below).

### What's explicitly NOT yet part of the product (see full inventory below for details)

Payment processing/billing collection, a working chat/Teams module, most warehouse sales/purchasing workflows (order-to-cash, procure-to-pay), and any AI/LLM-powered features.

---

## 2. Feature Inventory by Module

Legend: ✅ Done · 🟡 Partial · ❌ Not done / stub only

### 2.1 Multi-tenancy, Auth & Permissions (`apps/web`)

- ✅ **Organizations & branches** — real DB-backed context loading and org/branch switching (`src/server/loaders/v2/load-dashboard-context.v2.ts`, `src/lib/stores/app-store.ts`).
- ✅ **Sign-up / sign-in / password reset** — full real forms and pages under `src/app/[locale]/(public)/(auth)/`, with dedicated tests.
- ✅ **Invitations** — end-to-end flow: invite creation, real email template, acceptance, role assignment (`src/app/actions/organization/invitations.ts`, `src/components/emails/invitation.tsx`, invitations management UI).
- ✅ **Compiled RBAC permission system** — permissions are pre-computed per user into `user_effective_permissions` (DB triggers handle wildcard expansion like `warehouse.*`), read via `permission-v2.service.ts` and a client `usePermissions()` hook. This is a real architectural asset worth highlighting to technical investors.
- ✅ **Role & position management UI** — CRUD for roles/positions with branch-scoped and org-scoped assignment.
- ✅ **Onboarding wizard** — a real 3-step flow (org name/slug → branch → plan selection → org creation), though plan selection has no payment step (see Section 3).

### 2.2 Warehouse Module (`apps/web/.../dashboard/warehouse`)

- ✅ **Products & variants** — full catalog with size/color/form variants, per-location stock, real CRUD, large service layer (`inventory-products.service.ts`, ~2,900 lines).
- ✅ **Stock movements** — SAP-style numbered movement types, approval workflow, real UI and service (`inventory-movements.service.ts`).
- ✅ **Stock counting / inventory sessions** — guided count sessions with discrepancy tracking (`inventory-count-sessions.service.ts`).
- ✅ **Locations** — hierarchical 3-level location tree, real service (`warehouse-locations.service.ts`).
- ✅ **Audits** — real scheduled/interactive audit flow, backed by `warehouse-audit-enrichment.service.ts`.
- ✅ **Warehouse map** — real layout/shape rendering service.
- ✅ **Warehouse settings** (label settings, etc.) — real.
- 🟡 **Suppliers** — data model exists (item↔supplier linking service), but the management page itself is a placeholder shell with no UI.
- ❌ **Sales, Sales Orders, Purchases, Purchase Orders, Clients (B2B)** — all five pages render a bare placeholder component with zero service layer behind them. The detailed "B2B Katalog" (supplier admin panel, client invites, client-specific pricing) described in internal docs **does not exist in code**.
- ❌ **Deliveries** — placeholder; code comment states this is planned for "a later feature slice."
- ❌ **Labels (generator)** — placeholder page; only the separate QR system produces real labels today.
- ❌ **Alerts** — placeholder page.

### 2.3 Organization Management

- ✅ **Org profile, branches, positions** — real CRUD (`organization.service.ts`).
- ✅ **Users, roles, invitations UI** — real, with tests.
- 🟡 **Billing/subscription display** — reads and displays the org's current plan/entitlements/limits from the database, but this is **read-only**: no upgrade/downgrade flow, no payment-method management (see Section 3 — this is the single biggest monetization gap).

### 2.4 Other Product Modules

- ❌ **Teams module (as documented)** — internal docs describe a `/dashboard/teams/*` module with chat, kanban, and calendar. **This route does not exist.** Kanban boards and calendar functionality are real but live under the **Planning** module instead; a dedicated chat feature does not exist anywhere in the codebase.
- ✅ **Planning module** — tasks, kanban boards, and a calendar are all real, service-backed, with working UI.
- ✅ **Help Desk module** — tickets, ticket types, settings — full real implementation.
- 🟡 **Analytics & Reports** — activity feed and audit feed are real and DB-backed; there is no broader BI/reporting/charting beyond these two feeds.
- ✅ **SVWMS WDD-Matcher tool** — a substantial, real document-parsing pipeline (parser, matcher, upload/progress/results UI, and an adapter that imports parsed data directly into stock movements). The single most technically substantial feature in the repo.
- 🟡 **CRM module** — real pages exist (contacts, parties, settings) but the module's own documentation self-declares "implementation: in progress."
- ❌ **Workshop module** — a "coming soon" card grid (repairs, vehicles, claims, parts, tasks, handover), explicitly labeled as such in the UI, with no backend at all.
- ✅ **Admin panel core** — site settings, entitlements management, org member admin, branding, all real and service-backed.
- ❌ **Admin plan/pricing management** — both pages are literal "full implementation coming soon" placeholders.

### 2.5 Cross-Cutting Infrastructure

- ✅ **QR code system** — real generation/assignment service and flows.
- ✅ **File attachments** — real upload/storage service.
- ✅ **Audit logging** — real event logging and feed UI.
- ✅ **Entitlement / module-gating enforcement** — a genuine server-side guard layer that blocks access to modules/limits based on the org's plan. This is real and enforced, not decorative — a meaningful technical asset for a plan-tiered SaaS story.
- ❌ **Notification bell (dashboard header)** — renders a hardcoded array of example notifications with an explicit `TODO: Connect to real notifications system` comment in the code. It looks finished in a screenshot but is not wired to anything real.
- 🟡 **Notification preferences** — the opt-in/out preference toggles themselves are real, even though the notifications they'd control aren't yet delivered.
- 🟡 **Search** — no unified/global search; search-like filtering exists ad hoc inside individual modules (products, movements, tickets, etc.).
- ❌ **AI/LLM features** — none exist anywhere in the codebase today.
- ❌ **Payment processing** — no Stripe, PayPal, or any payment processor integration exists anywhere in the codebase.

### 2.6 VMI Client Portal (`apps/vmi-client`)

This module deserves its own section because its maturity profile is fundamentally different from the main app: **the frontend is well-built, but there is no live backend behind it at all.**

- 🟡 **UI/UX shell** — layout, navigation, i18n (Polish/English), theming, forms, and tables are genuinely well-built and idiomatic Next.js.
- ❌ **Authentication** — a hardcoded "demo session" cookie; there is no real login, no credential check, no user account model in use.
- ❌ **Dashboard, vendor listing/partner panel, inventory monitoring, orders, proposals, messages, stock-counts** — every single one of these screens reads from an in-memory fixture file (`src/lib/vmi-portal/fixtures.ts`); every "create/submit" action fabricates a fake ID and does not persist anything — a page refresh loses all state.
- 🟡 **Settings page** — theme and language switching are genuinely functional; "offline mode," "sync offline drafts," "clear cache," and the notifications list are simulated/decorative.
- 🟡 **Backend scaffolding (unused)** — real Supabase service classes, Zod validation schemas, and RBAC-aware server actions already exist for this module's intended data model (`app/actions/vmi/`, `*.service.ts` files) — but none of them are wired to any screen, and their target database tables have never been migrated (the schema exists only as an unapplied draft SQL file). Per the exploration audit, connecting them is realistically a **"wire it up" job, not a rebuild**, since the hard design work is already done.

### 2.7 Public Marketing Site & B2B Marketplace (`apps/public-web`)

- ✅ **Marketing pages** — home, features, pricing, tools — real content, no placeholder/lorem-ipsum text found anywhere.
- ✅ **B2B marketplace** — vendors, products, and promotional flyers are real, DB-backed listings with detail pages; a **working, Zod-validated quotation-request (RFQ) API** lets buyers submit real requests.
- ✅ **SEO** — a dynamically generated sitemap that includes locale alternates and live marketplace entities pulled from the database, a correctly configured `robots.txt`, and Open Graph images.
- ✅ **Transactional email** — signup confirmation and password recovery emails are sent via a real Supabase Edge Function that calls the Resend API directly, with bilingual HTML templates. This is a genuinely working integration, not just unsent templates.
- ❌ **Contact/lead-capture form** — the "Features" page contact form only fakes a network call (`setTimeout` + a success toast); nothing is actually sent anywhere. This is the one lead-capture surface on the site and it currently does nothing.
- 🟡 **Public pricing page** — well-designed, includes an interactive custom-price calculator, but all prices/tiers are hardcoded JS literals (not read from the database), and the "Choose plan" buttons have no click handler — there is no checkout path from the marketing site.

---

## 3. Investor-Critical Gaps

These matter disproportionately to how a technical or diligence-minded investor will read the product, independent of raw feature count:

1. **No payment processor integration anywhere.** The plan/entitlement _enforcement_ engine is real and server-side enforced — a genuine technical asset — but there is currently no way for a customer to actually pay. Plans are assigned manually. This is the single largest gap between "looks like a SaaS business" and "is a SaaS business" today.
2. **The VMI module — a named, pitched product line — is a non-functional prototype.** If VMI is part of the pitch narrative, be prepared to clearly frame it as "designed and UI-complete, backend integration in progress" rather than demo it as if it works, since it has no real auth or persistence.
3. **No CI/CD pipeline and no error monitoring.** No `.github/workflows`, no Sentry or equivalent. This doesn't block a demo, but a technical due-diligence conversation will likely surface it.
4. **No one-click demo data.** Only narrow permission/plan seed migrations exist — there's no broad seeded dataset for warehouse or marketplace content. A live investor demo currently requires manually onboarding an org and manually populating listings beforehand.
5. **Internal documentation overstates scope in three specific places** (Teams/chat, warehouse B2B Katalog & sales/purchasing, and the notification system) — worth knowing before an investor's own technical advisor reads the docs or codebase independently.

On the positive side: the **permission/entitlement architecture, the warehouse core, and the WDD-matcher tool are all genuinely substantial, well-tested, working technology** — these are the strongest things to lead with.

---

## 4. Pre-Pitch Punch List

### Quick wins (small effort, meaningfully closes a gap a visitor or technical investor could stumble into)

1. **Make the marketing site's contact form actually work** (send an email or write a DB row). Currently 100% fake — trivial to fix, embarrassing if a prospect or investor tests it live during the pitch.
2. **Wire the dashboard notification bell to real data.** A real audit/activity feed service already exists — point the bell at recent audit events instead of the hardcoded array. Visible on every single dashboard page, so it's a high-visibility fix for relatively little work.
3. **Prepare a seeded demo dataset** (a script or SQL fixture) so a live demo org comes pre-populated with realistic products, stock, movements, and a couple of marketplace listings — removes the risk of demoing an empty product live.
4. **Do a "coming soon" honesty pass on stub warehouse pages** (sales, purchases, clients, suppliers, deliveries, labels, alerts). Either relabel them clearly as "coming soon" (rather than a bare empty page that looks broken) or hide them from the demo org's navigation entirely so a curious click during the pitch doesn't land on an empty placeholder.

### Bigger asks (worth doing only if there's real runway before the pitch)

5. **Real payment integration** (e.g., Stripe Checkout + webhooks feeding the existing entitlements table) — this is the highest-value item for actually proving monetization capability, but it's a multi-day engineering task, not a quick win.
6. **Wire the VMI portal to real data.** Per the audit, the service/validation layer already exists correctly — this is "apply the draft migration, add real auth, replace the fixture repository with the existing services" rather than a rebuild. Still a substantial task, but more tractable than it might look given how much is already built underneath.
7. **Basic CI (test + type-check on PR) and error monitoring (Sentry).** Not visible in a live demo, but likely to come up in technical diligence.

### Explicitly deprioritized before this pitch

- Full B2B Katalog / sales-purchasing workflow buildout — large scope, not a quick win.
- Workshop module — currently just a placeholder concept; not worth building out pre-pitch.
- Global search, AI/LLM features — nice differentiators for a later roadmap slide, not something to attempt under pitch deadline pressure.

---

## 5. Honesty Notes for Live Demos

Do not present the following as working/real during an investor demo, even if they render convincingly in the UI:

- **The VMI client portal** — no real login, no persistence; anything "submitted" disappears on refresh.
- **The dashboard notification bell** — decorative, hardcoded content.
- **Warehouse sales/purchases/clients/suppliers/deliveries/labels/alerts pages** — empty placeholder shells.
- **VMI settings page's "offline mode," "sync drafts," and "encryption key" display** — simulated, not functional.
- **Public pricing page's "Choose plan" buttons** — currently non-functional; there is no checkout flow behind them.
