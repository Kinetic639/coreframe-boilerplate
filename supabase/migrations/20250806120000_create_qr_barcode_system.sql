-- =============================================
-- Migration: QR/Barcode System Implementation
-- Creates all tables for comprehensive QR code and barcode scanning system
-- =============================================

-- QR/Barcode Labels (can be pre-generated and unassigned)
CREATE TABLE qr_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_token TEXT UNIQUE NOT NULL,           -- Unique QR identifier
    label_type TEXT NOT NULL CHECK (label_type IN ('location', 'product', 'asset', 'generic')),
    label_template_id UUID,                  -- References label_templates(id) - will add FK later
    entity_type TEXT CHECK (entity_type IN ('location', 'product')),
    entity_id UUID,                          -- References locations.id or products.id
    assigned_at TIMESTAMPTZ,                 -- When label was assigned
    printed_at TIMESTAMPTZ,                  -- When label was printed
    is_printed BOOLEAN DEFAULT false,
    print_count INTEGER DEFAULT 0,           -- Track how many times printed
    created_by UUID REFERENCES users(id),
    assigned_by UUID REFERENCES users(id),   -- Who assigned the label
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',             -- Additional label data
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

-- Label Templates (different sizes, styles, positions)
CREATE TABLE label_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    label_type TEXT NOT NULL CHECK (label_type IN ('location', 'product', 'generic')),
    category TEXT CHECK (category IN ('small', 'medium', 'large', 'custom')),
    
    -- Physical dimensions
    width_mm NUMERIC NOT NULL,               -- Physical width in mm
    height_mm NUMERIC NOT NULL,              -- Physical height in mm
    dpi INTEGER DEFAULT 300,                 -- Print resolution
    
    -- Template configuration
    template_config JSONB NOT NULL DEFAULT '{}', -- Complete template configuration
    qr_position TEXT DEFAULT 'center' CHECK (qr_position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
    qr_size_mm NUMERIC DEFAULT 15,          -- QR code size in mm
    
    -- Label text options
    show_label_text BOOLEAN DEFAULT true,    -- Show location name/product name
    label_text_position TEXT DEFAULT 'bottom' CHECK (label_text_position IN ('top', 'bottom', 'left', 'right', 'none')),
    label_text_size INTEGER DEFAULT 12,      -- Font size for label text
    
    -- Additional elements
    show_code BOOLEAN DEFAULT false,         -- Show location code/product SKU
    show_hierarchy BOOLEAN DEFAULT false,    -- Show location hierarchy
    show_barcode BOOLEAN DEFAULT false,      -- Show product barcode (for products)
    
    -- Colors and styling
    background_color TEXT DEFAULT '#FFFFFF',
    text_color TEXT DEFAULT '#000000',
    border_enabled BOOLEAN DEFAULT true,
    border_width NUMERIC DEFAULT 0.5,
    border_color TEXT DEFAULT '#000000',
    
    is_default BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false,         -- System templates cannot be deleted
    organization_id UUID REFERENCES organizations(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMPTZ
);

-- Add foreign key constraint for qr_labels -> label_templates
ALTER TABLE qr_labels ADD CONSTRAINT fk_qr_labels_template 
    FOREIGN KEY (label_template_id) REFERENCES label_templates(id);

-- QR Code Scan Tracking
CREATE TABLE qr_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_token TEXT NOT NULL,
    scan_type TEXT NOT NULL CHECK (scan_type IN ('redirect', 'assignment', 'verification', 'delivery', 'inventory')),
    scanner_type TEXT CHECK (scanner_type IN ('camera', 'manual', 'barcode_scanner')),
    user_id UUID REFERENCES users(id),      -- null if not logged in
    scanned_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    ip_address INET,
    user_agent TEXT,
    redirect_path TEXT,                      -- Where they were redirected
    scan_result TEXT NOT NULL CHECK (scan_result IN ('success', 'unauthorized', 'not_found', 'error')),
    error_message TEXT,                      -- Error details if scan_result = 'error'
    scan_context JSONB DEFAULT '{}',         -- Additional scan context
    organization_id UUID REFERENCES organizations(id),
    branch_id UUID REFERENCES branches(id)
);

