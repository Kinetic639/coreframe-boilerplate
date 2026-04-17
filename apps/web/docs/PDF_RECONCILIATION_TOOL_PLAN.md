# Plan: SVWMS WDD Matcher — `apps/web`

## Context

A new internal tool is needed that accepts a BC (Branch Confirmation) PDF and one or more Brand Relocation PDFs, optionally supplemented by WDD (Warehouse Distribution Document) files, and reconciles them into a unified source of truth. The tool parses each PDF into structured blocks and lines, runs a two-stage block-first → line-level matching engine, supports a structured manual review flow, and exports the result as CSV.

Implemented as a tool in the existing tools platform — registered in `tools_catalog` with slug `svwms-wdd-matcher`, rendered at `/dashboard/tools/svwms-wdd-matcher` via the registry pattern. Not part of the warehouse module.

**Removed (old model, do not reference)**: `pdf_bc_lines`, `pdf_relocation_lines`, `pdf_wdd_lines`, `pdf_reconciliation_matches`.

---

## 1. Final Naming Map

| Concept               | Old name                                        | Final name                                     |
| --------------------- | ----------------------------------------------- | ---------------------------------------------- |
| Display name          | PDF Reconciliation                              | `SVWMS WDD Matcher`                            |
| Tool slug             | `pdf-reconciliation`                            | `svwms-wdd-matcher`                            |
| Route                 | `/dashboard/tools/pdf-reconciliation`           | `/dashboard/tools/svwms-wdd-matcher`           |
| Registry key          | `"pdf-reconciliation"`                          | `"svwms-wdd-matcher"`                          |
| Permission prefix     | `reconciliation.*`                              | `wdd_matcher.*`                                |
| DB table prefix       | `pdf_reconciliation_*` / `pdf_*`                | `wdd_matcher_*`                                |
| Migration: tables     | `20260415100000_pdf_reconciliation_tables.sql`  | `20260415100000_svwms_wdd_matcher_tables.sql`  |
| Migration: storage    | `20260415110000_pdf_reconciliation_storage.sql` | `20260415110000_svwms_wdd_matcher_storage.sql` |
| Storage bucket        | `pdf-reconciliations`                           | `wdd-matcher-files`                            |
| Action file           | `pdf-reconciliation.ts`                         | `wdd-matcher.ts`                               |
| Service file          | `pdf-reconciliation.service.ts`                 | `wdd-matcher.service.ts`                       |
| Hooks file            | `pdf-reconciliation.ts`                         | `wdd-matcher.ts`                               |
| Validation file       | `pdf-reconciliation.ts`                         | `wdd-matcher.ts`                               |
| Logic lib folder      | `src/lib/tools/pdf-reconciliation/`             | `src/lib/tools/svwms-wdd-matcher/`             |
| Component folder      | `src/components/tools/pdf-reconciliation/`      | `src/components/tools/svwms-wdd-matcher/`      |
| React Query namespace | `["pdf-reconciliation"]`                        | `["svwms-wdd-matcher"]`                        |
| i18n namespace        | `modules.tools.pdfReconciliation`               | `modules.tools.wddMatcher`                     |
| Event key prefix      | `reconciliation.*`                              | `wdd_matcher.*`                                |
| Service class         | `PdfReconciliationService`                      | `WddMatcherService`                            |

---

## 2. Corrected File/Folder Map

```
apps/web/
├── src/
│   ├── app/
│   │   └── actions/
│   │       └── tools/
│   │           └── wdd-matcher.ts                        ← all server actions
│   ├── server/
│   │   └── services/
│   │       └── wdd-matcher.service.ts                    ← DB + storage operations
│   ├── hooks/
│   │   └── queries/
│   │       └── tools/
│   │           └── wdd-matcher.ts                        ← React Query hooks + key factory
│   ├── lib/
│   │   ├── tools/
│   │   │   └── svwms-wdd-matcher/
│   │   │       ├── parser.ts                             ← pdfjs-dist extraction + block/line classifier
│   │   │       ├── matcher.ts                            ← block-first + line-level matching engine
│   │   │       └── csv-exporter.ts                       ← CSV string builder (no library)
│   │   └── validations/
│   │       └── wdd-matcher.ts                            ← Zod schemas
│   └── components/
│       └── tools/
│           └── svwms-wdd-matcher/
│               ├── index.tsx                             ← root component (registered in registry)
│               ├── session-list-view.tsx                 ← list of past sessions
│               ├── upload-view.tsx                       ← variable file upload form
│               ├── processing-view.tsx                   ← parse progress steps
│               ├── block-review-view.tsx                 ← block-pair confirmation table
│               ├── line-review-view.tsx                  ← line-level match table within a block pair
│               └── session-summary-view.tsx              ← approved session read-only + CSV export
├── supabase/
│   └── migrations/
│       ├── 20260415100000_svwms_wdd_matcher_tables.sql   ← schema + RLS + permissions + catalog seed
│       └── 20260415110000_svwms_wdd_matcher_storage.sql  ← bucket + RLS policies
```

