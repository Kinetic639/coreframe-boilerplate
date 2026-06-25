ALTER TABLE inventory_movement_headers
ADD COLUMN IF NOT EXISTS counterparty_details JSONB DEFAULT NULL;

COMMENT ON COLUMN inventory_movement_headers.counterparty_details IS 'Full counterparty details object: {name, nip, phone, street, postalCode, city}';
