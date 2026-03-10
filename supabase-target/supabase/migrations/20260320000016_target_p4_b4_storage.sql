-- ============================================================
-- TARGET Phase 1 — Batch 4 / File 16
-- Storage: org-logos bucket, user-avatars bucket
--          + RLS policies for storage.objects
-- ============================================================
-- Purpose      : Create storage buckets and policies for
--                organization logos and user avatars.
-- Dependencies : is_org_member, has_permission (Batch 2 File 8)
-- Applied to   : TARGET project only
-- ============================================================
-- Bucket design:
--
--   org-logos (public bucket):
--     Path convention: {organization_id}/{filename}
--     Public read: anyone may view org logos (used in UI, emails).
--     Write/delete: org members with org.update permission only.
--     Policy uses is_org_member + has_permission('org.update').
--     Path extraction: storage.foldername(name)[1]::uuid = org_id.
--     Size limit: 5 MB (5242880 bytes).
--     MIME types: jpeg, png, webp, gif.
--
--   user-avatars (private bucket):
--     Path convention: {user_id}/{filename}
--     Private: no public read. Users may only access their own files.
--     Policy uses auth.uid()::text = storage.foldername(name)[1].
--     Size limit: 2 MB (2097152 bytes).
--     MIME types: jpeg, png, gif, webp.
--
-- LEGACY notes:
--   LEGACY has two org-logo buckets: 'organization-logos' (older,
--   weaker policies using auth.role()='authenticated' without
--   org-membership check) and 'org-logos' (newer, stricter policies
--   using is_org_member + has_permission). TARGET uses 'org-logos'
--   (the newer, stricter design) only.
--
--   user-avatars policies in LEGACY already use TO authenticated
--   with uid-based path checks. Preserved exactly.
--
--   org-logos policies in LEGACY already use TO authenticated
--   with is_org_member + has_permission checks. Preserved exactly.
--
--   All storage.objects policies run on the storage schema.
--   is_org_member and has_permission are in public schema —
--   referenced as public.is_org_member / public.has_permission.
-- ============================================================

-- ============================================================
-- Buckets
-- ON CONFLICT (id) DO NOTHING: idempotent re-apply.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-logos',
  'org-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

-- ============================================================
-- org-logos policies
--
-- Path: {organization_id}/filename
-- storage.foldername(name)[1] extracts the first path segment,
-- cast to uuid for is_org_member / has_permission lookups.
--
-- Public read: TO public (no authentication required).
--   Anyone may view org logos — used in invite previews, public
--   pages, emails.
--
-- Upload / Update / Delete: TO authenticated, org member with
--   org.update permission. Prevents arbitrary authenticated users
--   from writing to other orgs' logo paths.
-- ============================================================
create policy "org_logos_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'org-logos');

create policy "org_logos_upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] is not null
    and public.is_org_member((storage.foldername(name))[1]::uuid)
    and public.has_permission((storage.foldername(name))[1]::uuid, 'org.update')
  );

create policy "org_logos_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] is not null
    and public.is_org_member((storage.foldername(name))[1]::uuid)
    and public.has_permission((storage.foldername(name))[1]::uuid, 'org.update')
  )
  with check (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] is not null
    and public.is_org_member((storage.foldername(name))[1]::uuid)
    and public.has_permission((storage.foldername(name))[1]::uuid, 'org.update')
  );

create policy "org_logos_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'org-logos'
    and (storage.foldername(name))[1] is not null
    and public.is_org_member((storage.foldername(name))[1]::uuid)
    and public.has_permission((storage.foldername(name))[1]::uuid, 'org.update')
  );

-- ============================================================
-- user-avatars policies
--
-- Path: {user_id}/filename
-- storage.foldername(name)[1] extracts the first path segment.
-- Compared to auth.uid()::text — user can only access their
-- own avatar path (no cross-user access).
--
-- Private bucket: no public read policy.
--   Authenticated users may only read their own avatar.
-- ============================================================
create policy "user_avatars_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

create policy "user_avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

create policy "user_avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

create policy "user_avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );
