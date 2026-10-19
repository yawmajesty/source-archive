-- ─────────────────────────────────────────────────────────────
-- Seeing what storage actually costs.
--
-- The obvious way to total this up is the storage API, one directory at a
-- time. I tried it: a recursive walk of ten buckets had not finished after
-- two minutes, because every folder is another round trip. Storage keeps
-- every object in one table with its size in the metadata, so the same
-- answer is one query — it just needs exposing, since PostgREST only sees
-- the public schema.
--
-- SECURITY DEFINER because storage.objects is not readable by the
-- application's role, and these return aggregates and paths rather than any
-- file's contents. Execute is granted to signed-in users only; the page
-- that calls them is already admin-gated in the app.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS TABLE (bucket_id TEXT, file_count BIGINT, total_bytes BIGINT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, storage
AS $$
  SELECT
    o.bucket_id::TEXT,
    count(*)::BIGINT,
    -- Size lives in the metadata jsonb and is absent on a handful of older
    -- rows, so a null coalesces to zero rather than voiding the sum.
    coalesce(sum(coalesce((o.metadata->>'size')::BIGINT, 0)), 0)::BIGINT
  FROM storage.objects o
  GROUP BY o.bucket_id
  ORDER BY 3 DESC;
$$;

-- What is actually taking the room up. Without this the total tells you
-- there is a problem and nothing about where it is.
CREATE OR REPLACE FUNCTION public.storage_largest(limit_rows INT DEFAULT 25)
RETURNS TABLE (bucket_id TEXT, name TEXT, bytes BIGINT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, storage
AS $$
  SELECT
    o.bucket_id::TEXT,
    o.name::TEXT,
    coalesce((o.metadata->>'size')::BIGINT, 0)::BIGINT,
    o.created_at
  FROM storage.objects o
  ORDER BY coalesce((o.metadata->>'size')::BIGINT, 0) DESC
  LIMIT greatest(1, least(limit_rows, 200));
$$;

-- Anonymous callers have no business totalling the storage bill.
REVOKE ALL ON FUNCTION public.storage_usage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.storage_largest(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_usage() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.storage_largest(INT) TO authenticated, service_role;