**Modify**:

- `src/lib/tools/registry.tsx` — add `"svwms-wdd-matcher"` entry
- `src/lib/constants/permissions.ts` — add 4 constants (see section 3)
- `messages/en.json` — add `modules.tools.wddMatcher.*` subtree
- `messages/pl.json` — Polish translations

---

## 3. Corrected Permission Map

| Constant                         | Slug                  | Purpose                                          | Granted to                |
| -------------------------------- | --------------------- | ------------------------------------------------ | ------------------------- |
| `PERMISSION_WDD_MATCHER_READ`    | `wdd_matcher.read`    | View sessions, blocks, matches                   | `org_owner`, `org_member` |
| `PERMISSION_WDD_MATCHER_UPLOAD`  | `wdd_matcher.upload`  | Create sessions, upload/parse PDFs, run matching | `org_owner`, `org_member` |
| `PERMISSION_WDD_MATCHER_REVIEW`  | `wdd_matcher.review`  | Approve/reject block pairs and line matches      | `org_owner`, `org_member` |
| `PERMISSION_WDD_MATCHER_APPROVE` | `wdd_matcher.approve` | Final session sign-off                           | `org_owner` only          |

Add to `src/lib/constants/permissions.ts`. Seed into `permissions` table and `role_permissions` via migration. Gate pattern per action:

- Read (list/get sessions, blocks, matches) → `wdd_matcher.read`
- Write (create session, upload, parse, run matching) → `wdd_matcher.upload`
- Review (block/line approve/reject) → `wdd_matcher.review`
- Approve session → `wdd_matcher.approve`
- Export CSV → `wdd_matcher.read`

---

## 4. Corrected DB Schema Summary

Six tables. No old flat tables. Relation chain:

```
wdd_matcher_sessions
  └── wdd_matcher_session_files   (1 BC + 0..N brand + 0..M wdd per session)
        └── wdd_matcher_blocks    (one per logical order block inside a file)
              └── wdd_matcher_lines  (one per product row inside a block)

wdd_matcher_block_matches         (block-level match; FK → sessions; FK → two blocks)
  └── wdd_matcher_line_matches    (line-level match; FK → block_match; FK → two lines)
```

### Table shapes (column-level, no SQL)

**`wdd_matcher_sessions`**:
`id, organization_id, branch_id, name, status` (`pending|processing|ready_for_review|approved|rejected|failed`), `match_summary JSONB`, `created_by, approved_by, approved_at, created_at, updated_at`

**`wdd_matcher_session_files`**:
`id, session_id, organization_id, file_role` (`bc|brand|wdd`), `file_path, file_name, file_size, brand_label` (user-supplied label for brand files), `parsed_at, parse_error, created_at`

**`wdd_matcher_blocks`**:
`id, session_file_id, session_id, organization_id, block_index, block_type` (`wdd_reconciliation|direct_order|brand_order|wdd_source`), `block_header_text, warehouse_section, brand_label, from_section, to_section, is_excluded` (true for `direct_order`), `page_number, metadata JSONB, created_at`

**`wdd_matcher_lines`**:
`id, block_id, session_id, organization_id, line_number, product_code, product_name, quantity NUMERIC(15,4), unit, raw_text, page_number, metadata JSONB, created_at`

**`wdd_matcher_block_matches`**:
`id, session_id, organization_id, bc_block_id, brand_block_id, wdd_block_id` (optional corroboration), `block_match_type` (`exact|partial|unmatched_bc|unmatched_brand`), `block_confidence INTEGER(0-100), block_match_reasons JSONB, review_status` (`pending|approved|rejected|skipped`), `reviewed_by, reviewed_at, reviewer_notes, created_at, updated_at`

**`wdd_matcher_line_matches`**:
`id, block_match_id, session_id, organization_id, bc_line_id, brand_line_id, wdd_line_id` (optional corroboration), `line_match_type` (`exact|partial|unmatched_bc|unmatched_brand`), `line_confidence INTEGER(0-100), line_match_reasons JSONB, discrepancies JSONB, review_status` (`pending|approved|rejected|skipped`), `reviewed_by, reviewed_at, reviewer_notes, created_at, updated_at`

### RLS pattern

