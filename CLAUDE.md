# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run type-check` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

**CRITICAL**: ALWAYS kill the development server (bash_1 or any background process) when finished testing or implementing a task. Use KillBash tool to terminate any running processes before completing tasks. Never leave servers running in the background.

## Supabase Commands

**IMPORTANT: NEVER run local Supabase. Always use remote project ID: zlcnlalwfmmtusigeuyk**

- `npm run supabase:link:dev` - Link to development Supabase project
- `npm run supabase:link:prod` - Link to production Supabase project
- `npm run supabase:migration:new` - Create new database migration
- `npm run supabase:migration:up` - Apply migrations
- `npm run supabase:gen:types` - Generate TypeScript types from Supabase schema

## Architecture Overview

This is a Next.js 15 SaaS boilerplate with the following key architectural patterns:

### Module System

The application uses a modular architecture where features are organized as modules in `src/modules/`:

- Each module has its own `config.ts` that defines routes, widgets, and metadata
- Modules can be dynamically loaded based on organization context (see `getAllModules()` in `src/modules/index.ts`)
- Current modules: home, warehouse, teams, organization-management, support

### Multi-tenancy with Organizations and Branches

- Multi-tenant architecture with organizations and branches
- User context includes `activeOrg`, `activeBranch`, and `availableBranches`
- Context is managed via Zustand store in `src/lib/stores/app-store.ts`
- Server-side context loading in `src/lib/api/load-app-context-server.ts`

### Authentication & Authorization

- Supabase-based authentication with role-based access control (RBAC)
- Role validation utilities in `src/utils/auth/`
- Components for role-based rendering: `HasAnyRoleClient`, `HasAnyRoleServer`
- JWT-based role extraction and validation

### Internationalization

- next-intl for internationalization
- Messages in `messages/` directory (en.json, pl.json)
- Locale-based routing with `[locale]` dynamic segments

### Database Integration

- Supabase with TypeScript types generated in `supabase/types/types.ts`
- Database migrations in `supabase/migrations/`
- Utility functions for client/server Supabase instances in `src/utils/supabase/`

### UI Architecture

- Tailwind CSS + shadcn/ui component library
- Components organized in `src/components/ui/` (shadcn/ui) and feature-specific folders
- Dashboard layout with sidebar navigation using shadcn/ui sidebar component
- Responsive design with mobile-first approach

**IMPORTANT**: Always prioritize using shadcn/ui components over creating custom components. If you need a UI component:

1. First check if shadcn/ui has that component available
2. Add the shadcn/ui component using `npx shadcn@latest add [component-name]`
3. Only create custom components if shadcn/ui doesn't have a suitable component
4. Common shadcn/ui components include: button, input, dialog, select, radio-group, checkbox, tabs, accordion, etc.

**CRITICAL**: Always use `react-toastify` for toast notifications. NEVER use `sonner` or any other toast library.

```typescript
// ✅ CORRECT - Use react-toastify
import { toast } from "react-toastify";

toast.success("Operation completed successfully");
toast.error("Something went wrong");
toast.info("Information message");
toast.warning("Warning message");

// ❌ WRONG - Never use these
import { useToast } from "@/hooks/use-toast"; // Sonner-based
import { toast } from "sonner"; // Wrong library
```

### State Management

- Zustand for client-side state management
- Stores in `src/lib/stores/` for app context, user context, sidebar state, and audit functionality
- Server-side context loading and client-side hydration pattern

## Key Development Notes

### Path Aliases

- `@/*` - `./src/*`
- `@app/*` - `./src/app/*`
- `@components/*` - `./src/components/*`
- `@utils/*` - `./src/utils/*`
- `@supabase/*` - `./src/utils/supabase/*`
- `@actions/*` - `./src/app/actions/*`
- `@modules/*` - `./src/modules/*`

### Code Quality

- ESLint and Prettier configured with strict TypeScript rules
- Husky pre-commit hooks with lint-staged for code quality enforcement
- TypeScript strict mode enabled with comprehensive type checking

