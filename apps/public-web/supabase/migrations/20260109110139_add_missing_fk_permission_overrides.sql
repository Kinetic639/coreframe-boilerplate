-- Add missing foreign key constraint for user_permission_overrides.permission_id
-- This constraint was missing and could lead to orphaned override records

-- Add the foreign key constraint
ALTER TABLE public.user_permission_overrides
ADD CONSTRAINT user_permission_overrides_permission_id_fkey
FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
ON DELETE RESTRICT;

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT user_permission_overrides_permission_id_fkey
ON public.user_permission_overrides
IS 'Ensures permission_id references a valid permission. RESTRICT prevents deletion of permissions that have overrides.';
