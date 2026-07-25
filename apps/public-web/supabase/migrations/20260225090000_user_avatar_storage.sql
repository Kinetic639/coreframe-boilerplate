-- Migration: user_avatar_storage
-- Purpose: Add avatar_path to users table; secure user-avatars storage bucket with per-user RLS policies.
-- Related module: user-account
-- Date: 2026-02-25

-- ---------------------------------------------------------------------------
-- 1. Add avatar_path column to public.users
-- ---------------------------------------------------------------------------
-- Stores the Supabase Storage object path (e.g. "user-uuid/random-uuid.ext").
-- This is NOT a public URL — signed URLs are generated server-side per request.
-- avatar_url column is retained for OAuth provider avatar URLs (no change).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_path TEXT NULL;

-- ---------------------------------------------------------------------------
-- 2. Make user-avatars bucket private
-- ---------------------------------------------------------------------------
-- The bucket was incorrectly set to public = TRUE, allowing anyone to construct
-- a public URL for any user's avatar. Now requires authenticated access + RLS.
UPDATE storage.buckets SET public = FALSE WHERE id = 'user-avatars';

-- ---------------------------------------------------------------------------
-- 3. Drop existing overly-permissive policies for user-avatars
-- ---------------------------------------------------------------------------
-- These only checked bucket_id — any authenticated user could read or write
-- any object in the bucket, including other users' avatars.
DROP POLICY IF EXISTS "Authenticated can insert user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can select user avatars" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 4. Add user-scoped storage policies for user-avatars
-- ---------------------------------------------------------------------------
-- Each user can ONLY access objects whose path starts with their own user-id/.
-- Object paths MUST follow the pattern: {auth.uid()}/{filename}
-- storage.foldername(name)[1] extracts the first path segment (the user-id folder).

CREATE POLICY "user_avatars_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_avatars_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_avatars_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_avatars_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
