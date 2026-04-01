-- =============================================
-- Migration: RLS Policies for QR/Barcode System
-- Creates comprehensive Row Level Security policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE qr_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanning_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanning_operation_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- QR Labels Policies
-- =============================================

-- Users can view QR labels from their organization/branch
CREATE POLICY "Users can view QR labels from their organization/branch"
ON qr_labels FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND (
    branch_id IN (
      SELECT ur.branch_id 
      FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.organization_id = qr_labels.organization_id
      AND ur.role_id IN (
        SELECT r.id FROM roles r 
        WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
      )
    )
  )
);

-- Users with appropriate permissions can create QR labels
CREATE POLICY "Users can create QR labels in their organization/branch"
ON qr_labels FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND branch_id IN (
    SELECT ur.branch_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Users can update QR labels they have access to
CREATE POLICY "Users can update QR labels in their organization/branch"
ON qr_labels FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND (
    branch_id IN (
      SELECT ur.branch_id 
      FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.organization_id = qr_labels.organization_id
      AND ur.role_id IN (
        SELECT r.id FROM roles r 
        WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
      )
    )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND (
    branch_id IN (
      SELECT ur.branch_id 
      FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.organization_id = qr_labels.organization_id
      AND ur.role_id IN (
        SELECT r.id FROM roles r 
        WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
      )
    )
  )
);

-- Only org admins can delete QR labels
CREATE POLICY "Org admins can delete QR labels"
ON qr_labels FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.organization_id = qr_labels.organization_id
    AND ur.role_id IN (
      SELECT r.id FROM roles r 
      WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
    )
  )
);

-- =============================================
-- Label Templates Policies
-- =============================================

-- Users can view system templates and templates from their organization
CREATE POLICY "Users can view system and organization templates"
ON label_templates FOR SELECT
TO authenticated
USING (
  is_system = true
  OR organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  OR organization_id IS NULL
);

-- Users can create templates in their organization
CREATE POLICY "Users can create templates in their organization"
ON label_templates FOR INSERT
TO authenticated
WITH CHECK (
  (organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  ) AND created_by = auth.uid())
  OR is_system = false
);

-- Users can update non-system templates in their organization
CREATE POLICY "Users can update organization templates"
ON label_templates FOR UPDATE
TO authenticated
USING (
  is_system = false
  AND organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
)
WITH CHECK (
  is_system = false
  AND organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);

-- Users can delete non-system templates they created or org admins can delete org templates
CREATE POLICY "Users can delete non-system templates"
ON label_templates FOR DELETE
TO authenticated
USING (
  is_system = false
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.organization_id = label_templates.organization_id
      AND ur.role_id IN (
        SELECT r.id FROM roles r 
        WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
      )
    )
  )
);

-- =============================================
-- QR Scan Logs Policies
-- =============================================

-- Users can view scan logs from their organization/branch
CREATE POLICY "Users can view scan logs from their organization/branch"
ON qr_scan_logs FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
    AND ur.role_id IN (
      SELECT r.id FROM roles r 
      WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin', 'branch_admin')
    )
  )
);

-- Anyone can create scan logs (including unauthenticated for public QR redirects)
CREATE POLICY "Anyone can create scan logs"
ON qr_scan_logs FOR INSERT
TO public
WITH CHECK (true);

-- No updates or deletes allowed on scan logs (audit trail)
-- Scan logs are immutable for audit purposes

-- =============================================
-- Label Batches Policies
-- =============================================

-- Users can view label batches from their organization/branch
CREATE POLICY "Users can view label batches from their organization/branch"
ON label_batches FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND (
    branch_id IN (
      SELECT ur.branch_id 
      FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.organization_id = label_batches.organization_id
      AND ur.role_id IN (
        SELECT r.id FROM roles r 
        WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
      )
    )
  )
);

-- Users can create label batches in their organization/branch
CREATE POLICY "Users can create label batches in their organization/branch"
ON label_batches FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND branch_id IN (
    SELECT ur.branch_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Users can update label batches they created
CREATE POLICY "Users can update their label batches"
ON label_batches FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.organization_id = label_batches.organization_id
    AND ur.role_id IN (
      SELECT r.id FROM roles r 
      WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
    )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);

-- Users can delete label batches they created or org admins can delete
CREATE POLICY "Users can delete their label batches"
ON label_batches FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.organization_id = label_batches.organization_id
    AND ur.role_id IN (
      SELECT r.id FROM roles r 
      WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
    )
  )
);

-- =============================================
-- Scanning Operations Policies
-- =============================================

-- Users can view scanning operations from their organization/branch
CREATE POLICY "Users can view scanning operations from their organization/branch"
ON scanning_operations FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND (
    branch_id IN (
      SELECT ur.branch_id 
      FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.organization_id = scanning_operations.organization_id
      AND ur.role_id IN (
        SELECT r.id FROM roles r 
        WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
      )
    )
  )
);

-- Users can create scanning operations in their organization/branch
CREATE POLICY "Users can create scanning operations in their organization/branch"
ON scanning_operations FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND branch_id IN (
    SELECT ur.branch_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
  AND started_by = auth.uid()
);

-- Users can update scanning operations they started
CREATE POLICY "Users can update their scanning operations"
ON scanning_operations FOR UPDATE
TO authenticated
USING (
  started_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.organization_id = scanning_operations.organization_id
    AND ur.role_id IN (
      SELECT r.id FROM roles r 
      WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin', 'branch_admin')
    )
  )
)
WITH CHECK (
  organization_id IN (
    SELECT ur.organization_id 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);

-- =============================================
-- Scanning Operation Items Policies
-- =============================================

-- Users can view scanning operation items if they can view the parent operation
CREATE POLICY "Users can view scanning operation items"
ON scanning_operation_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM scanning_operations so
    WHERE so.id = scanning_operation_items.operation_id
    AND so.organization_id IN (
      SELECT ur.organization_id 
      FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
    AND (
      so.branch_id IN (
        SELECT ur.branch_id 
        FROM user_roles ur 
        WHERE ur.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.organization_id = so.organization_id
        AND ur.role_id IN (
          SELECT r.id FROM roles r 
          WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
        )
      )
    )
  )
);

-- Users can create scanning operation items for operations they have access to
CREATE POLICY "Users can create scanning operation items"
ON scanning_operation_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM scanning_operations so
    WHERE so.id = scanning_operation_items.operation_id
    AND so.organization_id IN (
      SELECT ur.organization_id 
      FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
    AND (
      so.branch_id IN (
        SELECT ur.branch_id 
        FROM user_roles ur 
        WHERE ur.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.organization_id = so.organization_id
        AND ur.role_id IN (
          SELECT r.id FROM roles r 
          WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin')
        )
      )
    )
  )
  AND scanned_by = auth.uid()
);

-- Users can update scanning operation items they created
CREATE POLICY "Users can update their scanning operation items"
ON scanning_operation_items FOR UPDATE
TO authenticated
USING (
  scanned_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM scanning_operations so
    JOIN user_roles ur ON ur.user_id = auth.uid()
    WHERE so.id = scanning_operation_items.operation_id
    AND ur.organization_id = so.organization_id
    AND ur.role_id IN (
      SELECT r.id FROM roles r 
      WHERE r.slug IN ('superadmin', 'org_owner', 'org_admin', 'branch_admin')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM scanning_operations so
    WHERE so.id = scanning_operation_items.operation_id
    AND so.organization_id IN (
      SELECT ur.organization_id 
      FROM user_roles ur 
      WHERE ur.user_id = auth.uid()
    )
  )
);