-- Bulk Label Batches (for generating blank labels)
CREATE TABLE label_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name TEXT NOT NULL,
    batch_description TEXT,
    label_template_id UUID REFERENCES label_templates(id),
    quantity INTEGER NOT NULL,
    label_type TEXT NOT NULL CHECK (label_type IN ('location', 'product', 'generic')),
    batch_status TEXT DEFAULT 'pending' CHECK (batch_status IN ('pending', 'generated', 'printed', 'assigned')),
    pdf_generated BOOLEAN DEFAULT false,
    pdf_path TEXT,                           -- Path to generated PDF file
    labels_per_sheet INTEGER DEFAULT 1,     -- How many labels per sheet
    sheet_layout TEXT DEFAULT 'single',     -- 'single', 'grid_2x2', 'grid_3x3', etc.
    created_by UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Scanning Operations (deliveries, inventory, etc.)
CREATE TABLE scanning_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('delivery', 'inventory_check', 'location_assignment', 'product_verification')),
    operation_name TEXT NOT NULL,
    operation_status TEXT DEFAULT 'active' CHECK (operation_status IN ('active', 'completed', 'cancelled')),
    started_by UUID REFERENCES users(id),
    started_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    completed_at TIMESTAMPTZ,
    total_items INTEGER DEFAULT 0,
    scanned_items INTEGER DEFAULT 0,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    branch_id UUID REFERENCES branches(id) NOT NULL,
    metadata JSONB DEFAULT '{}'              -- Operation-specific data
);

-- Individual scan results within operations
CREATE TABLE scanning_operation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID REFERENCES scanning_operations(id),
    scanned_code TEXT NOT NULL,             -- QR token or barcode
    code_type TEXT NOT NULL CHECK (code_type IN ('qr_code', 'barcode', 'manual')),
    entity_type TEXT CHECK (entity_type IN ('location', 'product')),
    entity_id UUID,                         -- ID of found location/product
    scan_result TEXT NOT NULL CHECK (scan_result IN ('success', 'not_found', 'duplicate', 'error')),
    quantity INTEGER DEFAULT 1,             -- For inventory operations
    notes TEXT,
    scanned_by UUID REFERENCES users(id),
    scanned_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    location_id UUID REFERENCES locations(id), -- Where this was scanned (if applicable)
    scan_data JSONB DEFAULT '{}'             -- Additional scan data
);

-- Updates to existing tables
-- Add QR code assignment capabilities to locations
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'locations' AND column_name = 'qr_label_id') THEN
        ALTER TABLE locations ADD COLUMN qr_label_id UUID REFERENCES qr_labels(id);
        ALTER TABLE locations ADD COLUMN has_qr_assigned BOOLEAN DEFAULT false;
        ALTER TABLE locations ADD COLUMN qr_assigned_at TIMESTAMPTZ;
        ALTER TABLE locations ADD COLUMN qr_assigned_by UUID REFERENCES users(id);
    END IF;
END $$;

-- Add QR code assignment capabilities to products
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'qr_label_id') THEN
        ALTER TABLE products ADD COLUMN qr_label_id UUID REFERENCES qr_labels(id);
        ALTER TABLE products ADD COLUMN has_qr_assigned BOOLEAN DEFAULT false;
        ALTER TABLE products ADD COLUMN qr_assigned_at TIMESTAMPTZ;
        ALTER TABLE products ADD COLUMN qr_assigned_by UUID REFERENCES users(id);
    END IF;
END $$;

-- Enhance product_variants for better barcode support
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_variants' AND column_name = 'qr_label_id') THEN
        ALTER TABLE product_variants ADD COLUMN qr_label_id UUID REFERENCES qr_labels(id);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX idx_qr_labels_qr_token ON qr_labels(qr_token);
CREATE INDEX idx_qr_labels_organization_branch ON qr_labels(organization_id, branch_id);
CREATE INDEX idx_qr_labels_entity ON qr_labels(entity_type, entity_id);
CREATE INDEX idx_qr_labels_assigned ON qr_labels(assigned_at) WHERE assigned_at IS NOT NULL;