All six tables use `has_permission(organization_id, 'wdd_matcher.read')` for SELECT and `has_permission(organization_id, 'wdd_matcher.upload')` for INSERT. Update on `wdd_matcher_block_matches` and `wdd_matcher_line_matches` gated on `wdd_matcher.review`.

### Indexes

- Sessions: `(organization_id, created_at DESC)`, `(organization_id, status)`
- Session files: `(session_id, file_role)`
- Blocks: `(session_file_id)`, `(session_id, block_type)`
- Lines: `(block_id)`
- Block matches: `(session_id, block_match_type)`, `(session_id, review_status)`
- Line matches: `(block_match_id)`, `(block_match_id, review_status)`

### Storage bucket

Name: `wdd-matcher-files`. `public = false`. `file_size_limit = 26214400` (25 MB). `allowed_mime_types = ['application/pdf']`.
Path: `wdd-matcher-files/{org_id}/{session_id}/{file_id}.pdf` — role and label stored in DB, not path.
RLS: SELECT via `is_org_member(org_id)`, INSERT via `has_permission(org_id, 'wdd_matcher.upload')`, DELETE via `has_permission(org_id, 'wdd_matcher.approve')`.

---

## 5. Corrected Upload and UI Flow

### Upload model

A session accepts:

- **Exactly 1 BC file** — required before matching can run
- **0..N brand files** — each optionally labeled (e.g. "Nike AW25"); at least 1 required to run matching
- **0..M WDD files** — fully optional; used only for WDD corroboration in Stage 3

The UI does not show 3 fixed inputs. It uses a dynamic form:

```
[Session name field]
[BC file input — required, single, FileUpload component]
[Brand files — "Add Brand File" button; each row: FileUpload + optional label text + remove]
[WDD files — "Add WDD/Supporting File" button; each row: FileUpload + remove]
[Submit — disabled until session name + BC file + ≥1 brand file are present]
```

### Upload action flow (per file)

Each file is uploaded one at a time via `uploadFileAction(FormData)`:

1. Validate: MIME = `application/pdf`, size ≤ 25MB
2. Register `wdd_matcher_session_files` row (role + brand_label)
3. Upload to `wdd-matcher-files/{orgId}/{sessionId}/{fileId}.pdf`
4. Return `SessionFile` with `id`

UI immediately triggers `runParseAction(sessionFileId)` per file. Parsing is non-blocking in the UI (each file shows its own parse progress via `processing-view.tsx` steps variant).

Once a file's `parsed_at` is set, a **"Copy as JSON"** button appears on its row. Clicking it calls `getFileJsonAction(sessionFileId)` → receives the full parsed output for that file (`{ blocks: ParsedBlock[] }` with nested lines) serialized as a JSON string → writes to clipboard via `navigator.clipboard.writeText()`. No download, no new route — clipboard only. Shows a `react-toastify` success toast on copy. Uses the existing `copy-to-clipboard.tsx` utility at `src/components/v2/utility/copy-to-clipboard.tsx` if it exposes a programmatic API, otherwise call `navigator.clipboard.writeText()` directly.

### Parse → Match trigger

"Run Matching" button is enabled when: BC file `parsed_at` is set AND at least 1 brand file `parsed_at` is set AND no file has `parse_error` still pending. User triggers `runBlockMatchingAction(sessionId)` which then auto-triggers `runLineMatchingAction` for all auto-approved block pairs.

### View state machine

```
"list"         → SessionListView     (sessions table with status badges + "New Session" button)
"upload"       → UploadView          (dynamic file form above)
"processing"   → ProcessingView      (per-file parse status, overall progress steps)
"block-review" → BlockReviewView     (TanStack Table of block pairs; confirm/reject each)
"line-review"  → LineReviewView      (TanStack Table of line matches inside one selected block pair)
"summary"      → SessionSummaryView  (read-only totals; export CSV button)
```

Navigation between block-review and line-review: clicking a confirmed block pair in `BlockReviewView` navigates to `LineReviewView` for that pair.

---

## 6. Corrected Matching Flow

### BC block classification (parser, not matcher)

```typescript
function classifyBcBlock(headerText: string): "wdd_reconciliation" | "direct_order" {
  // "99." = canonical WDD reconciliation order code in BC documents
  if (/\b99\.\s*Zamówienie\s+WDD\s+KOM_BC/i.test(headerText)) return "wdd_reconciliation";
  return "direct_order";
}
```

`direct_order` blocks → `is_excluded = true` → never enter the matching engine. No per-line keyword scan.

### Stage 1 — Block-level matching

**Input**: all `wdd_reconciliation` blocks from the BC file × all `brand_order` blocks from all brand files.

**Scoring signals** (per BC block × brand block pair):

