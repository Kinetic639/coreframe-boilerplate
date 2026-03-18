-- =============================================
-- Migration: Add inventory management system (movement-based)
-- Implements movement-based stock tracking like Shopify/Amazon
-- =============================================

-- Movement Types: Define types of inventory movements
CREATE TABLE movement_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  affects_stock INTEGER NOT NULL CHECK (affects_stock IN (-1, 0, 1)), -- -1 decrease, 0 neutral, 1 increase
  requires_approval BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Insert system movement types
INSERT INTO movement_types (code, name, description, affects_stock, is_system) VALUES
  ('initial', 'Initial Stock', 'Initial stock entry', 1, true),
  ('purchase', 'Purchase', 'Stock received from supplier', 1, true),
  ('sale', 'Sale', 'Stock sold to customer', -1, true),
  ('adjustment_positive', 'Positive Adjustment', 'Manual stock increase', 1, true),
  ('adjustment_negative', 'Negative Adjustment', 'Manual stock decrease', -1, true),
  ('damaged', 'Damaged/Lost', 'Stock marked as damaged or lost', -1, true),
  ('transfer_out', 'Transfer Out', 'Stock transferred to another location', -1, true),
  ('transfer_in', 'Transfer In', 'Stock received from another location', 1, true),
  ('return_customer', 'Customer Return', 'Stock returned by customer', 1, true),
  ('return_supplier', 'Supplier Return', 'Stock returned to supplier', -1, true),
  ('production_consume', 'Production Consumed', 'Stock used in production', -1, true),
  ('production_output', 'Production Output', 'Stock produced from manufacturing', 1, true),
  ('reservation', 'Reservation', 'Stock reserved for order', 0, true),
  ('reservation_release', 'Reservation Released', 'Stock reservation released', 0, true),
  ('audit_adjustment', 'Audit Adjustment', 'Stock correction from audit', 0, true);

-- Stock Movements: Core movement tracking table
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  location_id UUID NOT NULL REFERENCES locations(id),

  -- Product reference
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),

  -- Movement details
  movement_type_code TEXT NOT NULL REFERENCES movement_types(code),
  quantity NUMERIC NOT NULL CHECK (quantity != 0),
  unit_cost NUMERIC,
  total_cost NUMERIC,
  currency TEXT DEFAULT 'USD',

  -- References
  reference_type TEXT, -- 'order', 'transfer', 'adjustment', 'audit', etc.
  reference_id UUID,

  -- User and approval
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  -- Tracking
  batch_number TEXT,
  serial_number TEXT,
  expiry_date DATE
);

-- Stock Reservations: Track committed but not yet fulfilled stock
CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  location_id UUID NOT NULL REFERENCES locations(id),

  -- Product reference
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),

  -- Reservation details
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  reserved_for TEXT NOT NULL, -- 'order', 'transfer', 'production', etc.
  reference_id UUID,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')),
  priority INTEGER DEFAULT 0, -- Higher priority reservations are fulfilled first

  -- User tracking
  created_by UUID REFERENCES users(id),
  fulfilled_by UUID REFERENCES users(id),

  -- Timestamps
  expires_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Stock Snapshot: Materialized view for current stock levels
CREATE TABLE stock_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  location_id UUID NOT NULL REFERENCES locations(id),

  -- Product reference
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),

  -- Stock levels
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC NOT NULL DEFAULT 0,
  quantity_available NUMERIC GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,

  -- Value tracking
  average_cost NUMERIC,
  total_value NUMERIC,

  -- Last movement
  last_movement_id UUID REFERENCES stock_movements(id),
  last_movement_at TIMESTAMPTZ,

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),

  UNIQUE(organization_id, branch_id, location_id, product_id, variant_id)
);

-- Transfer Requests: Inter-branch stock transfers
CREATE TABLE transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Source and destination
  from_branch_id UUID NOT NULL REFERENCES branches(id),
  to_branch_id UUID NOT NULL REFERENCES branches(id),
  from_location_id UUID NOT NULL REFERENCES locations(id),
  to_location_id UUID NOT NULL REFERENCES locations(id),

  -- Request details
  request_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_transit', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Users
  requested_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  shipped_by UUID REFERENCES users(id),
  received_by UUID REFERENCES users(id),

  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  approved_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  expected_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,

  -- Details
  notes TEXT,
  tracking_number TEXT,
  shipping_method TEXT,
  metadata JSONB DEFAULT '{}',

  UNIQUE(organization_id, request_number)
);

-- Transfer Request Items: Items in transfer requests
CREATE TABLE transfer_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_request_id UUID NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,

  -- Product reference
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),

  -- Quantities
  requested_quantity NUMERIC NOT NULL CHECK (requested_quantity > 0),
  approved_quantity NUMERIC,
  shipped_quantity NUMERIC,
  received_quantity NUMERIC,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'shipped', 'received', 'cancelled')),

  -- Metadata
  notes TEXT,
  unit_cost NUMERIC,

  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Create indexes for performance
CREATE INDEX idx_stock_movements_org_branch ON stock_movements(organization_id, branch_id);
CREATE INDEX idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX idx_stock_movements_product_variant ON stock_movements(product_id, variant_id);
CREATE INDEX idx_stock_movements_occurred_at ON stock_movements(occurred_at);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type_code);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

