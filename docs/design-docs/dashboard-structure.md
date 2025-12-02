# Dashboard Structure

The dashboard keeps the familiar page framing of a sidebar, dashboard header, and status bar, but all visuals and components are redesigned from scratch.

## Screen inventory

- **Operations Overview**: Real-time snapshot of key metrics, system health, and alerts.
- **Orders & Fulfillment**: Pipeline view of orders, shipment statuses, and bottlenecks.
- **Inventory & Catalog**: Stock levels, product variants, reorder thresholds, and supplier signals.
- **Customer Insights**: Cohorts, engagement heatmaps, and satisfaction scores.
- **Financials**: Revenue breakdowns, margin analysis, and forecast charts.
- **Automation Rules**: Triggers, workflows, and execution logs for automated tasks.
- **Audit & Compliance**: Access logs, policy adherence, and exception reports.
- **Settings**: Organization profile, teams & roles, integrations, and environment management.

## Page layout

- **Viewport grid**: Three persistent regions—sidebar (left), dashboard header (top), and status bar (bottom). Content area sits between header and status bar, anchored to the right of the sidebar.
- **Responsive behavior**: Sidebar can collapse to icons on smaller widths; header condenses search and quick actions into a kebab menu; status bar stacks into a single-row ticker.
- **Content hierarchy**: Header drives navigation context, content cards use a three-column grid on desktop and a single column on mobile.

## Sidebar

- **Structure**: Fixed on the left with 240 px width (expanded) and 72 px width (icon-only). Contains logo, primary navigation, and workspace switcher.
- **Navigation grouping**: Sections for Overview, Operations, Insights, Automation, Governance, and Settings.
- **Interactions**: Hover highlights, active state pill with cobalt background, keyboard shortcuts for quick section jumps. Collapsible groups for dense menus.

## Dashboard header

- **Contents**: Page title with breadcrumb, global search, time range selector, primary call-to-action button, and user/avatar menu.
- **Behavior**: Sticky on scroll with slight shadow; search uses command-palette style modal; CTA button color-coded by screen (e.g., "Create automation" in Automation Rules).
- **Contextual metadata**: Optional tags for environment (Prod/Staging) and workspace.

## Status bar

- **Purpose**: Persistent operational feedback channel.
- **Contents**: Sync status indicator, background job queue length, unread alerts count, and current service region. Includes a compact notification bell that opens a side drawer.
- **States**: Color-coded indicators—green for healthy, amber for degraded, red for incidents. Animations limited to pulsing dots for live updates.

## Interaction principles

- Prioritize scannable information density in the main content area while keeping navigation and status unobtrusive.
- Keep primary actions in the header and secondary actions within cards or tables; avoid action overflow in the status bar.
- Support keyboard navigation for all sidebar links, search, and header actions.