| Signal                                                                       | Max points |
| ---------------------------------------------------------------------------- | ---------- |
| Part-code overlap ratio ≥ 80% (shared codes / total unique BC codes)         | +40        |
| Part-code overlap ratio 40–79%                                               | +20        |
| Rare/unique part-code overlap ≥ 1 (codes appearing in only 1 block per side) | +20        |
| Total quantity sum within ±5%                                                | +20        |
| Total quantity sum within ±15%                                               | +10        |
| Line-count ratio ≥ 90% (`min/max` of the two block line counts)              | +10        |
| Line-count ratio 70–89%                                                      | +5         |
| `warehouse_section` ↔ `to_section` exact normalized match                    | +10        |
| `warehouse_section` ↔ `to_section` contains match                            | +5         |
| `brand_label` (file label) matches section hint in BC header                 | +5         |

Maximum attainable: 40+20+20+20+10+10+5+5 = 130 → cap at 100.

**Thresholds**:

| Score | `block_match_type` | Auto-action                                                             |
| ----- | ------------------ | ----------------------------------------------------------------------- |
| ≥ 90  | `exact`            | `review_status = 'approved'`; line matching runs immediately            |
| 55–89 | `partial`          | `review_status = 'pending'`; reviewer must confirm before line matching |
| < 55  | —                  | `unmatched_bc` or `unmatched_brand` row; no line matching               |

**Greedy exclusive**: highest-scoring pair wins; both blocks removed from pool. One BC block → at most one brand block.

### Stage 2 — Line-level matching (within approved block pairs only)

**Input**: all BC lines in the BC block × all brand lines in the paired brand block.

| Signal                                  | Points |
| --------------------------------------- | ------ |
| `product_code` exact normalized         | +40    |
| `product_name` Levenshtein ratio ≥ 0.80 | +25    |
| `quantity` exact                        | +25    |
| `quantity` within ±5%                   | +15    |
| `unit` exact                            | +10    |

**Thresholds**:

| Score | `line_match_type` | `review_status`                         |
| ----- | ----------------- | --------------------------------------- |
| ≥ 90  | `exact`           | `approved` (auto)                       |
| 55–89 | `partial`         | `pending`                               |
| < 55  | —                 | `unmatched_bc` or `unmatched_brand` row |

### Stage 3 — WDD corroboration (optional)

For each confirmed `wdd_matcher_line_match` row with a `bc_line_id`:

- Find a WDD block (`wdd_source`) in any WDD session file where section overlaps BC block section
- Within that WDD block, find a line where `normalize(wdd.product_code) == normalize(bc.product_code)` AND quantity within ±5%
- If found: set `wdd_line_id`, `line_confidence += 10` (capped at 100)
- If found but quantity differs > 5%: append to `discrepancies`, no score boost

### Normalization helpers (inline, no library)

```typescript
function normalize(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}
function quantityWithinTolerance(a: number, b: number, pct: number): boolean {
  return Math.abs(a - b) / Math.max(Math.abs(a), 1) <= pct;
}
function levenshteinRatio(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (m === 0 && n === 0) return 1;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return 1 - dp[m][n] / Math.max(m, n);
}
```

### Complexity

- Stage 1: O(BC_blocks × brand_blocks). Typical: ~5 BC × ~15 brand = 75 pairs.
- Stage 2: O(BC_lines × brand_lines) per confirmed pair. ~50 × 50 = 2,500 per pair.
- All synchronous in server action. No background job needed.

---

## 7. Corrected Actions / Services / Hooks

### Actions (`src/app/actions/tools/wdd-matcher.ts`)

