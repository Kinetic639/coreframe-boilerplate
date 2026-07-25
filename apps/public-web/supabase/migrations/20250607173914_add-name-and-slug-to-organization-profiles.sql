-- Dodanie kolumn name i slug do organization_profiles
ALTER TABLE organization_profiles
ADD COLUMN name TEXT,
ADD COLUMN slug TEXT;

-- Wypełnienie istniejących wartości
UPDATE organization_profiles
SET
  name = organizations.name,
  slug = organizations.slug
FROM organizations
WHERE organizations.id = organization_profiles.organization_id;

-- Dodanie triggera do synchronizacji zmian z organizations
CREATE OR REPLACE FUNCTION update_org_profile_name_slug()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE organization_profiles
  SET
    name = NEW.name,
    slug = NEW.slug
  WHERE organization_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_org_profile_name_slug ON organizations;

CREATE TRIGGER trigger_update_org_profile_name_slug
AFTER UPDATE OF name, slug ON organizations
FOR EACH ROW
EXECUTE FUNCTION update_org_profile_name_slug();
