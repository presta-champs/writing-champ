-- Create storage bucket for AI-generated article images
-- This migration only runs if Supabase Storage is enabled (storage schema exists).
-- In local dev without storage, this is a no-op.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'article-images',
      'article-images',
      true,
      5242880, -- 5MB
      array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    )
    on conflict (id) do nothing;
  end if;
end
$$;

-- Policies are created only if the storage.objects table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    -- Allow authenticated users to upload images
    if not exists (select 1 from pg_policies where policyname = 'Authenticated users can upload article images' and tablename = 'objects') then
      execute 'create policy "Authenticated users can upload article images" on storage.objects for insert to authenticated with check (bucket_id = ''article-images'')';
    end if;

    -- Allow public read access
    if not exists (select 1 from pg_policies where policyname = 'Public can view article images' and tablename = 'objects') then
      execute 'create policy "Public can view article images" on storage.objects for select to public using (bucket_id = ''article-images'')';
    end if;

    -- Allow authenticated users to delete their uploads
    if not exists (select 1 from pg_policies where policyname = 'Authenticated users can delete article images' and tablename = 'objects') then
      execute 'create policy "Authenticated users can delete article images" on storage.objects for delete to authenticated using (bucket_id = ''article-images'')';
    end if;
  end if;
end
$$;
