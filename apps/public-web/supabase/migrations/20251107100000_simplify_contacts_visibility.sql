-- =============================================
-- Simplify Contacts Visibility: Remove Branch Scope
-- Keep RLS Disabled for Testing
-- =============================================

-- Step 1: Delete all existing test contacts
DELETE FROM contact_addresses;
DELETE FROM contact_custom_field_values;
DELETE FROM contacts;

-- Step 2: Drop old constraint first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contacts_visibility_scope_check'
  ) THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_visibility_scope_check;
  END IF;
END $$;

-- Step 3: Add new constraint with only 2 options (private/organization only)
ALTER TABLE contacts ADD CONSTRAINT contacts_visibility_scope_check
  CHECK (visibility_scope IN ('private', 'organization'));

-- Step 3: Add validation function to prevent private contacts from being linked
CREATE OR REPLACE FUNCTION validate_contact_business_account_link()
RETURNS TRIGGER AS $$
DECLARE
  contact_visibility TEXT;
  contact_org_id UUID;
BEGIN
  -- Only validate if contact_id is being set (not NULL)
  IF NEW.contact_id IS NOT NULL THEN
    -- Get contact details
    SELECT visibility_scope, organization_id
    INTO contact_visibility, contact_org_id
    FROM contacts
    WHERE id = NEW.contact_id AND deleted_at IS NULL;

    -- Check if contact exists
    IF contact_visibility IS NULL THEN
      RAISE EXCEPTION 'Contact not found or has been deleted';
    END IF;

    -- Prevent linking private contacts to business accounts
    IF contact_visibility = 'private' THEN
      RAISE EXCEPTION 'Cannot link private contact to business account. Change contact visibility to Organization first.';
    END IF;

    -- Ensure contact and business account belong to same organization
    IF contact_org_id != NEW.organization_id THEN
      RAISE EXCEPTION 'Contact must belong to the same organization as the business account';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger for business_accounts
DROP TRIGGER IF EXISTS validate_business_account_contact_link ON business_accounts;

CREATE TRIGGER validate_business_account_contact_link
  BEFORE INSERT OR UPDATE OF contact_id ON business_accounts
  FOR EACH ROW
  EXECUTE FUNCTION validate_contact_business_account_link();

-- Step 5: Add helpful comments
COMMENT ON COLUMN contacts.visibility_scope IS 'Contact visibility: private (owner only) or organization (all members). Private contacts cannot be linked to business accounts.';
COMMENT ON COLUMN contacts.owner_user_id IS 'Required for private contacts, NULL for organization contacts. Organization contacts can be edited by creator or admins.';
COMMENT ON COLUMN contacts.branch_id IS 'Deprecated - branch scope removed. Kept for backward compatibility, always NULL.';

