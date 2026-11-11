-- IC-5: putaway (a relocation of ALREADY-known RepairOrder stock between
-- locations) was previously invisible to canonical business-attribution
-- history entirely -- live-caught while proving rebuild-equals-
-- incremental: a full rebuild after a real receipt+putaway sequence
-- double-counted the receipt (since putaway's own physical move was
-- recorded ONLY as a direct repair_order_line_locations write, never in
-- repair_order_line_movement_links), because there was no canonical
-- record of "this line's own stock physically moved from A to B" for the
-- rebuild to replay. A relocation is still a real, attributable physical
-- event -- it needed its own relation_type, not reuse of 'receipt'/
-- 'issue' (which attach_repair_order_line_movement's own category-match
-- validation, correctly, restricts to receipt/issue-category movements).
ALTER TABLE public.repair_order_line_movement_links
  DROP CONSTRAINT repair_order_line_movement_links_relation_type_check;
ALTER TABLE public.repair_order_line_movement_links
  ADD CONSTRAINT repair_order_line_movement_links_relation_type_check
  CHECK (relation_type = ANY (ARRAY['receipt'::text, 'issue'::text, 'reversal'::text, 'relocation'::text]));
