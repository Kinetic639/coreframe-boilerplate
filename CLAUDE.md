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

## Supabase Commands

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

## Implemented Modules

### 1. Home Module (`/dashboard/start`)

**Purpose**: Dashboard home page with news and announcements
**Features**:

- News feed display (`/dashboard/start`)
- Add news functionality (role-restricted to `branch_admin`)
- Quick actions and announcements

### 2. Warehouse Module (`/dashboard/warehouse/*`)

**Purpose**: Complete warehouse management system
**Color Theme**: `#10b981` (green)
**Features**:

#### Products Management (`/dashboard/warehouse/products`)

- **Product Cards/List/Table Views**: Multi-view product display with grid, list, and table modes
- **Advanced Filtering**: Search, price range, supplier, location, tags, low stock filtering
- **Product Details**: SKU, EAN, variants, stock levels, purchase prices
- **Stock Management**: Real-time stock tracking across multiple locations
- **Amount Corrections**: Quick stock adjustment dialogs
- **CRUD Operations**: Add, edit, delete products with form dialogs
- **Pagination**: Server-side pagination with customizable items per page

#### Locations Management (`/dashboard/warehouse/locations`)

- **Hierarchical Location Tree**: Nested location structure management
- **Location CRUD**: Add, edit, delete warehouse locations
- **QR Code Generation**: Generate QR codes for locations
- **Mobile-responsive**: Separate mobile location tree component

#### Audits System (`/dashboard/warehouse/audits`)

- **Audit Overview**: Main audit dashboard
- **Audit Scheduling** (`/schedule`): Plan and schedule warehouse audits
- **Audit History** (`/history`): Historical audit records
- **Audit Process Dialogs**: Start, process, and complete audits
- **Quantity Corrections**: Handle stock discrepancies during audits

#### Labels & Templates (`/dashboard/warehouse/labels`)

- **Product Labels** (`/products`): Generate product labels
- **Location Labels** (`/locations`): Generate location labels
- **Label Templates** (`/templates`): Manage label templates

#### Suppliers Management (`/dashboard/warehouse/suppliers`)

- **Supplier List** (`/list`): Manage supplier information
- **Deliveries** (`/deliveries`): Track incoming deliveries

### 3. Teams Module (`/dashboard/teams/*`)

**Purpose**: Team collaboration and communication
**Color Theme**: `#8b5cf6` (purple)
**Features**:

- **Team Members** (`/members`): Manage team member profiles
- **Communication Hub** (`/communication`):
  - Team Chat (`/chat`): Internal team messaging
  - Announcements (`/announcements`): Team-wide notifications
- **Kanban Board** (`/kanban`): Task and project management
- **Team Calendar** (`/calendar`): Shared team scheduling

### 4. Organization Management Module (`/dashboard/organization/*`)

**Purpose**: Administrative panel for organization management
**Color Theme**: `#6366f1` (indigo)
**Features**:

- **Organization Profile** (`/profile`): Company profile management with logo upload
- **Branches Management** (`/branches`): Multi-branch organization support
- **User Management** (`/users`):
  - User List (`/list`): View and manage all users
  - Roles & Permissions (`/roles`): RBAC system management

### 5. Support Module (`/dashboard/support/*`)

**Purpose**: Help system and customer support
**Features**:

- **Help Center** (`/help`): Documentation and FAQ
- **Contact Support** (`/contact`): Support ticket system
- **Announcements** (`/announcements`):
  - Changelog (`/changelog`): System updates and changes
  - System Status (`/status`): Service status monitoring
  - Roadmap (`/roadmap`): Future development plans

## Module Architecture Details

### Dynamic Module Loading

- Modules are loaded dynamically based on organization context via `getAllModules(activeOrgId)`
- Each module defines widgets that appear on the dashboard home page
- Module configurations include permissions and role-based access control

### Widget System

- Modules can define dashboard widgets (charts, stats, quick actions)
- Widgets are aggregated via `getAllWidgets()` for dashboard display
- Example: Warehouse module includes product summary chart widget

### Role-Based Module Access

- Menu items can specify `allowedUsers` with role and scope restrictions
- Roles include: `branch_admin`, `org_admin`, etc.
- Scopes include: `branch`, `organization`

### Internationalization in Modules

- All module labels and content use Polish language
- Module titles and descriptions are localized
- Navigation menu items support i18n