| Action                        | Permission            | Input                                                | Returns                                                             |
| ----------------------------- | --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `createSessionAction`         | `wdd_matcher.upload`  | `{ name, branchId? }`                                | `ServiceResult<Session>`                                            |
| `uploadFileAction`            | `wdd_matcher.upload`  | `FormData` (1 file + sessionId + role + brandLabel?) | `ServiceResult<SessionFile>`                                        |
| `runParseAction`              | `wdd_matcher.upload`  | `sessionFileId: string`                              | `ServiceResult<ParseSummary>`                                       |
| `runBlockMatchingAction`      | `wdd_matcher.upload`  | `sessionId: string`                                  | `ServiceResult<BlockMatchSummary>`                                  |
| `runLineMatchingAction`       | `wdd_matcher.upload`  | `blockMatchId: string`                               | `ServiceResult<LineMatchSummary>`                                   |
| `getFileJsonAction`           | `wdd_matcher.read`    | `sessionFileId: string`                              | `ServiceResult<string>` (JSON of parsed blocks+lines for that file) |
| `listSessionsAction`          | `wdd_matcher.read`    | —                                                    | `ServiceResult<Session[]>`                                          |
| `getSessionAction`            | `wdd_matcher.read`    | `sessionId: string`                                  | `ServiceResult<SessionDetail>`                                      |
| `listBlockMatchesAction`      | `wdd_matcher.read`    | `sessionId: string`                                  | `ServiceResult<BlockMatch[]>`                                       |
| `listLineMatchesAction`       | `wdd_matcher.read`    | `blockMatchId: string`                               | `ServiceResult<LineMatch[]>`                                        |
| `reviewBlockMatchAction`      | `wdd_matcher.review`  | `{ blockMatchId, status, notes? }`                   | `ServiceResult<BlockMatch>`                                         |
| `reviewLineMatchAction`       | `wdd_matcher.review`  | `{ lineMatchId, status, notes? }`                    | `ServiceResult<LineMatch>`                                          |
| `bulkApproveExactLinesAction` | `wdd_matcher.review`  | `blockMatchId: string`                               | `ServiceResult<{ count: number }>`                                  |
| `approveSessionAction`        | `wdd_matcher.approve` | `sessionId: string`                                  | `ServiceResult<Session>`                                            |
| `exportCsvAction`             | `wdd_matcher.read`    | `sessionId: string`                                  | `ServiceResult<string>`                                             |

All actions: `loadDashboardContextV2()` → `checkPermission(snapshot, PERMISSION_WDD_MATCHER_*)` → Zod validate → service call → `ServiceResult<T>`.

### Service (`src/server/services/wdd-matcher.service.ts`, class `WddMatcherService`)

```typescript
// Sessions
createSession(supabase, orgId, branchId, name, userId): Session
updateSessionStatus(supabase, sessionId, orgId, status, extra?): void
updateMatchSummary(supabase, sessionId, orgId, summary): void
listSessions(supabase, orgId): Session[]
getSession(supabase, sessionId, orgId): Session | null
approveSession(supabase, sessionId, orgId, userId): Session

// Files
registerFile(supabase, sessionId, orgId, role, fileName, fileSize, brandLabel?): SessionFile
uploadPdf(supabase, orgId, sessionId, fileId, file): string   // storage path
downloadPdfBytes(supabase, path): ArrayBuffer
markFileParsed(supabase, fileId, orgId, error?): void

// Blocks + lines (bulk insert per file)
insertBlocks(supabase, sessionId, orgId, blocks[]): WddMatcherBlock[]  // returns with DB ids
insertLines(supabase, sessionId, orgId, lines[]): void

// Block matching
insertBlockMatches(supabase, sessionId, orgId, matches[]): void
updateBlockMatchReview(supabase, blockMatchId, orgId, status, notes, userId): BlockMatch

// Line matching
insertLineMatches(supabase, blockMatchId, sessionId, orgId, matches[]): void
updateLineMatchReview(supabase, lineMatchId, orgId, status, notes, userId): LineMatch
bulkApproveExactLines(supabase, blockMatchId, orgId, userId): number

// File JSON (for clipboard copy)
getFileJson(supabase, sessionFileId, orgId): string  // JSON.stringify of { file, blocks: (block + lines)[] }

// Export
getExportRows(supabase, sessionId, orgId): ExportRow[]
```

All methods return `ServiceResult<T>`. Normalize `42501 / "row-level security"` → `"You do not have permission"`.

### Hooks (`src/hooks/queries/tools/wdd-matcher.ts`)

```typescript
export const wddMatcherKeys = {
  all: ["svwms-wdd-matcher"] as const,
  sessions: () => [...wddMatcherKeys.all, "sessions"] as const,
  session: (id: string) => [...wddMatcherKeys.sessions(), id] as const,
  blockMatches: (sessionId: string) => [...wddMatcherKeys.session(sessionId), "block-matches"] as const,
  lineMatches: (blockMatchId: string) => [...wddMatcherKeys.all, "line-matches", blockMatchId] as const,
};

// Queries
useSessionsQuery(initialData?)               // staleTime: 2 min
useSessionQuery(sessionId, initialData?)     // staleTime: 30s
useBlockMatchesQuery(sessionId, initialData?) // staleTime: 30s
useLineMatchesQuery(blockMatchId, initialData?) // staleTime: 30s

// Mutations (invalidation targets in comments)
useCreateSessionMutation()                   // → sessions
useUploadFileMutation()                      // → session(id)
useRunParseMutation()                        // → session(id) when complete
useRunBlockMatchingMutation()                // → blockMatches(sessionId)
useRunLineMatchingMutation()                 // → lineMatches(blockMatchId)
useReviewBlockMatchMutation()                // → blockMatches(sessionId)
useReviewLineMatchMutation()                 // → lineMatches(blockMatchId)
useBulkApproveExactLinesMutation()           // → lineMatches(blockMatchId)
useApproveSessionMutation()                  // → session(id)
useGetFileJsonMutation()                     // no cache — fetches JSON string then writes to clipboard
useExportCsvMutation()                       // no cache — client-side Blob download
```

