INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('receipts', 'receipts', FALSE, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
    ('sales-docs', 'sales-docs', FALSE, 52428800, ARRAY['application/pdf','image/jpeg','image/png','image/webp','video/mp4'])
ON CONFLICT (id) DO NOTHING;
