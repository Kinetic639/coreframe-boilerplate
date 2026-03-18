-- Function to create a new product template with attributes
CREATE OR REPLACE FUNCTION create_product_template(
  template_data JSONB,
  attribute_definitions JSONB DEFAULT '[]'::jsonb
) RETURNS product_templates
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_template product_templates;
  attr_def JSONB;
BEGIN
  -- Insert template
  INSERT INTO product_templates (
    name, description, organization_id, parent_template_id,
    category, icon, color, supported_contexts, settings, created_by
  ) VALUES (
    template_data->>'name',
    template_data->>'description',
    COALESCE((template_data->>'organization_id')::uuid, NULL),
    COALESCE((template_data->>'parent_template_id')::uuid, NULL),
    template_data->>'category',
    template_data->>'icon',
    template_data->>'color',
    COALESCE((template_data->>'supported_contexts')::text[], '{"warehouse"}'),
    COALESCE(template_data->'settings', '{}'::jsonb),
    auth.uid()
  ) RETURNING * INTO new_template;

  -- Insert attribute definitions
  FOR attr_def IN SELECT jsonb_array_elements(attribute_definitions)
  LOOP
    INSERT INTO product_attribute_definitions (
      template_id, slug, label, description, data_type, is_required,
      is_unique, default_value, validation_rules, context_scope,
      display_order, is_searchable, is_filterable, input_type,
      placeholder, help_text
    ) VALUES (
      new_template.id,
      attr_def->>'slug',
      attr_def->'label',
      attr_def->'description',
      attr_def->>'data_type',
      COALESCE((attr_def->>'is_required')::boolean, false),
      COALESCE((attr_def->>'is_unique')::boolean, false),
      attr_def->'default_value',
      COALESCE(attr_def->'validation_rules', '{}'::jsonb),
      COALESCE(attr_def->>'context_scope', 'warehouse'),
      COALESCE((attr_def->>'display_order')::integer, 0),
      COALESCE((attr_def->>'is_searchable')::boolean, false),
      COALESCE((attr_def->>'is_filterable')::boolean, false),
      COALESCE(attr_def->>'input_type', 'text'),
      attr_def->'placeholder',
      attr_def->'help_text'
    );
  END LOOP;

  RETURN new_template;
END;
$$;

-- Function to update a product template and its attributes
CREATE OR REPLACE FUNCTION update_product_template(
  template_id UUID,
  template_data JSONB,
  attribute_definitions JSONB DEFAULT '[]'::jsonb
) RETURNS product_templates
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_template product_templates;
  attr_def JSONB;
BEGIN
  -- Update template
  UPDATE product_templates SET
    name = COALESCE(template_data->>'name', name),
    description = COALESCE(template_data->>'description', description),
    category = COALESCE(template_data->>'category', category),
    icon = COALESCE(template_data->>'icon', icon),
    color = COALESCE(template_data->>'color', color),
    supported_contexts = COALESCE((template_data->>'supported_contexts')::text[], supported_contexts),
    settings = COALESCE(template_data->'settings', settings),
    updated_at = NOW()
  WHERE id = template_id
  RETURNING * INTO updated_template;

  -- Delete existing attribute definitions if new ones provided
  IF jsonb_array_length(attribute_definitions) > 0 THEN
    DELETE FROM product_attribute_definitions WHERE template_id = updated_template.id;

    -- Insert new attribute definitions
    FOR attr_def IN SELECT jsonb_array_elements(attribute_definitions)
    LOOP
      INSERT INTO product_attribute_definitions (
        template_id, slug, label, description, data_type, is_required,
        is_unique, default_value, validation_rules, context_scope,
        display_order, is_searchable, is_filterable, input_type,
        placeholder, help_text
      ) VALUES (
        updated_template.id,
        attr_def->>'slug',
        attr_def->'label',
        attr_def->'description',
        attr_def->>'data_type',
        COALESCE((attr_def->>'is_required')::boolean, false),
        COALESCE((attr_def->>'is_unique')::boolean, false),
        attr_def->'default_value',
        COALESCE(attr_def->'validation_rules', '{}'::jsonb),
        COALESCE(attr_def->>'context_scope', 'warehouse'),
        COALESCE((attr_def->>'display_order')::integer, 0),
        COALESCE((attr_def->>'is_searchable')::boolean, false),
        COALESCE((attr_def->>'is_filterable')::boolean, false),
        COALESCE(attr_def->>'input_type', 'text'),
        attr_def->'placeholder',
        attr_def->'help_text'
      );
    END LOOP;
  END IF;

  RETURN updated_template;
