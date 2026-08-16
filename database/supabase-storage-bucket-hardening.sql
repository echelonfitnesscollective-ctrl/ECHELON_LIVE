-- Server-side backstop for file uploads (audit finding: every upload path
-- only validated file type via the browser's <input accept> attribute and
-- the client-supplied file.type, both trivially spoofable with devtools or
-- a direct API call). Uploads go straight from the browser to Supabase
-- Storage with no server proxy in between, so the bucket-level
-- allowed_mime_types/file_size_limit settings below are the real
-- enforcement point -- they mirror the limits already used client-side,
-- they don't change what's actually allowed for a normal user.
--
-- Run this once in the Supabase SQL Editor.

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
    file_size_limit = 8388608 -- 8MB
where id = 'progress-photos';

update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg'],
    file_size_limit = 15728640 -- 15MB
where id = 'member-library';

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
    file_size_limit = 31457280 -- 30MB
where id = 'site-media';
