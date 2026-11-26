-- Modules declare their own collections (letters, transparency, client modules...): the server
-- already accepts only the collections of the app's config, so the fixed list in 0002 is dropped.
alter table public.app_data drop constraint if exists app_data_collection_check;
