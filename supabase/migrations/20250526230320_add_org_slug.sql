-- =============================================
-- Migration: Add slug field to organizations table (safe for existing data)
-- =============================================

-- 1. Add the column as nullable
alter table organizations
add column if not exists slug text;

-- 2. Backfill slugs for existing orgs (simple slugify from name)
update organizations
set slug = lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g'))
where slug is null;

-- 3. (Manually resolve any duplicate slugs here if needed)
-- If you have duplicate org names, you must resolve them before proceeding.

-- 4. Add constraints
alter table organizations
alter column slug set not null;
alter table organizations
add constraint organizations_slug_key unique (slug);

comment on column organizations.slug is 'Unique, URL-friendly identifier for the organization.';
