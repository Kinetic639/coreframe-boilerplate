-- Add foreign key constraint for invitations.role_id to roles.id
-- This is required for Supabase queries to join invitations with roles

ALTER TABLE invitations 
ADD CONSTRAINT invitations_role_id_fkey 
FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_invitations_role_id ON invitations(role_id) WHERE deleted_at IS NULL;