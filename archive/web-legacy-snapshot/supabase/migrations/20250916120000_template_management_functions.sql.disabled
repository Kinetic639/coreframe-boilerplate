-- =============================================
-- Migration: Create database functions for template management
-- Implements Week 3 of the flexible product implementation plan
-- =============================================

-- Function to get all system templates with their attributes
CREATE OR REPLACE FUNCTION get_system_templates()
RETURNS TABLE (
  template_id UUID,
  template_name TEXT,
  template_slug TEXT,
  description TEXT,
  icon TEXT,
  color TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  attributes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.id as template_id,
    pt.name as template_name,
    pt.slug,
    pt.description,
    pt.icon,
    pt.color,
    pt.metadata,
    pt.created_at,
    pt.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', tad.id,
          'attribute_key', tad.attribute_key,
          'display_name', tad.display_name,
          'description', tad.description,
          'data_type', tad.data_type,
          'validation_rules', tad.validation_rules,
          'default_value', tad.default_value,
          'is_required', tad.is_required,
          'is_unique', tad.is_unique,
          'is_searchable', tad.is_searchable,
          'context_scope', tad.context_scope,
          'display_order', tad.display_order
        )
        ORDER BY tad.display_order
      ) FILTER (WHERE tad.id IS NOT NULL),
      '[]'::json
    )::jsonb as attributes
  FROM product_templates pt
  LEFT JOIN template_attribute_definitions tad ON pt.id = tad.template_id
  WHERE pt.is_system = true
    AND pt.deleted_at IS NULL
  GROUP BY pt.id, pt.name, pt.slug, pt.description, pt.icon, pt.color, pt.metadata, pt.created_at, pt.updated_at
  ORDER BY pt.name;
END;
$$;

-- Function to get organization templates with their attributes
CREATE OR REPLACE FUNCTION get_organization_templates(p_organization_id UUID)
RETURNS TABLE (
  template_id UUID,
  template_name TEXT,
  template_slug TEXT,
  description TEXT,
  icon TEXT,
  color TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  attributes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has access to this organization
  IF NOT EXISTS (
    SELECT 1 FROM user_role_assignments
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied to organization templates';
  END IF;

  RETURN QUERY
  SELECT
    pt.id as template_id,
    pt.name as template_name,
    pt.slug,
    pt.description,
    pt.icon,
    pt.color,
    pt.metadata,
    pt.created_at,
    pt.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', tad.id,
          'attribute_key', tad.attribute_key,
          'display_name', tad.display_name,
          'description', tad.description,
          'data_type', tad.data_type,
          'validation_rules', tad.validation_rules,
          'default_value', tad.default_value,
          'is_required', tad.is_required,
          'is_unique', tad.is_unique,
          'is_searchable', tad.is_searchable,
          'context_scope', tad.context_scope,
          'display_order', tad.display_order
        )
        ORDER BY tad.display_order
      ) FILTER (WHERE tad.id IS NOT NULL),
      '[]'::json
    )::jsonb as attributes
  FROM product_templates pt
  LEFT JOIN template_attribute_definitions tad ON pt.id = tad.template_id
  WHERE pt.organization_id = p_organization_id
    AND pt.deleted_at IS NULL
    AND pt.is_system = false
  GROUP BY pt.id, pt.name, pt.slug, pt.description, pt.icon, pt.color, pt.metadata, pt.created_at, pt.updated_at
  ORDER BY pt.name;
END;
$$;

-- Function to get a single template by ID with attributes
CREATE OR REPLACE FUNCTION get_template_by_id(p_template_id UUID)
RETURNS TABLE (
  template_id UUID,
  template_name TEXT,
  template_slug TEXT,
  description TEXT,
  icon TEXT,
  color TEXT,
  metadata JSONB,
  organization_id UUID,
  parent_template_id UUID,
  is_system BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  attributes JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template_org_id UUID;
BEGIN
  -- Get the template's organization ID
  SELECT pt.organization_id INTO template_org_id
  FROM product_templates pt
  WHERE pt.id = p_template_id;

  -- Check permissions: system templates are accessible to all, org templates need permission
  IF template_org_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
        AND organization_id = template_org_id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Access denied to template';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    pt.id as template_id,
    pt.name as template_name,
    pt.slug,
    pt.description,
    pt.icon,
    pt.color,
    pt.metadata,
    pt.organization_id,
    pt.parent_template_id,
    pt.is_system,
    pt.created_at,
    pt.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', tad.id,
          'attribute_key', tad.attribute_key,
          'display_name', tad.display_name,
          'description', tad.description,
          'data_type', tad.data_type,
          'validation_rules', tad.validation_rules,
          'default_value', tad.default_value,
          'is_required', tad.is_required,
          'is_unique', tad.is_unique,
          'is_searchable', tad.is_searchable,
          'context_scope', tad.context_scope,
          'display_order', tad.display_order
        )
        ORDER BY tad.display_order
      ) FILTER (WHERE tad.id IS NOT NULL),
      '[]'::json
    )::jsonb as attributes
  FROM product_templates pt
  LEFT JOIN template_attribute_definitions tad ON pt.id = tad.template_id
  WHERE pt.id = p_template_id
    AND pt.deleted_at IS NULL
  GROUP BY pt.id, pt.name, pt.slug, pt.description, pt.icon, pt.color, pt.metadata, pt.organization_id, pt.parent_template_id, pt.is_system, pt.created_at, pt.updated_at;
