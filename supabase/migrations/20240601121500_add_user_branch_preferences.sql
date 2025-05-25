-- =============================================
-- Add default_branch_id to users and user_preferences table
-- =============================================

-- 1. Add default_branch_id to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS default_branch_id UUID REFERENCES branches(id);

-- 2. Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  last_branch_id UUID REFERENCES branches(id),
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id)
); 