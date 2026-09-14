# Zone 5 Phase-10 Attribution Integration — Changed Files

Baseline: commit `e604d6e4` (Zone 5 live/MCP verification pass). This bundle covers ONLY the
Phase-10 business-attribution-writer overlap resolution — nothing else.

## New files

- `apps/web/supabase-target/supabase/migrations/20260914130000_zone5_receive_repair_order_stock_use_canonical_attach.sql`
  — forward migration (the already-live `receive_repair_order_stock` is not edited in place).
  Replaces the direct `INSERT INTO repair_order_line_movement_links` with
  `PERFORM public.attach_repair_order_line_movement(...)`. Signature unchanged.

## Modified files

- `apps/web/src/app/actions/warehouse/repair-order-receiving.ts` — added one new allowlist entry
  to `RECEIVE_RPC_KNOWN_ERRORS` (the canonical attach RPC's applied-quantity-cap message, the one
  new error this integration can surface, on a genuine idempotent retry). Updated the file's own
  header comment (no longer says "not applied to any live database" — now accurate).
- `apps/web/supabase/tests/096_zone5_receive_repair_order_stock_test.sql` — plan grown from 13 to 21. Added 8 new assertions (8a-8d: idempotent-retry-of-an-attributed-receipt behavior, proven
  atomic; 9a-9d: multi-line same-call independence, two different RepairOrderLines attributed via
  two different Matcher lines in one call). All 13 pre-existing assertions unchanged and re-run
  passing (no regression).
- `docs/mvp/zones/05-receiving-putaway-progress.md` — new "Phase-10 attribution integration pass"
  section; updated header banner; updated "Remaining work" #2 with the explicit remaining
  browser/UAT checklist.

## NOT touched (explicit scope boundary, per the mandate)

- `apps/web/supabase-target/supabase/migrations/20260912094000_zone5_putaway_repair_order_stock_rpc.sql`
  (`putaway_repair_order_stock`) — confirmed live to have no `repair_order_line_movement_links`
  write at all (only an explanatory comment saying so); no Phase-10 overlap exists for it.
- `apps/web/supabase/tests/097_zone5_putaway_repair_order_stock_test.sql` — not re-run this pass
  (nothing about putaway changed; confirmed via live function-definition inspection instead).
- The attribution-sync trigger (`repair_order_location_attribution_sync`) — confirmed live,
  byte-for-byte unchanged. Spatial attribution, UNKNOWN semantics, the bypass flag, zero-clear
  behavior, and putaway's own lock order are all frozen, exactly as directed.
- Zone 3 Phase 10's own files (`20260912162802_repair_order_line_movement_attach_rpc.sql`,
  `20260912162827_..._revoke_anon.sql`, `20260914052934_..._close_direct_insert.sql`,
  `097_repair_order_line_movement_attach_phase10_test.sql`) — these live on the `mvp-readiness`
  branch, not this one. Read via `git show` for reference and to re-run the pgTAP file's SQL
  directly against the live DB; **no branch merge was performed**.
- Phase 10A/10B/10C, DataView, Zone 6, container work — untouched, per the mandate's explicit
  scope boundary. Container-related migrations (`inventory_add_to_container_rpc`,
  `inventory_remove_from_container_rpc` (+fix), `inventory_seal_container_rpc`) were observed live
  on the shared target project (landing from elsewhere, between this pass's own migrations) but
  not acted on in any way.
