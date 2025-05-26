-- =============================================
-- Migration: Add slug field to organizations table
-- =============================================

alter table organizations
add column if not exists slug text unique not null default '',
alter column slug drop default;

comment on column organizations.slug is 'Unique, URL-friendly identifier for the organization.'; 