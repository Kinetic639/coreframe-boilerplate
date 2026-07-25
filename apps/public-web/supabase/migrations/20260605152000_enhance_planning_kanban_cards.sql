-- ===========================================================================
-- Planning Kanban Card Enhancements
-- ===========================================================================

ALTER TABLE public.planning_kanban_cards
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label TEXT CHECK (label IS NULL OR char_length(label) <= 80),
  ADD COLUMN IF NOT EXISTS label_color TEXT CHECK (label_color IS NULL OR label_color ~ '^#[0-9a-fA-F]{6}$');

CREATE INDEX IF NOT EXISTS planning_kanban_cards_due_idx
  ON public.planning_kanban_cards (board_id, due_at)
  WHERE deleted_at IS NULL AND due_at IS NOT NULL;
