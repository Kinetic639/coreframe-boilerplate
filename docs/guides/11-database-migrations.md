# Database Migrations

## Overview

Database migrations track and version control your database schema changes. This guide covers creating and managing migrations using Supabase.

## Key Principles

1. **Never edit existing migrations**: Always create new migrations
2. **Idempotent operations**: Use `IF NOT EXISTS` for safe re-runs
3. **RLS policies**: Always include Row Level Security
4. **Timestamps**: Use consistent naming format
5. **Test migrations**: Apply locally before production
6. **Rollback plan**: Document how to undo changes

## Migration File Structure

```
supabase/migrations/
  ├── 20240101000000_initial_schema.sql
  ├── 20240102120000_add_products.sql
  ├── 20240103150000_add_product_indexes.sql
  └── 20240104090000_add_rls_policies.sql
```

**Naming**: `YYYYMMDDHHMMSS_description.sql`

## Creating a New Migration

### Step 1: Create Migration File

```bash
npm run supabase:migration:new -- create_tasks_table
```

This creates: `supabase/migrations/[timestamp]_create_tasks_table.sql`

### Step 2: Write Migration

**File**: `supabase/migrations/20240105120000_create_tasks_table.sql`

```sql
-- =============================================
-- Tasks Table Migration
-- =============================================

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'normal',

  -- Dates
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Assignment
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Additional fields
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_branch_id ON public.tasks(branch_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON public.tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;

-- Add updated_at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Users can view tasks in their organization
CREATE POLICY "Users can view organization tasks"
  ON public.tasks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

-- Users can create tasks in their organization
CREATE POLICY "Users can create tasks in their organization"
  ON public.tasks FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

-- Users can update tasks in their organization
CREATE POLICY "Users can update organization tasks"
  ON public.tasks FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );

-- Only creators or admins can delete tasks
CREATE POLICY "Users can delete own tasks or org admins can delete"
  ON public.tasks FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND organization_id = tasks.organization_id
      AND role IN ('org_owner', 'org_admin')
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;

-- Add comment
COMMENT ON TABLE public.tasks IS 'Tasks for project management';
```

### Step 3: Apply Migration

```bash
# Apply to local database
npm run supabase:migration:up

# Or apply to remote
npm run supabase:migration:up
```

### Step 4: Generate TypeScript Types

```bash
npm run supabase:gen:types
```

This updates `supabase/types/types.ts` with new table types.

## Common Migration Patterns

### Adding a Column

```sql
-- Add new column to existing table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_hours INTEGER;

-- Add with default value
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add with constraint
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority_score INTEGER,
  ADD CONSTRAINT valid_priority_score CHECK (priority_score BETWEEN 1 AND 10);
```

### Modifying a Column

```sql
-- Change column type
ALTER TABLE public.tasks
  ALTER COLUMN description TYPE TEXT;

-- Change column default
ALTER TABLE public.tasks
  ALTER COLUMN status SET DEFAULT 'pending';

-- Make column nullable
ALTER TABLE public.tasks
  ALTER COLUMN branch_id DROP NOT NULL;

-- Make column required
ALTER TABLE public.tasks
  ALTER COLUMN title SET NOT NULL;
```

### Dropping a Column

```sql
-- Drop column (use cautiously!)
ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS old_field CASCADE;
```

### Adding Indexes

```sql
-- Simple index
CREATE INDEX IF NOT EXISTS idx_tasks_created_at
  ON public.tasks(created_at);

-- Composite index
CREATE INDEX IF NOT EXISTS idx_tasks_org_status
  ON public.tasks(organization_id, status);

-- Partial index
CREATE INDEX IF NOT EXISTS idx_tasks_incomplete
  ON public.tasks(organization_id)
  WHERE status != 'done' AND deleted_at IS NULL;

-- GIN index for array/JSONB
CREATE INDEX IF NOT EXISTS idx_tasks_tags
  ON public.tasks USING GIN(tags);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_tasks_search
  ON public.tasks USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

### Creating Foreign Keys

```sql
-- Add foreign key
ALTER TABLE public.tasks
  ADD CONSTRAINT fk_tasks_project
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;