-- Step 6: Insert example contacts for testing
-- Get the first user and organization for test data
DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
BEGIN
  -- Get first user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  -- Get first organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  -- Only insert if we have both user and org
  IF v_user_id IS NOT NULL AND v_org_id IS NOT NULL THEN

    -- Organization Contacts (visible to all)
    INSERT INTO contacts (organization_id, contact_type, visibility_scope, owner_user_id, created_by, salutation, first_name, last_name, display_name, primary_email, work_phone, mobile_phone, website, tags, notes) VALUES
    (v_org_id, 'contact', 'organization', NULL, v_user_id, 'Mr', 'John', 'Anderson', 'John Anderson', 'john.anderson@techcorp.com', '+48 22 123 4567', '+48 501 234 567', 'https://techcorp.com', ARRAY['vendor-contact', 'vip'], 'Main contact for TechCorp - handles all technical inquiries'),
    (v_org_id, 'contact', 'organization', NULL, v_user_id, 'Ms', 'Sarah', 'Mitchell', 'Sarah Mitchell', 'sarah.mitchell@globalsupply.com', '+48 22 987 6543', '+48 502 987 654', 'https://globalsupply.com', ARRAY['supplier', 'logistics'], 'Logistics coordinator at Global Supply Co'),
    (v_org_id, 'lead', 'organization', NULL, v_user_id, 'Dr', 'Michael', 'Chen', 'Dr. Michael Chen', 'michael.chen@innovation.io', NULL, '+48 503 456 789', 'https://innovation.io', ARRAY['potential-client', 'tech'], 'Potential client - interested in enterprise solutions'),
    (v_org_id, 'contact', 'organization', NULL, v_user_id, 'Mrs', 'Anna', 'Kowalska', 'Anna Kowalska', 'anna.kowalska@polskafirma.pl', '+48 12 345 6789', '+48 504 567 890', NULL, ARRAY['client-contact', 'poland'], 'Regional manager for Central Europe'),
    (v_org_id, 'contact', 'organization', NULL, v_user_id, 'Mr', 'David', 'Thompson', 'David Thompson', 'david.thompson@westrade.com', '+1 555 0123', '+1 555 0124', 'https://westrade.com', ARRAY['vendor-contact', 'international'], 'International sales representative'),
    (v_org_id, 'lead', 'organization', NULL, v_user_id, 'Ms', 'Emma', 'Rodriguez', 'Emma Rodriguez', 'emma.rodriguez@startuphub.com', NULL, '+48 505 678 901', 'https://startuphub.com', ARRAY['lead', 'startup'], 'Startup founder - evaluating our services'),
    (v_org_id, 'contact', 'organization', NULL, v_user_id, 'Prof', 'Robert', 'Nowak', 'Prof. Robert Nowak', 'r.nowak@university.edu.pl', '+48 12 617 8900', NULL, 'https://university.edu.pl', ARRAY['academic', 'research'], 'University professor - research collaboration'),
    (v_org_id, 'contact', 'organization', NULL, v_user_id, 'Mr', 'James', 'Wilson', 'James Wilson', 'james.wilson@manufacturing.com', '+48 22 555 1234', '+48 506 789 012', 'https://manufacturing.com', ARRAY['supplier', 'manufacturing'], 'Production manager at Manufacturing Solutions'),
    (v_org_id, 'contact', 'organization', NULL, v_user_id, 'Ms', 'Lisa', 'Brown', 'Lisa Brown', 'lisa.brown@consulting.com', '+44 20 7123 4567', '+44 7700 900123', 'https://consulting.com', ARRAY['partner', 'consulting'], 'Strategic partner for UK market'),

    -- Private Contacts (only visible to owner)
    (v_org_id, 'contact', 'private', v_user_id, v_user_id, 'Mr', 'Tom', 'Personal', 'Tom Personal', 'tom.personal@email.com', NULL, '+48 507 890 123', NULL, ARRAY['personal'], 'Personal contact - friend from industry'),
    (v_org_id, 'lead', 'private', v_user_id, v_user_id, 'Ms', 'Kate', 'Prospect', 'Kate Prospect', 'kate.prospect@startup.io', NULL, '+48 508 901 234', 'https://startup.io', ARRAY['personal-lead'], 'Personal lead - still exploring options'),
    (v_org_id, 'other', 'private', v_user_id, v_user_id, NULL, 'Alex', 'Network', 'Alex Network', 'alex.network@gmail.com', NULL, '+48 509 012 345', NULL, ARRAY['networking'], 'Met at conference - potential future opportunity');

    -- Add sample addresses for some contacts
    INSERT INTO contact_addresses (contact_id, address_type, is_default, country, city, address_line_1, postal_code, phone)
    SELECT
      c.id,
      'both',
      true,
      CASE
        WHEN c.display_name = 'John Anderson' THEN 'Poland'
        WHEN c.display_name = 'Sarah Mitchell' THEN 'Poland'
        WHEN c.display_name = 'Anna Kowalska' THEN 'Poland'
        WHEN c.display_name = 'Lisa Brown' THEN 'United Kingdom'
        ELSE 'Poland'
      END,
      CASE
        WHEN c.display_name = 'John Anderson' THEN 'Warsaw'
        WHEN c.display_name = 'Sarah Mitchell' THEN 'Krakow'
        WHEN c.display_name = 'Anna Kowalska' THEN 'Wroclaw'
        WHEN c.display_name = 'Lisa Brown' THEN 'London'
        ELSE 'Warsaw'
      END,
      CASE
        WHEN c.display_name = 'John Anderson' THEN 'ul. Marszalkowska 100'
        WHEN c.display_name = 'Sarah Mitchell' THEN 'ul. Florianska 20'
        WHEN c.display_name = 'Anna Kowalska' THEN 'ul. Swidnicka 15'
        WHEN c.display_name = 'Lisa Brown' THEN '123 Oxford Street'
        ELSE 'ul. Example 1'
      END,
      CASE
        WHEN c.display_name = 'John Anderson' THEN '00-001'
        WHEN c.display_name = 'Sarah Mitchell' THEN '31-019'
        WHEN c.display_name = 'Anna Kowalska' THEN '50-066'
        WHEN c.display_name = 'Lisa Brown' THEN 'W1D 1LL'
        ELSE '00-000'
      END,
      c.work_phone
    FROM contacts c
    WHERE c.display_name IN ('John Anderson', 'Sarah Mitchell', 'Anna Kowalska', 'Lisa Brown')
    AND c.organization_id = v_org_id;

  END IF;
END $$;