### Review UI (block-first, then line-level)

**`BlockReviewView`** (TanStack Table, one row per `wdd_matcher_block_matches`):

- Columns: `block_match_type` badge, `block_confidence` bar, BC section, brand file label, brand section, BC line count, brand line count, part-code overlap %, `review_status` badge, Confirm / Reject buttons
- Filtering: match type, review status
- "Confirm" calls `reviewBlockMatchAction({ blockMatchId, status: 'approved' })` → triggers `runLineMatchingAction(blockMatchId)`
- "Bulk confirm all exact" calls `bulkApproveExactLinesAction` (block-level equivalent)
- Clicking a confirmed row navigates to `LineReviewView` for that block pair

**`LineReviewView`** (TanStack Table, one row per `wdd_matcher_line_matches`):

- Columns: `line_match_type` badge, `line_confidence` bar, BC product code, BC qty, brand product code, brand qty, WDD corroboration indicator, discrepancies count, `review_status` badge, Approve / Reject / Skip buttons
- Filtering: match type, review status, has discrepancies
- "Bulk approve all exact lines" calls `bulkApproveExactLinesAction(blockMatchId)`
- Back button returns to `BlockReviewView`

---

## 8. Corrected Event Map

All events emitted via `eventService.emit()`. Event keys registered in `src/server/audit/event-registry.ts`.

| Trigger                              | Event key                              | Metadata shape                                                                              |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `createSessionAction` (success)      | `wdd_matcher.session_created`          | `{ session_id, name }`                                                                      |
| `runParseAction` (success, per file) | `wdd_matcher.file_parsed`              | `{ session_id, session_file_id, file_role, block_count, line_count }`                       |
| `runBlockMatchingAction` (success)   | `wdd_matcher.block_matching_completed` | `{ session_id, exact_block_matches, partial_block_matches, unmatched_bc, unmatched_brand }` |
| `approveSessionAction` (success)     | `wdd_matcher.session_approved`         | `{ session_id, exact_block_matches, partial_block_matches, total_lines_matched }`           |
| `exportCsvAction` (success)          | `wdd_matcher.export_downloaded`        | `{ session_id }`                                                                            |

No event on line-level review (too granular). Events fire only on session-scope and file-scope transitions.

---

## 9. Corrected CSV Export Shape

Built server-side in `src/lib/tools/svwms-wdd-matcher/csv-exporter.ts`. No library. Returns UTF-8 string with BOM (`\uFEFF`) for Polish character Excel compatibility.

One row per `wdd_matcher_line_matches` entry (including unmatched rows). Grouped by block match for readability.

**Columns**:

```
session_name
session_status
bc_file_name
brand_file_name
brand_file_label
block_match_type
block_confidence
block_review_status
bc_block_header
bc_warehouse_section
brand_block_header
brand_to_section
line_match_type
line_confidence
line_review_status
bc_product_code
bc_product_name
bc_quantity
bc_unit
brand_product_code
brand_product_name
brand_quantity
brand_unit
wdd_corroborated           (yes/no)
wdd_product_code
wdd_quantity
discrepancy_fields         (comma-separated field names with discrepancies)
discrepancy_detail         (JSON string of { field, bc_value, brand_value } array)
reviewer_notes
```

No `rel_*` columns. No `bc_direct_order` column (excluded blocks never appear in the export). Unmatched BC lines: brand columns empty. Unmatched brand lines: BC columns empty.

---

## 10. Corrected Phased Implementation Plan

### Phase 1 — Foundation

**Scope**: DB schema, permissions, storage bucket, catalog seed, stub component registered.

**Files**:

- `supabase/migrations/20260415100000_svwms_wdd_matcher_tables.sql` — 6 tables, RLS, permission seeds, `tools_catalog` seed for `svwms-wdd-matcher`
- `supabase/migrations/20260415110000_svwms_wdd_matcher_storage.sql` — `wdd-matcher-files` bucket + RLS
- `src/lib/constants/permissions.ts` — add `PERMISSION_WDD_MATCHER_READ/UPLOAD/REVIEW/APPROVE`
- `src/components/tools/svwms-wdd-matcher/index.tsx` — stub ("Tool loading…")
- `src/lib/tools/registry.tsx` — add `"svwms-wdd-matcher": dynamic(..., { ssr: false })`
- `messages/en.json` + `messages/pl.json` — add `modules.tools.wddMatcher` key skeleton

