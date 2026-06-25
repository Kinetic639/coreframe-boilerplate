ALTER TABLE inventory_movement_headers
ADD COLUMN IF NOT EXISTS route_key TEXT;

UPDATE inventory_movement_headers
SET route_key = COALESCE(
  REPLACE(document_number, '/', '-'),
  draft_number
)
WHERE route_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_imh_route_key_org
ON inventory_movement_headers (organization_id, route_key)
WHERE route_key IS NOT NULL AND deleted_at IS NULL;
