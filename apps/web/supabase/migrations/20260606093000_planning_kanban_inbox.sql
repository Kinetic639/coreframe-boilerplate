ALTER TABLE public.planning_kanban_cards
  ADD COLUMN IF NOT EXISTS is_inbox BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS planning_kanban_cards_inbox_idx
  ON public.planning_kanban_cards (organization_id, is_inbox, updated_at DESC)
  WHERE deleted_at IS NULL;
