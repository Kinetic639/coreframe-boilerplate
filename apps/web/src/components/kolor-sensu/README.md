# Components imported from Kolor Sensu

Source: `D:/dev/kolor-sensu-review/packages/ui/src`, revision `b337b32faa790386c2ad45aa9d0bb308aca1eb22`.

The 15 TypeScript files retain the source component implementations and relative imports. Local changes are Prettier formatting and removal of one redundant ESLint directive. `source-manifest.json` records the source SHA-256 values and the hashes after normalization. This directory does not depend on the other project's folder at runtime.

The product adapter lives in `app/[locale]/dashboard/warehouse/items/_components`. Its scoped CSS gives the table the chosen Zoho-inspired appearance; it maps the imported semantic tokens to Ambra's existing color variables, including Radix portals. Do not import Kolor Sensu's global theme, which would override Ambra's palette settings.

Reused behavior:

- Server-rendered table, sortable header links, pinned identity and actions columns, horizontally scrolling middle columns.
- A mandatory actions column with the column settings in its header. The pinned identity/actions columns cannot be hidden or reordered.
- Column visibility, order, pointer/keyboard drag and drop, reset to defaults, and at least one visible data column.
- Column widths: pointer drag, Left/Right keys, double-click reset, bounds of 60–640 px, immediate local feedback.
- One-year cookies for widths and layout. The adapter namespaces them by authenticated user and organization. Persistence applies to this browser; it is not synchronization to the user's account across devices.
- Filter field menu, multi-select values, editable chips, individual removal and clear-all. Filter order follows column order. The generic source also supports date ranges; product date filters are not configured.
- Expandable search, `/` to focus, Escape to clear, 300 ms URL debouncing, server transitions.
- Row navigation, selected-row styling, plain keyboard links, animated record panel and close behavior, reduced-motion support, and URL-backed panel tabs.

Existing libraries supply React, Next.js, nuqs, Radix, dnd-kit, Lucide, GSAP, clsx and tailwind-merge. `@gsap/react` was added for the original panel animation. Product queries and permissions remain Ambra's; no scheduling services, contracts, database schemas or secrets from Kolor Sensu were imported.