**Risks**: `has_permission()` RLS function — verify `wdd_matcher.*` slugs follow the existing format before seeding. Storage RLS path extraction assumes `{orgId}` is first folder segment — verify `storage.foldername()` behavior.

**Test**: Enable `svwms-wdd-matcher` from tools catalog → `/dashboard/tools/svwms-wdd-matcher` renders stub. Query `wdd_matcher_sessions` as org B user → 0 rows (RLS isolation).

---

### Phase 2 — Upload + Parse

**Scope**: Variable file upload form, server-side block-aware PDF parsing, block/line storage.

**Files**:

- `apps/web/package.json` — add `pdfjs-dist` (legacy Node.js build)
- `src/lib/tools/svwms-wdd-matcher/parser.ts` — `ParsedBlock[]` output with `classifyBcBlock`, `classifyBrandBlock`; block header detection via `/^\d+\.\s+Zamówienie/i`
- `src/lib/validations/wdd-matcher.ts` — upload file schema (role enum, brandLabel, sessionId)
- `src/server/services/wdd-matcher.service.ts` — session CRUD + file registration + storage upload + block/line bulk insert
- `src/app/actions/tools/wdd-matcher.ts` — `createSessionAction`, `uploadFileAction`, `runParseAction`
- `src/hooks/queries/tools/wdd-matcher.ts` — `useSessionsQuery`, `useSessionQuery`, `useCreateSessionMutation`, `useUploadFileMutation`, `useRunParseMutation`
- `src/components/tools/svwms-wdd-matcher/upload-view.tsx` — dynamic file form (1 BC + N brand + M wdd) using existing `file-upload.tsx`
- `src/components/tools/svwms-wdd-matcher/processing-view.tsx` — per-file parse progress using existing `progress-indicator.tsx` steps variant

**Risks**: `pdfjs-dist` legacy build requires `workerSrc` to be set to empty string or disabled in Node.js context. Parser block-header detection regex must be validated against real BC PDFs before proceeding to Phase 3.

**Test**: Upload 1 BC + 2 brand files → verify `wdd_matcher_session_files` (3 rows), `wdd_matcher_blocks` (correct `block_type` + `is_excluded`), `wdd_matcher_lines` populated. Verify BC `direct_order` blocks have `is_excluded = true` and produce no lines in the export pool.

---

### Phase 3 — Matching Engine

**Scope**: Block-first scoring, greedy pairing, line-level matching, WDD corroboration, match summary.

**Files**:

- `src/lib/tools/svwms-wdd-matcher/matcher.ts` — `scoreBlockPair()`, `runBlockMatching()`, `scoreLinePair()`, `runLineMatching()`, `runWddCorroboration()`
- `src/app/actions/tools/wdd-matcher.ts` — add `runBlockMatchingAction`, `runLineMatchingAction`
- `src/server/services/wdd-matcher.service.ts` — add `insertBlockMatches`, `insertLineMatches`, `updateMatchSummary`
- `src/hooks/queries/tools/wdd-matcher.ts` — add `useBlockMatchesQuery`, `useRunBlockMatchingMutation`, `useRunLineMatchingMutation`
- `src/server/audit/event-registry.ts` — add `wdd_matcher.block_matching_completed`

**Risks**: Part-code overlap ratio requires all lines per block to be loaded in memory for scoring. For very large blocks (>500 lines), normalize and cache product codes before the O(BC×brand) loop. WDD corroboration assumes shared product code format between BC and WDD files — verify with real documents.

**Test**: Unit tests for `matcher.ts` covering: exact block pair (score ≥ 90), partial block pair (score 55–89), unmatched BC block, unmatched brand block, `direct_order` blocks never reach scoring. Line-level: exact line, partial line, unmatched line, WDD corroboration boost, WDD discrepancy flag. Verify `match_summary` JSONB shape on `wdd_matcher_sessions`.

---

### Phase 4 — Review UI

**Scope**: Two-level review: block confirmation table + line-level match table within confirmed pairs.

**Files**:

- `src/components/tools/svwms-wdd-matcher/block-review-view.tsx` — TanStack Table of block matches; Confirm / Reject per row; bulk confirm exact
- `src/components/tools/svwms-wdd-matcher/line-review-view.tsx` — TanStack Table of line matches within selected block pair; Approve / Reject / Skip per row; bulk approve exact lines
- `src/components/tools/svwms-wdd-matcher/session-list-view.tsx`
- `src/components/tools/svwms-wdd-matcher/session-summary-view.tsx`
- `src/app/actions/tools/wdd-matcher.ts` — add `reviewBlockMatchAction`, `reviewLineMatchAction`, `bulkApproveExactLinesAction`, `approveSessionAction`
- `src/hooks/queries/tools/wdd-matcher.ts` — add `useLineMatchesQuery`, `useReviewBlockMatchMutation`, `useReviewLineMatchMutation`, `useBulkApproveExactLinesMutation`, `useApproveSessionMutation`