CREATE INDEX idx_stock_reservations_org_branch ON stock_reservations(organization_id, branch_id);
CREATE INDEX idx_stock_reservations_location ON stock_reservations(location_id);
CREATE INDEX idx_stock_reservations_product_variant ON stock_reservations(product_id, variant_id);
CREATE INDEX idx_stock_reservations_status ON stock_reservations(status);
CREATE INDEX idx_stock_reservations_expires ON stock_reservations(expires_at) WHERE status = 'active';

CREATE INDEX idx_stock_snapshots_org_branch_location ON stock_snapshots(organization_id, branch_id, location_id);
CREATE INDEX idx_stock_snapshots_product_variant ON stock_snapshots(product_id, variant_id);
CREATE INDEX idx_stock_snapshots_quantity_available ON stock_snapshots(quantity_available);

CREATE INDEX idx_transfer_requests_org_status ON transfer_requests(organization_id, status);
CREATE INDEX idx_transfer_requests_branches ON transfer_requests(from_branch_id, to_branch_id);
CREATE INDEX idx_transfer_requests_requested_at ON transfer_requests(requested_at);

CREATE INDEX idx_transfer_request_items_transfer ON transfer_request_items(transfer_request_id);
CREATE INDEX idx_transfer_request_items_product_variant ON transfer_request_items(product_id, variant_id);

-- Create functions for stock calculations

-- Calculate current stock for a variant at a location
CREATE OR REPLACE FUNCTION calculate_current_stock(
  p_organization_id UUID,
  p_branch_id UUID,
  p_location_id UUID,
  p_product_id UUID,
  p_variant_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_stock NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(
    quantity * mt.affects_stock
  ), 0) INTO total_stock
  FROM stock_movements sm
  JOIN movement_types mt ON sm.movement_type_code = mt.code
  WHERE sm.organization_id = p_organization_id
    AND sm.branch_id = p_branch_id
    AND sm.location_id = p_location_id
    AND sm.product_id = p_product_id
    AND sm.variant_id = p_variant_id;

  RETURN total_stock;
END;
$$;

-- Calculate reserved stock for a variant at a location
CREATE OR REPLACE FUNCTION calculate_reserved_stock(
  p_organization_id UUID,
  p_branch_id UUID,
  p_location_id UUID,
  p_product_id UUID,
  p_variant_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_reserved NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO total_reserved
  FROM stock_reservations
  WHERE organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND location_id = p_location_id
    AND product_id = p_product_id
    AND variant_id = p_variant_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > timezone('utc', now()));

  RETURN total_reserved;
END;
$$;

-- Refresh stock snapshot for a specific variant/location
CREATE OR REPLACE FUNCTION refresh_stock_snapshot(
  p_organization_id UUID,
  p_branch_id UUID,
  p_location_id UUID,
  p_product_id UUID,
  p_variant_id UUID
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  qty_on_hand NUMERIC;
  qty_reserved NUMERIC;
  last_mov_id UUID;
  last_mov_at TIMESTAMPTZ;
BEGIN
  -- Calculate current stock
  qty_on_hand := calculate_current_stock(p_organization_id, p_branch_id, p_location_id, p_product_id, p_variant_id);
  qty_reserved := calculate_reserved_stock(p_organization_id, p_branch_id, p_location_id, p_product_id, p_variant_id);

  -- Get last movement info
  SELECT id, occurred_at INTO last_mov_id, last_mov_at
  FROM stock_movements
  WHERE organization_id = p_organization_id
    AND branch_id = p_branch_id
    AND location_id = p_location_id
    AND product_id = p_product_id
    AND variant_id = p_variant_id
  ORDER BY occurred_at DESC, created_at DESC
  LIMIT 1;

  -- Upsert snapshot
  INSERT INTO stock_snapshots (
    organization_id, branch_id, location_id, product_id, variant_id,
    quantity_on_hand, quantity_reserved, last_movement_id, last_movement_at, updated_at
  ) VALUES (
    p_organization_id, p_branch_id, p_location_id, p_product_id, p_variant_id,
    qty_on_hand, qty_reserved, last_mov_id, last_mov_at, timezone('utc', now())
  )
  ON CONFLICT (organization_id, branch_id, location_id, product_id, variant_id)
  DO UPDATE SET
    quantity_on_hand = EXCLUDED.quantity_on_hand,
    quantity_reserved = EXCLUDED.quantity_reserved,
    last_movement_id = EXCLUDED.last_movement_id,
    last_movement_at = EXCLUDED.last_movement_at,
    updated_at = timezone('utc', now());
END;
$$;

-- Create triggers to auto-refresh snapshots
CREATE OR REPLACE FUNCTION trigger_refresh_stock_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_stock_snapshot(OLD.organization_id, OLD.branch_id, OLD.location_id, OLD.product_id, OLD.variant_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_stock_snapshot(NEW.organization_id, NEW.branch_id, NEW.location_id, NEW.product_id, NEW.variant_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_snapshot_on_movement
  AFTER INSERT OR UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_stock_snapshot();

CREATE TRIGGER refresh_snapshot_on_reservation
  AFTER INSERT OR UPDATE OR DELETE ON stock_reservations
  FOR EACH ROW EXECUTE FUNCTION trigger_refresh_stock_snapshot();

-- Add updated_at triggers
CREATE TRIGGER update_stock_reservations_updated_at BEFORE UPDATE ON stock_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();