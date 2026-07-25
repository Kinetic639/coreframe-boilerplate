-- Fix regression introduced by Gap #6 fix (20260227200000):
-- invitations_update_self_accept was missing, blocking invitation acceptance at DB level.
--
-- invitations_update_self_cancel (added in Gap #6 fix) requires status='cancelled'.
-- That correctly blocks the exploit (role_id pivot while keeping status='pending').
-- But it also blocked status='accepted' writes, breaking the invite acceptance flow.
--
-- This policy restores acceptance for the invitee (email-match) with two restrictions:
--   1. status must be 'accepted' in the new row (blocks keeping status='pending')
--   2. accepted_at must be non-null (enforces timestamp requirement, consistent with app)
--
-- The Gap #6 security property is preserved:
--   - Invitees still cannot write status='pending' (no policy permits it for email-match)
--   - role_id/branch_id pivot while pending remains blocked

CREATE POLICY invitations_update_self_accept
ON public.invitations FOR UPDATE
USING (
  lower(email) = lower(COALESCE(auth.jwt()->>'email', ''))
  AND deleted_at IS NULL
)
WITH CHECK (
  lower(email) = lower(COALESCE(auth.jwt()->>'email', ''))
  AND status = 'accepted'
  AND accepted_at IS NOT NULL
  AND deleted_at IS NULL
);