CREATE INDEX idx_label_templates_organization ON label_templates(organization_id);
CREATE INDEX idx_label_templates_type ON label_templates(label_type);
CREATE INDEX idx_label_templates_system ON label_templates(is_system) WHERE is_system = true;

CREATE INDEX idx_qr_scan_logs_qr_token ON qr_scan_logs(qr_token);
CREATE INDEX idx_qr_scan_logs_user ON qr_scan_logs(user_id);
CREATE INDEX idx_qr_scan_logs_scanned_at ON qr_scan_logs(scanned_at);

CREATE INDEX idx_label_batches_organization_branch ON label_batches(organization_id, branch_id);
CREATE INDEX idx_label_batches_status ON label_batches(batch_status);

CREATE INDEX idx_scanning_operations_organization_branch ON scanning_operations(organization_id, branch_id);
CREATE INDEX idx_scanning_operations_status ON scanning_operations(operation_status);

CREATE INDEX idx_scanning_operation_items_operation ON scanning_operation_items(operation_id);
CREATE INDEX idx_scanning_operation_items_code ON scanning_operation_items(scanned_code);

-- Insert system default templates
INSERT INTO label_templates (
    id, name, description, label_type, category, width_mm, height_mm, 
    qr_position, qr_size_mm, show_label_text, label_text_position,
    is_default, is_system, template_config
) VALUES 
-- Small location labels
(
    gen_random_uuid(),
    'Small Location Label',
    'Compact 25x25mm QR label for small locations',
    'location',
    'small',
    25,
    25,
    'center',
    20,
    false,
    'none',
    true,
    true,
    '{"layout": "qr_only", "margins": {"top": 2, "bottom": 2, "left": 2, "right": 2}}'
),
-- Medium location labels
(
    gen_random_uuid(),
    'Medium Location Label',
    'Standard 50x25mm QR label with location name',
    'location',
    'medium',
    50,
    25,
    'left',
    20,
    true,
    'right',
    true,
    true,
    '{"layout": "qr_with_text", "margins": {"top": 2, "bottom": 2, "left": 2, "right": 2}}'
),
-- Large location labels
(
    gen_random_uuid(),
    'Large Location Label',
    'Comprehensive 75x50mm QR label with full information',
    'location',
    'large',
    75,
    50,
    'top-left',
    25,
    true,
    'bottom',
    true,
    true,
    '{"layout": "comprehensive", "margins": {"top": 5, "bottom": 5, "left": 5, "right": 5}}'
),
-- Small product labels
(
    gen_random_uuid(),
    'Small Product Label',
    'Compact 25x25mm QR label for products',
    'product',
    'small',
    25,
    25,
    'center',
    20,
    false,
    'none',
    true,
    true,
    '{"layout": "qr_only", "margins": {"top": 2, "bottom": 2, "left": 2, "right": 2}}'
),
-- Medium product labels
(
    gen_random_uuid(),
    'Medium Product Label',
    'Standard 50x25mm QR label with product name',
    'product',
    'medium',
    50,
    25,
    'left',
    20,
    true,
    'right',
    true,
    true,
    '{"layout": "qr_with_text", "margins": {"top": 2, "bottom": 2, "left": 2, "right": 2}}'
),
-- Large product labels with barcode
(
    gen_random_uuid(),
    'Large Product Label with Barcode',
    'Comprehensive 75x50mm label with QR and barcode',
    'product',
    'large',
    75,
    50,
    'top-left',
    20,
    true,
    'center',
    true,
    true,
    '{"layout": "qr_and_barcode", "show_barcode": true, "margins": {"top": 5, "bottom": 5, "left": 5, "right": 5}}'
);

COMMENT ON TABLE qr_labels IS 'QR/Barcode labels that can be generated, printed, and assigned to locations or products';
COMMENT ON TABLE label_templates IS 'Templates for generating different types and sizes of labels';
COMMENT ON TABLE qr_scan_logs IS 'Tracking log for all QR code scans and their outcomes';
COMMENT ON TABLE label_batches IS 'Batch operations for generating multiple labels at once';
COMMENT ON TABLE scanning_operations IS 'Scanning operations like delivery receiving, inventory checks, etc.';
COMMENT ON TABLE scanning_operation_items IS 'Individual items scanned within a scanning operation';