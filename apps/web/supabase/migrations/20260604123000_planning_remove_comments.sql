-- ===========================================================================
-- Planning: remove premature comments table
-- ===========================================================================
--
-- Planning task comments are intentionally out of scope for the current tasks
-- feature. The table was created early by mistake and has no production data.

DROP TABLE IF EXISTS public.planning_task_comments CASCADE;
