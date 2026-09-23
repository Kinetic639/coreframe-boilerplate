-- IC-5 CORRECTION PASS -- companion to the internal writer's new
-- p_require_posted parameter: the reversal-mirror call site is the ONE
-- caller that must pass false (see prior migration's own comment for
-- the full rationale -- this trigger fires before the reversal
-- movement's own header status flips to 'posted', a timing artifact,
-- not a business-meaningful draft state). No other logic changes.
CREATE OR REPLACE FUNCTION public.repair_order_location_attribution_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pre_effect_on_hand numeric;
  v_attributed_sum     numeric;
  v_distinct_lines     integer;
  v_dest               uuid;
  v_source             uuid;
  v_line_id            uuid;
  v_ro_id               uuid;
  v_source_was_unknown boolean;
  v_confident_known    boolean;
  v_is_reversal        boolean;
  v_original_line_id   uuid;
  v_orig_link          RECORD;
BEGIN
  IF NEW.balance_field IS DISTINCT FROM 'on_hand' THEN
    RETURN NULL;
  END IF;

  IF NEW.direction <> 'decrease' THEN
    RETURN NULL;
  END IF;

  SELECT (mh.original_movement_id IS NOT NULL) INTO v_is_reversal
  FROM public.inventory_movement_headers mh
  JOIN public.inventory_movement_lines nl ON nl.movement_id = mh.id
  WHERE nl.id = NEW.movement_line_id;

  IF v_is_reversal THEN
    SELECT ol.id INTO v_original_line_id
    FROM public.inventory_movement_lines nl
    JOIN public.inventory_movement_headers nh ON nh.id = nl.movement_id
    JOIN public.inventory_movement_lines ol
      ON ol.movement_id = nh.original_movement_id AND ol.line_number = nl.line_number
    WHERE nl.id = NEW.movement_line_id;

    IF v_original_line_id IS NOT NULL THEN
      FOR v_orig_link IN
        SELECT * FROM public.repair_order_line_movement_links
        WHERE inventory_movement_line_id = v_original_line_id
          AND relation_type IN ('receipt', 'issue', 'relocation')
      LOOP
        BEGIN
          PERFORM public.write_repair_order_line_movement_link_internal(
            v_orig_link.repair_order_line_id, NEW.movement_line_id, v_orig_link.applied_quantity, 'reversal',
            false
          );
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END LOOP;
    END IF;

    SELECT source_location_id, destination_location_id INTO v_source, v_dest
    FROM public.inventory_movement_lines
    WHERE id = NEW.movement_line_id;

    IF v_source IS NOT NULL THEN
      PERFORM public.rebuild_repair_order_projection_bucket_internal(
        NEW.organization_id, NEW.branch_id, v_source, NEW.variant_id
      );
    END IF;

    IF v_dest IS NOT NULL AND v_dest IS DISTINCT FROM v_source THEN
      PERFORM public.rebuild_repair_order_projection_bucket_internal(
        NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id
      );
    END IF;

    RETURN NULL;
  END IF;

  IF current_setting('ambra.repair_order_attribution_authoritative', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.repair_order_line_locations
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.repair_order_location_attribution_uncertain
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT destination_location_id INTO v_dest
  FROM public.inventory_movement_lines
  WHERE id = NEW.movement_line_id;

  SELECT EXISTS (
    SELECT 1 FROM public.repair_order_location_attribution_uncertain
    WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
      AND location_id = NEW.location_id AND variant_id = NEW.variant_id
    FOR UPDATE
  ) INTO v_source_was_unknown;

  v_confident_known := false;
  IF NOT v_source_was_unknown THEN
    v_pre_effect_on_hand := NEW.balance_after + NEW.quantity;

    WITH locked_rows AS (
      SELECT quantity, repair_order_line_id, repair_order_id
      FROM public.repair_order_line_locations
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id
      FOR UPDATE
    )
    SELECT sum(quantity), count(DISTINCT repair_order_line_id),
           max(repair_order_line_id::text)::uuid, max(repair_order_id::text)::uuid
      INTO v_attributed_sum, v_distinct_lines, v_line_id, v_ro_id
      FROM locked_rows;

    v_confident_known := (v_attributed_sum IS NOT DISTINCT FROM v_pre_effect_on_hand) AND v_distinct_lines = 1;
  END IF;

  IF NEW.balance_after = 0 THEN
    DELETE FROM public.repair_order_line_locations
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id;

    DELETE FROM public.repair_order_location_attribution_uncertain
      WHERE organization_id = NEW.organization_id AND branch_id = NEW.branch_id
        AND location_id = NEW.location_id AND variant_id = NEW.variant_id;

    IF v_dest IS NOT NULL THEN
      IF v_confident_known THEN
        INSERT INTO public.repair_order_line_locations
          (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
        VALUES (NEW.organization_id, NEW.branch_id, v_ro_id, v_line_id, NEW.variant_id, v_dest, NEW.quantity)
        ON CONFLICT (repair_order_line_id, location_id)
        DO UPDATE SET quantity = public.repair_order_line_locations.quantity + NEW.quantity;
      ELSE
        INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
          VALUES (NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id)
          ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
      END IF;
    END IF;
    RETURN NULL;
  END IF;

  IF v_source_was_unknown THEN
    INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
      VALUES (NEW.organization_id, NEW.branch_id, NEW.location_id, NEW.variant_id)
      ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
    IF v_dest IS NOT NULL THEN
      INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
        VALUES (NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id)
        ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
    END IF;
    RETURN NULL;
  END IF;

  IF NOT v_confident_known THEN
    INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
      VALUES (NEW.organization_id, NEW.branch_id, NEW.location_id, NEW.variant_id)
      ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
    IF v_dest IS NOT NULL THEN
      INSERT INTO public.repair_order_location_attribution_uncertain (organization_id, branch_id, location_id, variant_id)
        VALUES (NEW.organization_id, NEW.branch_id, v_dest, NEW.variant_id)
        ON CONFLICT (organization_id, branch_id, location_id, variant_id) DO NOTHING;
    END IF;
    RETURN NULL;
  END IF;

  UPDATE public.repair_order_line_locations
    SET quantity = quantity - NEW.quantity
    WHERE repair_order_line_id = v_line_id AND location_id = NEW.location_id;

  IF v_dest IS NOT NULL THEN
    INSERT INTO public.repair_order_line_locations
      (organization_id, branch_id, repair_order_id, repair_order_line_id, variant_id, location_id, quantity)
    VALUES (NEW.organization_id, NEW.branch_id, v_ro_id, v_line_id, NEW.variant_id, v_dest, NEW.quantity)
    ON CONFLICT (repair_order_line_id, location_id)
    DO UPDATE SET quantity = public.repair_order_line_locations.quantity + NEW.quantity;
  END IF;

  RETURN NULL;
END;
$function$;
