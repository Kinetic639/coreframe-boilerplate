-- Insert test contacts with various combinations
-- This migration inserts 13 diverse test contacts

DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_branch_id uuid;
BEGIN
  -- Get the first organization
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  -- Get the first user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  -- Get the first branch of the organization
  SELECT id INTO v_branch_id FROM branches WHERE organization_id = v_org_id LIMIT 1;

  -- Test Contact 1: Business, Organization scope, with full details
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, company_name, first_name, last_name,
    primary_email, work_phone, mobile_phone, website,
    language_code, currency_code, payment_terms,
    tax_registration_number, tax_exempt, notes, tags
  ) VALUES (
    v_org_id, 'contact', 'business', 'organization',
    'Tech Solutions Ltd', 'Tech Solutions Ltd', 'John', 'Smith',
    'contact@techsolutions.com', '+48 22 123 4567', '+48 600 123 456', 'https://techsolutions.com',
    'en', 'PLN', '30 days',
    'PL1234567890', false, 'Leading IT solutions provider in Warsaw', ARRAY['technology', 'software', 'consulting']
  );

  -- Test Contact 2: Individual, Branch scope
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope, branch_id,
    display_name, first_name, last_name,
    primary_email, mobile_phone,
    language_code, currency_code, notes, tags
  ) VALUES (
    v_org_id, 'contact', 'individual', 'branch', v_branch_id,
    'Anna Kowalska', 'Anna', 'Kowalska',
    'anna.kowalska@email.com', '+48 601 234 567',
    'pl', 'PLN', 'Freelance graphic designer', ARRAY['design', 'freelance']
  );

  -- Test Contact 3: Lead, Organization scope
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, company_name, first_name, last_name,
    primary_email, work_phone, website,
    language_code, currency_code, notes, tags
  ) VALUES (
    v_org_id, 'lead', 'business', 'organization',
    'Future Client Corp', 'Future Client Corp', 'Michael', 'Brown',
    'm.brown@futureclient.com', '+48 22 987 6543', 'https://futureclient.com',
    'en', 'EUR', 'Potential customer for enterprise solution', ARRAY['lead', 'enterprise', 'potential']
  );

  -- Test Contact 4: Private contact
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope, owner_user_id,
    display_name, first_name, last_name,
    primary_email, mobile_phone,
    language_code, currency_code, notes
  ) VALUES (
    v_org_id, 'contact', 'individual', 'private', v_user_id,
    'Private Contact Person', 'Private', 'Person',
    'private@email.com', '+48 602 345 678',
    'pl', 'PLN', 'My personal contact'
  );

  -- Test Contact 5: Business with tax exempt
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, company_name,
    primary_email, work_phone, website,
    language_code, currency_code, payment_terms,
    tax_registration_number, tax_exempt, notes, tags
  ) VALUES (
    v_org_id, 'contact', 'business', 'organization',
    'Non-Profit Foundation', 'Non-Profit Foundation',
    'info@nonprofit.org', '+48 22 111 2222', 'https://nonprofit.org',
    'pl', 'PLN', '14 days',
    'PL9876543210', true, 'Charity organization with tax exemption', ARRAY['nonprofit', 'charity']
  );

  -- Test Contact 6: Individual with multiple phone numbers
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, first_name, last_name,
    primary_email, work_phone, mobile_phone,
    language_code, currency_code, notes, tags
  ) VALUES (
    v_org_id, 'contact', 'individual', 'organization',
    'Jan Nowak', 'Jan', 'Nowak',
    'jan.nowak@example.pl', '+48 22 333 4444', '+48 603 456 789',
    'pl', 'PLN', 'Consultant specializing in financial services', ARRAY['finance', 'consultant']
  );

  -- Test Contact 7: Business with portal enabled
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, company_name, first_name, last_name,
    primary_email, work_phone, website,
    language_code, currency_code, portal_enabled, notes, tags
  ) VALUES (
    v_org_id, 'contact', 'business', 'organization',
    'Partner Solutions Sp. z o.o.', 'Partner Solutions Sp. z o.o.', 'Piotr', 'Wiśniewski',
    'p.wisniewski@partnersolutions.pl', '+48 22 777 8888', 'https://partnersolutions.pl',
    'pl', 'PLN', true, 'Strategic partner with portal access', ARRAY['partner', 'strategic']
  );

  -- Test Contact 8: Lead with different currency
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, company_name, first_name, last_name,
    primary_email, work_phone, website,
    language_code, currency_code, notes, tags
  ) VALUES (
    v_org_id, 'lead', 'business', 'organization',
    'German Industrial GmbH', 'German Industrial GmbH', 'Hans', 'Müller',
    'h.mueller@germanind.de', '+49 30 123 4567', 'https://germanind.de',
    'en', 'EUR', 'International lead from Germany', ARRAY['lead', 'international', 'germany']
  );

  -- Test Contact 9: Individual lead
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, first_name, last_name,
    primary_email, mobile_phone,
    language_code, currency_code, notes, tags
  ) VALUES (
    v_org_id, 'lead', 'individual', 'organization',
    'Maria Kowalczyk', 'Maria', 'Kowalczyk',
    'maria.k@email.pl', '+48 604 567 890',
    'pl', 'PLN', 'Interested in our services, follow up in 2 weeks', ARRAY['lead', 'follow-up']
  );

  -- Test Contact 10: Other type contact
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, company_name,
    primary_email, work_phone,
    language_code, currency_code, notes, tags
  ) VALUES (
    v_org_id, 'other', 'business', 'organization',
    'Government Agency', 'Government Agency',
    'contact@gov.pl', '+48 22 999 0000',
    'pl', 'PLN', 'Government contact for regulatory matters', ARRAY['government', 'regulatory']
  );

  -- Test Contact 11: Business with minimal info
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, company_name,
    primary_email,
    language_code, currency_code
  ) VALUES (
    v_org_id, 'contact', 'business', 'organization',
    'Quick Add Company', 'Quick Add Company',
    'quick@company.com',
    'en', 'PLN'
  );

  -- Test Contact 12: Individual with website
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, first_name, last_name,
    primary_email, mobile_phone, website,
    language_code, currency_code, notes, tags
  ) VALUES (
    v_org_id, 'contact', 'individual', 'organization',
    'Freelancer Web Dev', 'Adam', 'Developer',
    'adam@webdev.pl', '+48 605 678 901', 'https://adamdev.pl',
    'pl', 'PLN', 'Experienced web developer available for projects', ARRAY['freelance', 'development', 'web']
  );

  -- Test Contact 13: Business with USD currency
  INSERT INTO contacts (
    organization_id, contact_type, entity_type, visibility_scope,
    display_name, company_name, first_name, last_name,
    primary_email, work_phone, website,
    language_code, currency_code, payment_terms, notes, tags
  ) VALUES (
    v_org_id, 'contact', 'business', 'organization',
    'US Import Export LLC', 'US Import Export LLC', 'Robert', 'Johnson',
    'r.johnson@usimportexport.com', '+1 212 555 1234', 'https://usimportexport.com',
    'en', 'USD', '60 days', 'US-based importer, payment in USD', ARRAY['international', 'usa', 'import-export']
  );

  RAISE NOTICE '✅ Inserted 13 test contacts successfully';

END $$;

-- Show summary of inserted contacts
SELECT
  contact_type,
  entity_type,
  visibility_scope,
  COUNT(*) as count
FROM contacts
GROUP BY contact_type, entity_type, visibility_scope
ORDER BY contact_type, entity_type, visibility_scope;