END;
$$;

-- Function to clone a template (system to organization or organization to organization)
CREATE OR REPLACE FUNCTION clone_product_template(
  source_template_id UUID,
  target_organization_id UUID,
  new_name TEXT,
  customizations JSONB DEFAULT '{}'::jsonb
) RETURNS product_templates
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  source_template product_templates;
  new_template product_templates;
  attr_def product_attribute_definitions;
BEGIN
  -- Get source template
  SELECT * INTO source_template
  FROM product_templates
  WHERE id = source_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source template not found';
  END IF;

  -- Create new template
  INSERT INTO product_templates (
    name, description, organization_id, parent_template_id,
    category, icon, color, supported_contexts, settings, created_by
  ) VALUES (
    new_name,
    COALESCE(customizations->>'description', source_template.description),
    target_organization_id,
    source_template_id,
    COALESCE(customizations->>'category', source_template.category),
    COALESCE(customizations->>'icon', source_template.icon),
    COALESCE(customizations->>'color', source_template.color),
    COALESCE((customizations->>'supported_contexts')::text[], source_template.supported_contexts),
    COALESCE(customizations->'settings', source_template.settings),
    auth.uid()
  ) RETURNING * INTO new_template;

  -- Clone attribute definitions
  FOR attr_def IN
    SELECT * FROM product_attribute_definitions
    WHERE template_id = source_template_id
    ORDER BY display_order
  LOOP
    INSERT INTO product_attribute_definitions (
      template_id, slug, label, description, data_type, is_required,
      is_unique, default_value, validation_rules, context_scope,
      display_order, is_searchable, is_filterable, input_type,
      placeholder, help_text
    ) VALUES (
      new_template.id,
      attr_def.slug,
      attr_def.label,
      attr_def.description,
      attr_def.data_type,
      attr_def.is_required,
      attr_def.is_unique,
      attr_def.default_value,
      attr_def.validation_rules,
      attr_def.context_scope,
      attr_def.display_order,
      attr_def.is_searchable,
      attr_def.is_filterable,
      attr_def.input_type,
      attr_def.placeholder,
      attr_def.help_text
    );
  END LOOP;

  RETURN new_template;
END;
$$;

-- Function to get template with attributes
CREATE OR REPLACE FUNCTION get_template_with_attributes(
  template_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'template', row_to_json(t.*),
    'attributes', COALESCE(
      jsonb_agg(row_to_json(a.*) ORDER BY a.display_order),
      '[]'::jsonb
    )
  ) INTO result
  FROM product_templates t
  LEFT JOIN product_attribute_definitions a ON t.id = a.template_id
  WHERE t.id = template_id
  GROUP BY t.id;

  RETURN result;
END;
$$;

-- Function to get templates for organization (system + org templates)
CREATE OR REPLACE FUNCTION get_organization_templates(
  org_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'system_templates', COALESCE(system_templates.templates, '[]'::jsonb),
    'organization_templates', COALESCE(org_templates.templates, '[]'::jsonb)
  ) INTO result
  FROM (
    SELECT jsonb_agg(
      jsonb_build_object(
        'template', row_to_json(t.*),
        'attribute_count', COALESCE(attr_counts.count, 0)
      ) ORDER BY t.name
    ) as templates
    FROM product_templates t
    LEFT JOIN (
      SELECT template_id, COUNT(*) as count
      FROM product_attribute_definitions
      GROUP BY template_id
    ) attr_counts ON t.id = attr_counts.template_id
    WHERE t.is_system = true AND t.is_active = true
  ) system_templates,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'template', row_to_json(t.*),
        'attribute_count', COALESCE(attr_counts.count, 0)
      ) ORDER BY t.name
    ) as templates
    FROM product_templates t
    LEFT JOIN (
      SELECT template_id, COUNT(*) as count
      FROM product_attribute_definitions
      GROUP BY template_id
    ) attr_counts ON t.id = attr_counts.template_id
    WHERE t.is_system = false AND t.organization_id = org_id AND t.is_active = true
  ) org_templates;

  RETURN result;
END;
$$;