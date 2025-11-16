-- =====================================================
-- Fix Purchase Orders User Foreign Keys
-- =====================================================
-- Description: Update foreign key constraints to reference public.users instead of auth.users
-- Date: 2025-11-16
-- =====================================================

-- Drop existing foreign key constraints that reference auth.users
ALTER TABLE purchase_orders
DROP CONSTRAINT IF EXISTS purchase_orders_approved_by_fkey;

ALTER TABLE purchase_orders
DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;

ALTER TABLE purchase_orders
DROP CONSTRAINT IF EXISTS purchase_orders_cancelled_by_fkey;

-- Add new foreign key constraints that reference public.users
ALTER TABLE purchase_orders
ADD CONSTRAINT purchase_orders_approved_by_fkey
FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders
ADD CONSTRAINT purchase_orders_created_by_fkey
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE purchase_orders
ADD CONSTRAINT purchase_orders_cancelled_by_fkey
FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL;
