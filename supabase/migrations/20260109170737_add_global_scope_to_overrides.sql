-- Add 'global' scope support to user_permission_overrides
-- This allows system-wide permission overrides that apply across all orgs/branches

-- Drop existing constraint
ALTER TABLE public.user_permission_overrides
DROP CONSTRAINT IF EXISTS user_permission_overrides_scope_check;

-- Add new constraint with 'global' scope included
ALTER TABLE public.user_permission_overrides
ADD CONSTRAINT user_permission_overrides_scope_check
CHECK (scope IN ('global', 'org', 'branch'));

-- Add comment explaining global scope
COMMENT ON CONSTRAINT user_permission_overrides_scope_check
ON public.user_permission_overrides
IS 'Scope can be global (system-wide), org (organization), or branch (branch-specific). Global overrides have lowest precedence.';

-- Note: For global scope, scope_id should be NULL (no specific org/branch)
-- Future enhancement: could add constraint to enforce scope_id IS NULL when scope = 'global'
