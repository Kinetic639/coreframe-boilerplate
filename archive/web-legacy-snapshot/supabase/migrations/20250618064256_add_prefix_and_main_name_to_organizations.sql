-- 1. Dodajemy name_2 do organizations
ALTER TABLE public.organizations
ADD COLUMN name_2 TEXT;

-- 2. Dodajemy name_2 do organization_profiles
ALTER TABLE public.organization_profiles
ADD COLUMN name_2 TEXT;

-- 3. Wypełniamy name_2 w profiles (opcjonalnie kopiując ze starego name)
-- Tutaj nic nie kopiujemy, zostawiamy puste

-- 4. Modyfikujemy funkcję triggera
CREATE OR REPLACE FUNCTION update_org_profile_name_slug()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE organization_profiles
  SET
    name = NEW.name,
    name_2 = NEW.name_2,
    slug = NEW.slug
  WHERE organization_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Modyfikujemy trigger
DROP TRIGGER IF EXISTS trigger_update_org_profile_name_slug ON organizations;

CREATE TRIGGER trigger_update_org_profile_name_slug
AFTER UPDATE OF name, name_2, slug ON organizations
FOR EACH ROW
EXECUTE FUNCTION update_org_profile_name_slug();
