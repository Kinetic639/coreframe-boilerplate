# Documentation Module — Architecture & Specification

**Version:** 1.0
**Last Updated:** November 26, 2025
**Status:** Implementation Phase

---

## Purpose

The Documentation Module provides a unified, version-controlled documentation system for AmbraWMS that serves end users, developers, and AI assistants.

### Key Features

- File-based Markdown/MDX storage
- Multilingual support (PL/EN initially, unlimited languages later)
- Lexical Editor integration for editing and rendering
- Automatic navigation generation
- Full-text search
- AI-optimized structure for Claude/ChatGPT consumption
- Clear division between user docs, internal docs, developer docs, specifications, and APIs

---

## Directory Structure

Documentation is stored in `/docs` with the following structure:

```
/docs/

  /_templates/          # Document templates
    guide.md
    reference.md
    concept.md
    troubleshooting.md
    api.md
    specification.md

  /_snippets/           # Reusable content
    common-workflows.md
    terminology.md
    safety-warnings.md

  /meta/               # System documentation
    ai-context.md      # AI assistant context
    architecture.md    # Module architecture
    module-guide.md    # How to use the documentation system

  /user/               # End-user documentation
    _quick-start/      # Quick start guides
    _cheat-sheets/     # Reference cards
    inventory/
      stock-movements/
        en.md
        pl.md
      reservations/
        en.md
        pl.md

  /dev/                # Developer documentation
    architecture/
    api/
    components/

  /internal/           # Business documentation
    processes/
    compliance/

  /spec/               # Technical specifications
    warehouse/
      stock-movements-specification/
        en.md
        pl.md

  /api/                # API documentation
    inventory/
    orders/
```

### Section Descriptions

- **/docs/user** — End-user guides, UI instructions, workflows, onboarding, how-to articles
- **/docs/dev** — Developer documentation (architecture, SDK, integrations, environments)
- **/docs/internal** — Internal processes, operations, business policies, compliance
- **/docs/spec** — Feature specifications, technical blueprints, domain logic references
- **/docs/api** — Public API documentation and integration references
- **/docs/meta** — Documentation system itself, AI context, architecture decisions
- **/docs/\_templates** — Standard document templates for consistency
- **/docs/\_snippets** — Reusable content blocks

---

## File Format

All documentation is written in **Markdown or MDX**, using frontmatter:

```yaml
---
title: "Stock Movements"
slug: "stock-movements"
lang: "en"
version: "1.0"
lastUpdated: "2025-11-26"
tags: ["inventory", "warehouse", "regulations"]

# Enhanced metadata
category: "inventory"
difficulty: "beginner" # beginner|intermediate|advanced
audience: ["warehouse-staff", "managers"]
status: "published" # draft|review|published|archived
related: ["reservations", "transfers"]
maintainer: "warehouse-team"
estimatedReadTime: 5
prerequisites: ["basic-inventory"]
---
# Document Content

Your content here...
```

### Frontmatter Fields

**Required:**

- `title` - Document title
- `slug` - URL-friendly identifier
- `lang` - Language code (en, pl, de, etc.)
- `version` - Document version
- `lastUpdated` - Last update date

**Optional but Recommended:**

- `tags` - Array of tags for categorization
- `category` - Primary category
- `difficulty` - Difficulty level
- `audience` - Target audience(s)
- `status` - Publication status
- `related` - Related documents
- `maintainer` - Who maintains this doc
- `estimatedReadTime` - Minutes to read
- `prerequisites` - Topics to read first

---

## Language Support

### Translation Pattern

Each topic folder contains multiple language versions:

```
/stock-movements/
  en.md
  pl.md
  de.md
  es.md
```

### Fallback Rules

If a user requests `/pl`:

1. If `pl.md` exists → render it
2. If it does not → fallback to `en.md`
3. If neither exists → show 404

The UI displays a banner:

> "This document is not yet translated into Polish. Showing English version."

### Translation Workflow

When a translation is missing:

1. User clicks "Create translation"
2. Lexical imports the English version into the editor
3. User translates
4. Saving generates e.g. `pl.md`

---

## Rendering Pipeline

### Loading

1. Determine section/topic/language
2. Locate the correct file
3. If not found → fallback
4. Parse frontmatter
5. Read file content

### Markdown Rendering

Markdown is processed using the Lexical Markdown importer:

- MD → Lexical state → React components
- Guarantees consistent formatting
- Allows editor/viewer reuse

### MDX Rendering

