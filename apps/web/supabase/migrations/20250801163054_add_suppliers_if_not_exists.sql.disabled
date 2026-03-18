-- Extend existing suppliers table with additional fields
DO $$
BEGIN
    -- Add columns to suppliers table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'supplier_code') THEN
        ALTER TABLE suppliers ADD COLUMN supplier_code text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'vat_number') THEN
        ALTER TABLE suppliers ADD COLUMN vat_number text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'email') THEN
        ALTER TABLE suppliers ADD COLUMN email text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'phone') THEN
        ALTER TABLE suppliers ADD COLUMN phone text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'website') THEN
        ALTER TABLE suppliers ADD COLUMN website text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'address_line1') THEN
        ALTER TABLE suppliers ADD COLUMN address_line1 text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'address_line2') THEN
        ALTER TABLE suppliers ADD COLUMN address_line2 text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'postal_code') THEN
        ALTER TABLE suppliers ADD COLUMN postal_code text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'city') THEN
        ALTER TABLE suppliers ADD COLUMN city text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'region') THEN
        ALTER TABLE suppliers ADD COLUMN region text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'country') THEN
        ALTER TABLE suppliers ADD COLUMN country text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'payment_terms') THEN
        ALTER TABLE suppliers ADD COLUMN payment_terms text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'currency') THEN
        ALTER TABLE suppliers ADD COLUMN currency text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'delivery_time') THEN
        ALTER TABLE suppliers ADD COLUMN delivery_time int;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'min_order_value') THEN
        ALTER TABLE suppliers ADD COLUMN min_order_value numeric;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'preferred') THEN
        ALTER TABLE suppliers ADD COLUMN preferred boolean default false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'tags') THEN
        ALTER TABLE suppliers ADD COLUMN tags text[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'rating') THEN
        ALTER TABLE suppliers ADD COLUMN rating int;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'notes') THEN
        ALTER TABLE suppliers ADD COLUMN notes text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'active') THEN
        ALTER TABLE suppliers ADD COLUMN active boolean default true;
    END IF;
END
$$;

-- Create supplier_contacts table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'supplier_contacts') THEN
        CREATE TABLE supplier_contacts (
          id uuid primary key default gen_random_uuid(),
          supplier_id uuid references suppliers(id) on delete cascade,
          name text not null,
          position text,
          email text,
          phone text,
          notes text,
          is_primary boolean default false,
          created_at timestamp default now(),
          updated_at timestamp,
          deleted_at timestamp
        );

        -- Enable RLS
        ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;

        -- Create policies for supplier_contacts table
        CREATE POLICY "Users can view supplier contacts"
          ON supplier_contacts FOR SELECT
          USING (true);

        CREATE POLICY "Users can insert supplier contacts"
          ON supplier_contacts FOR INSERT
          WITH CHECK (true);

        CREATE POLICY "Users can update supplier contacts"
          ON supplier_contacts FOR UPDATE
          USING (true);

        CREATE POLICY "Users can delete supplier contacts"
          ON supplier_contacts FOR DELETE
          USING (true);

        -- Create indexes for better performance
        CREATE INDEX idx_supplier_contacts_supplier_id ON supplier_contacts(supplier_id);
        CREATE INDEX idx_supplier_contacts_is_primary ON supplier_contacts(is_primary);
        CREATE INDEX idx_supplier_contacts_deleted_at ON supplier_contacts(deleted_at);
    END IF;
END
$$;

-- Add indexes to suppliers table if they don't exist
DO $$
BEGIN
    -- Create indexes for better performance if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_suppliers_name') THEN
        CREATE INDEX idx_suppliers_name ON suppliers(name);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_suppliers_active') THEN
        CREATE INDEX idx_suppliers_active ON suppliers(active);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_suppliers_deleted_at') THEN
        CREATE INDEX idx_suppliers_deleted_at ON suppliers(deleted_at);
    END IF;
END
$$;