### Testing and Quality Assurance

- Always run `npm run type-check` and `npm run lint` before committing changes
- Format code with `npm run format` to maintain consistency
- Build must succeed with `npm run build` before deployment

### Security & Authorization Requirements

**MANDATORY**: When implementing any new feature, you MUST validate and implement proper security measures:

#### 1. Row Level Security (RLS) & Policies

- **Always check existing RLS policies** before making changes to avoid breaking functionality
- **Never modify or delete existing policies** in a destructive way
- **Add new policies incrementally** - create new policies rather than replacing existing ones
- **Test RLS policies thoroughly** to ensure they don't block legitimate operations
- Use the database `public.authorize()` function for server-side permission validation

#### 2. Permission System

- **Verify required permissions exist** in the `permissions` table for the feature
- **Check role assignments** - ensure appropriate roles have the necessary permissions
- **Use permission-based access control** - validate permissions both client-side and server-side
- **Never bypass permission checks** - always validate permissions before operations

#### 3. Storage Security

- **Implement storage bucket policies** for file uploads/access
- **Use organization/branch-specific folder structures** to isolate data
- **Validate file types and sizes** before upload
- **Use server actions** for file operations instead of direct client calls

#### 4. Database Security Checklist

Before implementing database operations:

- ✅ RLS policies in place for all affected tables
- ✅ Proper permission validation using `public.authorize()`
- ✅ User context and organization/branch isolation
- ✅ Server-side validation in API routes/server actions
- ✅ No direct client-side database modifications

#### 5. Security Testing

- Test with different user roles and permission levels
- Verify RLS policies prevent unauthorized access
- Check that file uploads respect storage policies
- Validate that permission checks work on both client and server

**Remember**: Security is implemented in layers - database RLS, permission validation, server-side checks, and client-side guards. All layers must be properly configured for robust security.

### Documentation and Library Reference

**IMPORTANT**: Always use Context7 MCP server for up-to-date library documentation when coding.

#### Context7 Usage Pattern

1. **Always resolve library ID first**: Use `mcp__context7__resolve-library-id` with the library name
2. **Then fetch documentation**: Use `mcp__context7__get-library-docs` with the resolved library ID

#### When to Use Context7

- Before implementing any feature with external libraries (React, Next.js, Supabase, shadcn/ui, etc.)
- When encountering API changes or deprecated methods
- For best practices and latest patterns
- When debugging library-specific issues

#### Examples

```
// First resolve library ID
mcp__context7__resolve-library-id: "next.js"
// Then get docs with resolved ID
mcp__context7__get-library-docs: "/vercel/next.js"

// For React hooks
mcp__context7__resolve-library-id: "react"
mcp__context7__get-library-docs: "/facebook/react"

// For Supabase
mcp__context7__resolve-library-id: "supabase"
mcp__context7__get-library-docs: "/supabase/supabase"
```

**Never skip Context7 lookup** - always verify current documentation before implementing features or fixing issues.

## Implemented Modules

### 1. Home Module (`/dashboard/start`)

**Purpose**: Dashboard home page with news and announcements  
**Features**:

- News feed display (`/dashboard/start`)
- Add news functionality (role-restricted to `branch_admin`)
- Quick actions and announcements

### 2. Warehouse Module (`/dashboard/warehouse/*`)

**Purpose**: Complete warehouse management system with B2B and ecommerce integration  
**Color Theme**: `#10b981` (green)  
**Features**:

#### Products Management

- Normalized structure:
  - `products` – base data
  - `product_variants` – sizes/colors/forms
  - `product_inventory_data` – per-org/branch purchase data
  - `product_ecommerce_data` – pricing, visibility, descriptions
  - `product_location_stock` – per-location stock tracking
  - `product_images` – ecommerce/magazine visuals
- Multi-view layout (cards, list, table)
- Filtering by tags, suppliers, location, price, availability
- Real-time stock display and quantity corrections
- Full CRUD with dialogs
- Pagination and mobile-friendly design