If `.mdx`:

- Content is passed through an MDX compiler
- Supports interactive components
- Enables embedded diagrams, callouts, renderable code blocks

---

## Lexical Editor Integration

Lexical is used for:

### Editing Mode

1. Load `.md` or `.mdx` file
2. Convert Markdown to Lexical state
3. User edits content
4. Export Lexical → Markdown
5. Save file to disk

### Preview Mode

- Render Markdown or MDX
- Full support for headings, lists, tables, blockquotes, images
- Support for custom UI components in MDX

### Translation Mode

When editing a non-existent translation:

1. Original language (default EN) is auto-loaded
2. Editor prompts user to create a new translation
3. Saving stores `pl.md` (or selected language)

---

## Routing

Documentation URLs follow:

```
/docs/[section]/[topic]/[lang]
```

Examples:

```
/docs/user/stock-movements/en
/docs/spec/warehouse-rules/pl
/docs/dev/authentication/jwt/en
/docs/api/inventory/get-stock/pl
```

### Routing Rules

- `section` must match an existing directory
- `topic` resolves to a topic folder
- `lang` resolves to a file inside topic folder
- If `lang` missing → fallback

---

## Navigation System

Navigation is dynamically generated by scanning `/docs`.

It uses:

- folder names
- frontmatter title
- natural sorting rules
- multi-level folder depth

Example navigation tree:

```
User Guide
  Getting Started
  Inventory
    Stock Movements
    Reservations
    Transfers
  Purchase Orders

Developer Documentation
  Architecture
  Backend
    Authentication
    RLS Policies
  Frontend
    Components
    Routing
```

---

## Search System

Full-text search indexes:

- titles
- headings
- frontmatter tags
- body content

Search metadata includes:

- section
- topic
- file path
- language
- version
- tags

Search returns results ranked by relevance.

### Search Facets

```typescript
{
  query: "stock movements",
  filters: {
    section: ["user", "spec"],
    language: "en",
    difficulty: ["beginner", "intermediate"],
    tags: ["inventory"],
    audience: ["warehouse-staff"]
  }
}
```

---

## Linking and Cross-Referencing

Cross-linking is supported through:

```markdown
[See Stock Movements](/docs/user/inventory/stock-movements/en)
```

Relative links are allowed:

```markdown
../reservations/en
```

AI tools use slug references for context understanding.

---

## Snippet System

Reusable snippets in `/docs/_snippets/`:

```
/docs/_snippets/
  warehouse-terminology.md
  safety-warnings.md
  common-workflows.md
```

Include them in docs:

```markdown
{{snippet:warehouse-terminology}}

Your main content here...

{{snippet:safety-warnings}}
```

When you update a snippet, all documents using it are updated.

---

## Interactive MDX Components

For `.mdx` files, standard interactive components:

```tsx
// Callouts
<Callout type="warning">
  This operation cannot be undone!
</Callout>

// Expandable sections
<Details summary="Advanced Options">
  Content here...
</Details>

// Code playgrounds
<CodePlayground language="typescript">
  // Editable code here
</CodePlayground>

// Step-by-step guides
<Steps>
  <Step title="Create Product">...</Step>
  <Step title="Set Reorder Point">...</Step>
</Steps>

// Video embeds
<Video src="/videos/how-to-receive-delivery.mp4" />

// Screenshots with annotations
<Screenshot
  src="/screenshots/inventory-dashboard.png"
  annotations={[
    { x: 100, y: 200, label: "Click here" }
  ]}
/>

// Role-based content
<RoleContent roles={["warehouse_manager", "admin"]}>
  ## Advanced Settings

  Only managers can configure these...
</RoleContent>
```

---

## Inline Help Integration

In UI components, reference docs directly:

```tsx
<Button onClick={handleAction}>
  Create Movement
  <HelpIcon docPath="/user/inventory/stock-movements" />
</Button>
```

Or show contextual help:

```tsx
<FormField name="reorder_point">
  <Label>Reorder Point</Label>
  <Input />
  <DocSnippet path="/user/inventory/reorder-points#definition" />
</FormField>
```

---

## Versioning

Versioning occurs through:

- Git commits
- Frontmatter version tags
- Optional versioned folders for major releases:

```
/docs/user/inventory/
  stock-movements/
    en.md          ← Current version
    pl.md

  _archive/
    v1.0/
      stock-movements/
        en.md
        pl.md
```

**Recommended:** Keep ONE current version, use Git tags/branches for historical versions.

---