-- Add foreign key with different actions
ALTER TABLE public.tasks
  ADD CONSTRAINT fk_tasks_assignee
  FOREIGN KEY (assigned_to)
  REFERENCES auth.users(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
```

### Creating Functions

```sql
-- Create utility function
CREATE OR REPLACE FUNCTION public.get_overdue_tasks(org_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  due_date TIMESTAMPTZ,
  days_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.due_date,
    EXTRACT(DAY FROM NOW() - t.due_date)::INTEGER as days_overdue
  FROM public.tasks t
  WHERE t.organization_id = org_id
    AND t.due_date < NOW()
    AND t.status != 'done'
    AND t.deleted_at IS NULL
  ORDER BY t.due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_overdue_tasks TO authenticated;
```

### Creating Triggers

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification when task is assigned
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      reference_id,
      organization_id
    ) VALUES (
      NEW.assigned_to,
      'task_assigned',
      'Task Assigned',
      'You have been assigned to: ' || NEW.title,
      NEW.id,
      NEW.organization_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER trigger_task_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();
```

### Creating Views

```sql
-- Create view for active tasks
CREATE OR REPLACE VIEW public.active_tasks AS
SELECT
  t.*,
  u.email as assignee_email,
  u.first_name as assignee_first_name,
  u.last_name as assignee_last_name
FROM public.tasks t
LEFT JOIN auth.users u ON t.assigned_to = u.id
WHERE t.status != 'done'
  AND t.deleted_at IS NULL;

-- Grant select permission
GRANT SELECT ON public.active_tasks TO authenticated;
```

### Adding RLS Policies

```sql
-- Add new policy
CREATE POLICY "Branch users can view branch tasks"
  ON public.tasks FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM public.user_branches
      WHERE user_id = auth.uid()
    )
  );

-- Update existing policy (drop and recreate)
DROP POLICY IF EXISTS "Users can view organization tasks" ON public.tasks;

CREATE POLICY "Users can view organization tasks"
  ON public.tasks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_roles
      WHERE user_id = auth.uid()
    )
  );
```

## Data Migrations

### Backfilling Data

```sql
-- Add new column and backfill data
DO $$
BEGIN
  -- Add column
  ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS priority_score INTEGER;

  -- Backfill based on existing priority
  UPDATE public.tasks
  SET priority_score = CASE
    WHEN priority = 'low' THEN 1
    WHEN priority = 'normal' THEN 5
    WHEN priority = 'high' THEN 8
    WHEN priority = 'urgent' THEN 10
    ELSE 5
  END
  WHERE priority_score IS NULL;

  -- Make column required after backfill
  ALTER TABLE public.tasks
    ALTER COLUMN priority_score SET NOT NULL;
END $$;
```

### Copying Data Between Tables

```sql
-- Copy data from old table to new table
INSERT INTO public.tasks_v2 (
  id,
  organization_id,
  title,
  description,
  created_at
)
SELECT
  id,
  organization_id,
  title,
  description,
  created_at
FROM public.tasks
ON CONFLICT (id) DO NOTHING;
```

## Migration Best Practices

### 1. Use Transactions for Complex Migrations

```sql
BEGIN;

-- Multiple operations
ALTER TABLE public.tasks ADD COLUMN new_field TEXT;
UPDATE public.tasks SET new_field = 'default_value';
ALTER TABLE public.tasks ALTER COLUMN new_field SET NOT NULL;

COMMIT;
```

### 2. Handle Existing Data

```sql
-- Check if data exists before migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tasks WHERE status IS NULL) THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: NULL values exist';
  END IF;

  ALTER TABLE public.tasks
    ALTER COLUMN status SET NOT NULL;
END $$;
```

### 3. Idempotent Migrations

```sql
-- Use IF NOT EXISTS/IF EXISTS for safety
CREATE TABLE IF NOT EXISTS public.tasks (...);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.tasks(organization_id);
DROP TABLE IF EXISTS public.old_tasks CASCADE;

-- Check before dropping
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'old_field'
  ) THEN
    ALTER TABLE public.tasks DROP COLUMN old_field;
  END IF;
END $$;
```

### 4. Document Complex Migrations

```sql
-- =============================================
-- Migration: Normalize task tags
-- Author: Developer Name
-- Date: 2024-01-05
-- Description:
--   - Creates task_tags table
--   - Migrates array tags to junction table
--   - Drops old tags column
-- Rollback:
--   - Run rollback migration to restore tags array
-- =============================================

-- Implementation...
```

## Testing Migrations

### 1. Test Locally First

```bash
# Reset local database
npm run supabase:db:reset

# Apply migrations
npm run supabase:migration:up

# Verify tables created
npm run supabase:db:query -- "SELECT * FROM information_schema.tables WHERE table_schema = 'public'"

# Test data insertion
npm run supabase:db:query -- "INSERT INTO public.tasks (organization_id, title, created_by) VALUES ('...', 'Test', '...')"
```

### 2. Check Migration Status

```bash
# List applied migrations
npm run supabase:migration:list
```

### 3. Verify RLS Policies

```sql
-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tasks';

-- Test policy as user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'user-uuid';
SELECT * FROM public.tasks; -- Should respect RLS
```

## Rollback Strategy

### Create Rollback Migration

```sql
-- Migration: 20240105120000_create_tasks_table.sql
CREATE TABLE public.tasks (...);

-- Rollback: 20240105130000_rollback_tasks_table.sql
DROP TABLE IF EXISTS public.tasks CASCADE;
```

### Reversible Migrations

```sql
-- Use DO blocks for conditional rollback
DO $$
BEGIN
  -- Forward migration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'tasks'
  ) THEN
    CREATE TABLE public.tasks (...);
  END IF;
END $$;

-- To rollback: manually drop or create reverse migration
```

## Common Issues

### Issue 1: Migration Fails Midway

**Solution**: Wrap in transaction

```sql
BEGIN;
-- migrations
COMMIT;
-- or ROLLBACK on error
```

### Issue 2: Type Generation Out of Sync

**Solution**: Always regenerate after migration

```bash
npm run supabase:migration:up
npm run supabase:gen:types
```

### Issue 3: RLS Blocking Queries

**Solution**: Check policies and test with specific user context

```sql
-- Test as specific user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'user-id';
```

## Next Steps

- [Creating Service](./04-creating-service.md) - Use new tables in services
- [Security Patterns](./13-security-patterns.md) - Advanced RLS patterns
- [Troubleshooting](./17-troubleshooting.md) - Debug migration issues