#### Locations Management

- Hierarchical location tree (3 levels)
- Each location with icon name + HEX color
- QR code generation
- Mobile version of tree
- Soft delete with `deleted_at` support

#### Audits System

- Audit scheduler (e.g. weekly)
- Historical audit logs with discrepancy metrics
- Interactive audit flow with step-by-step modal
- Stock correction during audit
- Trigger points in tree and details view

#### Labels & Templates

- Label generator for products and locations
- Templates manager

#### Suppliers

- Supplier CRUD
- Incoming deliveries management

#### Stock Movements & Transfers

- SAP-style movement type system with numeric codes (101-613)
- 31 pre-configured movement types across 6 categories:
  - Receipts (101-105): Purchase orders, returns, production output
  - Issues (201-206): Sales, returns to supplier, waste/damage
  - Transfers (301-312): Intra-location and inter-branch transfers
  - Adjustments (401-411): Inventory corrections, quality reclassification
  - Reservations (501-502): Stock reservation management
  - E-commerce (601-613): Shopify, WooCommerce, Allegro integration
- Polish warehouse compliance with document types (PZ, WZ, MM, RW, KP, KN, INW)
- Bilingual support (Polish/English)
- Movement approval workflow with pending/approved/completed/cancelled/reversed statuses
- Real-time stock inventory calculations via database views
- Stock reservations for sales orders and allocations
- Comprehensive validation service for business rules
- Movement history tracking with audit trail
- Soft delete architecture for complete audit trail

**Pages**:

- `/dashboard/warehouse/movements` - Main movements list with filtering
- `/dashboard/warehouse/movements/new` - Create new movement
- `/dashboard/warehouse/movements/[id]` - Movement details and approval
- `/dashboard/warehouse/inventory` - Real-time inventory dashboard

**Components**:

- Movement status badges, cards, and filters
- Stock level display with visual indicators
- Approval queue for pending movements
- Movement history timeline
- Create movement dialog

**Technical Architecture**:

- Database migrations with idempotent DO blocks for upgrades
- TypeScript service layer with full type safety
- Server actions for authentication and authorization
- React Hook Form for validated data entry
- Comprehensive filter and search capabilities

#### B2B Katalog (Business Clients)

- Supplier:
  - Own admin panel
  - Invite clients (manual invites)
  - Public/private catalogs
  - Client-specific pricing/rates
  - View and process orders from clients
- Client:
  - Invite-only access
  - Can be linked to many suppliers
  - See supplier-specific catalog
  - Place orders based on their warehouse stock

> This replaces traditional B2B with spreadsheets and paper workflows.

### 3. Teams Module (`/dashboard/teams/*`)

**Purpose**: Team collaboration and communication  
**Color Theme**: `#8b5cf6` (purple)  
**Features**:

- Member management
- Chat, announcements
- Kanban board
- Shared calendar

### 4. Organization Management Module (`/dashboard/organization/*`)

**Purpose**: Administrative control for organization and branches  
**Color Theme**: `#6366f1` (indigo)  
**Features**:

- Org profile (logo, description, slug)
- Branches list and CRUD
- User roles and permissions

### 5. Support Module (`/dashboard/support/*`)

**Purpose**: Help and feedback  
**Features**:

- Help Center and FAQ
- Contact Support system
- Announcements, changelog, roadmap
- System status monitoring

## Module Architecture Details

### Dynamic Module Loading

- Modules loaded via `getAllModules(activeOrgId)`
- Widget aggregation via `getAllWidgets()`
- Based on `userModules[]` and organization context

### Widget System

- Modules define widgets for dashboard (charts, stats, quick links)
- Example: warehouse product summary, audit reminder, B2B order alerts

### Role-Based Access

- Menu items define `allowedUsers` with `role` + `scope`
- Dynamic RBAC via `HasAnyRole*` components
- Scopes: branch, organization

### Internationalization in Modules

- Full i18n in Polish (default) and English
- Localized routing and translations
- All modules support message files and i18n-compatible strings
