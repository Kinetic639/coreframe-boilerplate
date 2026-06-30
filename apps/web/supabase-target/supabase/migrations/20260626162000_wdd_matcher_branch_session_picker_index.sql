-- Fast branch-scoped movement import picker for SVWMS WDD matcher sessions.

CREATE INDEX IF NOT EXISTS wdd_matcher_sessions_org_branch_status_created_idx
  ON public.wdd_matcher_sessions (organization_id, branch_id, status, created_at DESC)
  WHERE created_by IS NOT NULL;
