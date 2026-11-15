# Data table

The shared list UI of the dashboard: every list (products, movements, locations, tasks, the help desk, the workshop, CRM, organization, QR codes, feedback) is built from these pieces.

- `data-table.tsx`: the server-rendered table with sortable header links, a pinned identity column, an actions column holding the column settings, horizontally scrolling middle columns and optional row selection.
- `columns.ts`, `columns-menu.tsx`, `column-resizer.tsx`, `saved-columns.ts`: column visibility, order (pointer and keyboard drag and drop), widths (60–640 px), reset to defaults, and one-year cookies namespaced by user and organization. Persistence is per browser, not synced to the account.
- `filter-bar.tsx`: the filter field menu, multi- or single-choice values, date ranges, text and number ranges, editable chips, removal and clear-all, and the expandable search (`/` to focus, Escape to clear, 300 ms URL debouncing).
- `list-pane.tsx`: a list's body (the desktop table, the narrow list beside an open record, the phone cards and the pagination) and `ListSidePanel`, the record's panel.
- `list-loading.tsx`: the loading skeleton a list's `loading.tsx` renders.
- `local-list.ts`: helpers for lists whose rows are all loaded at once (search folding, stable sorting, paging, parsers) and the translation of old DataView links.
- `use-list-keys.ts`, `table-navigation.tsx`, `table-row.tsx`, `panel-motion.tsx`, `page-link.tsx`: row navigation, ↓/↑/Esc, selected-row styling and the record panel's motion (with reduced-motion support).
- `row-actions.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `tooltip.tsx`, `lib/utils.ts`: the small Radix-based primitives these pieces use.
- `ambra-list.css`: the lists' look, mapped onto Ambra's theme variables (portals included). Class names use the `dt-` prefix.

Every list keeps its whole state in the address (nuqs parsers in its `*-state.ts`).