## AI Consumption (Claude / ChatGPT)

The folder structure is optimized for AI:

- Predictable section/topic hierarchy
- Structured metadata
- One file per language
- Content separated from code
- All domain knowledge in `/docs/spec`
- Business logic in `/docs/internal`
- Stable URLs for linking

AI can:

- Search
- Answer questions
- Generate code based on specs
- Create migration plans
- Use unified documentation as ground truth

### AI Context File

`/docs/meta/ai-context.md` provides context for AI assistants:

```markdown
---
title: "AI Assistant Context"
purpose: "Provide context for Claude/ChatGPT when helping users"
---

# System Overview

- Application: AmbraWMS (Warehouse Management System)
- Tech Stack: Next.js 15, Supabase, TypeScript
- Primary Language: Polish (PL)
- Secondary: English (EN)

# Key Concepts

- Branch = Warehouse (physical location)
- Location = Bin/Shelf (storage within warehouse)
- Movement Types: SAP-style codes (101-613)

# Common User Questions

...

# Documentation Structure

...
```

---

## Implementation Roadmap

### Phase 1: Core System (Week 1) ✅ CURRENT

1. Set up `/docs` directory structure
2. Implement Markdown file loader
3. Build basic Lexical viewer
4. Create simple navigation
5. Implement language fallback logic
6. Module configuration and routing

### Phase 2: Editor & Translation (Week 2)

1. Integrate Lexical editor
2. Build "Edit" mode
3. Implement translation workflow
4. Add frontmatter editor

### Phase 3: Search & Navigation (Week 3)

1. Implement full-text search
2. Build advanced navigation tree
3. Add breadcrumbs
4. Implement related docs

### Phase 4: Advanced Features (Week 4)

1. Add MDX component support
2. Implement snippet system
3. Build inline help widgets
4. Add analytics/feedback

---

## Technical Rules & Requirements

### Naming Conventions

- Folder names: lowercase, hyphens
- Filenames: language code (`en.md`, `pl.md`)
- `slug`: must match folder name
- Only ASCII characters in slugs

### Supported Languages

Initially:

```
en
pl
```

Future languages simply require an additional `.md` file.

### Markdown Extensions Supported

- tables
- fenced code blocks
- callouts
- images
- emoji
- checklists
- anchors
- MDX components

---

## Migration Strategy for Existing Docs

Current structure:

```
/docs/warehouse/
  README.md
  STOCK_MOVEMENTS_SPECIFICATION.md
  WAREHOUSE_IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md
```

New structure:

```
/docs/spec/warehouse/stock-movements-specification/en.md
/docs/spec/warehouse/implementation-status/en.md
/docs/user/warehouse/getting-started/en.md
/docs/dev/warehouse/architecture/en.md
```

**Migration Script:**

1. Create topic folders
2. Move files, rename to `en.md`
3. Add frontmatter to each file
4. Commit to Git
5. Verify navigation auto-generates

---

## Examples

### Example Topic Folder

```
/docs/user/inventory/stock-movements/
  en.md
  pl.md
```

### Example Frontmatter

```yaml
---
title: "Reservations"
slug: "reservations"
lang: "pl"
version: "1.0"
tags: ["inventory", "reservation", "warehouse"]
category: "inventory"
difficulty: "intermediate"
audience: ["warehouse-staff"]
status: "published"
lastUpdated: "2025-11-26"
estimatedReadTime: 8
---
```

---

## Future Extensions

- AI-powered doc generation from code
- Multi-versioning per product release
- API schema auto-sync into `/docs/api`
- Diagram rendering support (Mermaid.js)
- Collaborative editing (Yjs)
- AI translation assistant
- Analytics and feedback system
- Inline help widgets throughout app

---

## Summary

This Documentation Module:

✅ Uses file-based Markdown
✅ Supports multilingual content
✅ Integrates with Lexical Editor
✅ Supports MDX
✅ Auto-generates navigation
✅ Supports full-text search
✅ Optimizes documentation for AI
✅ Supports scalable folder hierarchy
✅ Provides fallback rules for translations
✅ Includes reusable snippets
✅ Supports role-based content
✅ Enables inline contextual help

This file defines the full behavior and requirements of the module.
All implementations must follow this specification exactly.

---

**Document Control:**

| Version | Date       | Author | Changes               |
| ------- | ---------- | ------ | --------------------- |
| 1.0     | 2025-11-26 | Claude | Initial specification |

---

_End of Documentation Module Specification_