**Risks**: `@tanstack/react-table` is installed but has not been used in this codebase yet — verify React 19 + Next.js 16 compatibility with a minimal table before building the full review table. Two-level navigation (block table → line table) requires clear state management in the root component.

**Test**: Full review flow — confirm one partial block pair → verify `runLineMatchingAction` is triggered → approve one line match, reject one, bulk approve exact → approve session. Verify `org_member` cannot call `approveSessionAction` (permission gate). Verify rejected block pair produces no line matches.

---

### Phase 5 — Export + Audit

**Scope**: CSV export, event emission wired into all actions, session list with status badges.

**Files**:

- `src/lib/tools/svwms-wdd-matcher/csv-exporter.ts` — `buildCsvString(rows: ExportRow[]): string` with BOM
- `src/app/actions/tools/wdd-matcher.ts` — add `exportCsvAction`; wire `eventService.emit()` into `createSessionAction`, `runParseAction`, `runBlockMatchingAction`, `approveSessionAction`, `exportCsvAction`
- `src/hooks/queries/tools/wdd-matcher.ts` — add `useExportCsvMutation` (Blob + `URL.createObjectURL` download)
- `src/server/audit/event-registry.ts` — add all 5 event keys from section 8

**Risks**: BOM prefix (`\uFEFF`) required for Excel Polish character rendering — easy to omit. `discrepancy_detail` column is a JSON string inside CSV — must be properly escaped (double-quote any quotes inside the JSON string).

**Test**: Export CSV from an approved session → file downloads, opens in Excel without encoding issues, Polish characters render correctly, `discrepancy_detail` column parses as valid JSON. Verify 5 event rows appear in `event_logs` across a full session lifecycle.

---

## 11. Dependency Audit (unchanged from original audit)

### Add

- **`pdfjs-dist`** — required. Only library providing positional text extraction in Node.js. Use `pdfjs-dist/legacy/build/pdf.mjs`.

### Reuse (already installed)

- `zod` — all validation schemas
- `@tanstack/react-query` — all hooks
- `@tanstack/react-table` — block review + line review tables
- `react-hook-form` — upload form
- `src/components/v2/forms/file-upload.tsx` — file inputs (already built)
- `src/components/v2/feedback/progress-indicator.tsx` — parse progress steps
- `src/components/v2/feedback/loading-skeleton.tsx` — loading states
- `src/components/v2/feedback/confirmation-dialog.tsx` — session approve confirm
- `src/components/ui/badge.tsx` — status/match-type badges
- `react-toastify` — all toasts

### Explicitly avoid

- `pdf-parse` — text-only, no positional data
- `pdf-lib` — write-only
- `puppeteer` — renders HTML, does not parse PDFs
- `papaparse` / `xlsx` — CSV is built with string join; no library needed
- `p-queue` / `bull` — no queue infrastructure; synchronous actions are sufficient

---

## 12. Security Controls

| Layer            | Control                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Storage bucket   | `public = false`; no direct URL; server-side download only                               |
| Storage RLS      | INSERT path enforces `has_permission(org_id, 'wdd_matcher.upload')`                      |
| File validation  | MIME = `application/pdf`, size ≤ 25MB — checked in action before any storage write       |
| Action auth      | `loadDashboardContextV2()` fresh per call; user ID from context, never from client input |
| DB RLS           | All 6 tables gated via `has_permission()`                                                |
| PDF parsing      | Server-side only; raw bytes never reach the browser                                      |
| Session scoping  | All service queries filter on `organization_id` from auth context                        |
| Input validation | Zod parse before every service call                                                      |
| Export           | CSV built server-side from org-scoped query                                              |

## 13. Performance Considerations

- **Parsing**: synchronous server action; 25MB PDF limit keeps it within 30s Next.js timeout.
- **Block matching**: O(BC_blocks × brand_blocks); typically < 200 pairs; completes in < 50ms.
- **Line matching**: O(BC_lines × brand_lines) per confirmed pair; cache normalized product codes before inner loop.
- **Bulk inserts**: single `supabase.from().insert(rows[])` call per table per file; no row-by-row inserts.
- **Review tables**: paginate `listLineMatchesAction` (default 50 rows); `manualPagination` in TanStack Table.
- **Export**: single DB query → in-memory CSV string → Blob download; no temp files.
