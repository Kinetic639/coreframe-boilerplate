# Application Overview

This document defines the purpose, modules, and core flows for the redesigned dashboard application. The UI described here is entirely new; it does not reference or reuse visuals from the current product, though it maintains the same high-level layout anchors (sidebar, dashboard header, status bar).

## Purpose

The application is an operations intelligence console for product-centric organizations. It centralizes operational metrics, fulfillment workflows, inventory controls, and compliance auditing into a single dashboard so teams can monitor health, act on alerts, and automate routine tasks.

## Primary users

- **Operations managers**: Monitor throughput, resolve bottlenecks, and adjust staffing.
- **Supply chain leads**: Track inventory positions, supplier performance, and replenishment plans.
- **Customer teams**: Review engagement signals and intervene on support-heavy accounts.
- **Finance partners**: Validate revenue quality, margins, and cash flow projections.
- **Platform admins**: Configure environments, permissions, and integrations.

## Modules

- **Operations Overview**: Live metrics, SLA adherence, alert feed, and capacity projections.
- **Orders & Fulfillment**: Order lifecycle board, shipping carrier status, exception queues, and bulk updates.
- **Inventory & Catalog**: SKU catalog, stock ledger, reorder rules, supplier scorecards, and substitution recommendations.
- **Customer Insights**: Cohort builder, retention dashboards, NPS/CSAT trends, and churn risk flags.
- **Financials**: Revenue and margin analytics, expense allocations, and scenario simulations.
- **Automation Rules**: No-code trigger builder with execution history, success/failure rates, and rollback options.
- **Audit & Compliance**: Access trails, policy checks, data residency status, and evidence exports.
- **Settings**: Organization profile, team and role management, API keys, webhooks, and environment controls.

## Key experiences to design

- Command-style global search accessible from the header.
- Configurable cards and widgets per screen with drag-to-reorder and saveable layouts.
- Inline alert acknowledgments and assignment within the status bar drawer.
- Cross-module deep links (e.g., jump from Inventory alert to Automation Rules for remedial playbook).
- Mobile and tablet adaptations that preserve the sidebar/header/status skeleton while reflowing content into stacked cards.