END;
$$;

-- Function to create a new template with attributes (transaction-safe)
CREATE OR REPLACE FUNCTION create_template_with_attributes(
  p_name TEXT,
  p_slug TEXT,
  p_organization_id UUID,
  p_description TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_color TEXT DEFAULT '#6366f1',
  p_metadata JSONB DEFAULT '{}',
  p_attributes JSONB DEFAULT '[]'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_template_id UUID;
  attr RECORD;
BEGIN
  -- Check if user has access to this organization
  IF NOT EXISTS (
    SELECT 1 FROM user_role_assignments
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied to create template in this organization';
  END IF;

  -- Insert the template
  INSERT INTO product_templates (
    name, slug, description, organization_id, icon, color, metadata, is_system, created_by
  ) VALUES (
    p_name, p_slug, p_description, p_organization_id, p_icon, p_color, p_metadata, false, auth.uid()
  ) RETURNING id INTO new_template_id;

  -- Insert attributes if provided
  FOR attr IN SELECT * FROM jsonb_array_elements(p_attributes)
  LOOP
    INSERT INTO template_attribute_definitions (
      template_id,
      attribute_key,
      display_name,
      description,
      data_type,
      validation_rules,
      default_value,
      is_required,
      is_unique,
      is_searchable,
      context_scope,
      display_order
    ) VALUES (
      new_template_id,
      (attr.value->>'attribute_key')::TEXT,
      (attr.value->>'display_name')::TEXT,
      (attr.value->>'description')::TEXT,
      (attr.value->>'data_type')::TEXT,
      COALESCE((attr.value->'validation_rules'), '{}'::jsonb),
      (attr.value->'default_value'),
      COALESCE((attr.value->>'is_required')::BOOLEAN, false),
      COALESCE((attr.value->>'is_unique')::BOOLEAN, false),
      COALESCE((attr.value->>'is_searchable')::BOOLEAN, true),
      COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(attr.value->'context_scope'))),
        ARRAY['warehouse']
      ),
      COALESCE((attr.value->>'display_order')::INTEGER, 0)
    );
  END LOOP;

  RETURN new_template_id;
END;
$$;

-- Function to update template with attributes (replaces all attributes)
CREATE OR REPLACE FUNCTION update_template_with_attributes(
  p_template_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_attributes JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template_org_id UUID;
  attr RECORD;
BEGIN
  -- Get template organization and check permissions
  SELECT organization_id INTO template_org_id
  FROM product_templates
  WHERE id = p_template_id AND is_system = false AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or is system template';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_role_assignments
    WHERE user_id = auth.uid()
      AND organization_id = template_org_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied to update this template';
  END IF;

  -- Update template
  UPDATE product_templates SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    icon = COALESCE(p_icon, icon),
    color = COALESCE(p_color, color),
    metadata = COALESCE(p_metadata, metadata),
    updated_at = timezone('utc', now())
  WHERE id = p_template_id;

  -- If attributes are provided, replace all existing attributes
  IF p_attributes IS NOT NULL THEN
    -- Delete existing attributes
    DELETE FROM template_attribute_definitions WHERE template_id = p_template_id;

    -- Insert new attributes
    FOR attr IN SELECT * FROM jsonb_array_elements(p_attributes)
    LOOP
      INSERT INTO template_attribute_definitions (
        template_id,
        attribute_key,
        display_name,
        description,
        data_type,
        validation_rules,
        default_value,
        is_required,
        is_unique,
        is_searchable,
        context_scope,
        display_order
      ) VALUES (
        p_template_id,
        (attr.value->>'attribute_key')::TEXT,
        (attr.value->>'display_name')::TEXT,
        (attr.value->>'description')::TEXT,
        (attr.value->>'data_type')::TEXT,
        COALESCE((attr.value->'validation_rules'), '{}'::jsonb),
        (attr.value->'default_value'),
        COALESCE((attr.value->>'is_required')::BOOLEAN, false),
        COALESCE((attr.value->>'is_unique')::BOOLEAN, false),
        COALESCE((attr.value->>'is_searchable')::BOOLEAN, true),
        COALESCE(
          (SELECT ARRAY(SELECT jsonb_array_elements_text(attr.value->'context_scope'))),
          ARRAY['warehouse']
        ),
        COALESCE((attr.value->>'display_order')::INTEGER, 0)
      );
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$;

-- Function to soft delete template
CREATE OR REPLACE FUNCTION delete_template(p_template_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template_org_id UUID;
BEGIN
  -- Get template organization and check permissions
  SELECT organization_id INTO template_org_id
  FROM product_templates
  WHERE id = p_template_id AND is_system = false AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found or is system template';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_role_assignments
    WHERE user_id = auth.uid()
      AND organization_id = template_org_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied to delete this template';
  END IF;

  -- Soft delete the template
  UPDATE product_templates SET
    deleted_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  WHERE id = p_template_id;

  RETURN TRUE;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_system_templates() TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_templates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_template_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_template_with_attributes(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_template_with_attributes(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_template(UUID) TO authenticated;