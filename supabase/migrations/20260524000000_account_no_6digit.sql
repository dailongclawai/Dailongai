-- Add 6-digit sequential account_no to profiles (start 100001) — simpler ID
-- for end users than full UUID. UUID stays as primary key for everything else.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_no INTEGER UNIQUE;

CREATE SEQUENCE IF NOT EXISTS public.profiles_account_no_seq
    START WITH 100001 MINVALUE 100001 INCREMENT BY 1;

-- Backfill existing rows ordered by created_at (oldest = smallest account_no)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) + 100000 AS new_no
  FROM public.profiles
  WHERE account_no IS NULL
)
UPDATE public.profiles p
   SET account_no = n.new_no
  FROM numbered n
 WHERE p.id = n.id;

-- Move sequence head past any existing values
SELECT setval(
  'public.profiles_account_no_seq',
  GREATEST(COALESCE((SELECT MAX(account_no) FROM public.profiles), 100000), 100000)
);

-- Future inserts auto-assign next number
ALTER TABLE public.profiles
  ALTER COLUMN account_no SET DEFAULT nextval('public.profiles_account_no_seq'),
  ALTER COLUMN account_no SET NOT NULL;

-- Index for fast lookup by account_no (e.g. "find user by 100001")
CREATE INDEX IF NOT EXISTS idx_profiles_account_no ON public.profiles(account_no);

-- Expose dealer_account_no in supervisor_team_summary so UI can show it.
-- DROP + CREATE because CREATE OR REPLACE forbids inserting a column in the middle.
DROP VIEW IF EXISTS public.supervisor_team_summary;
CREATE VIEW public.supervisor_team_summary
WITH (security_invoker = true) AS
SELECT
    p.supervisor_id,
    p.id AS dealer_id,
    p.account_no AS dealer_account_no,
    p.full_name AS dealer_name,
    count(o.*) FILTER (WHERE o.status = 'pending') AS orders_pending,
    count(o.*) FILTER (WHERE o.status IN ('approved','paid') AND date_part('year', o.sale_date) = date_part('year', now())) AS units_ytd,
    coalesce(sum(o.sale_price) FILTER (WHERE date_part('year', o.sale_date) = date_part('year', now()) AND date_part('month', o.sale_date) = date_part('month', now())), 0) AS month_sales
FROM public.profiles p
LEFT JOIN public.orders o ON o.dealer_id = p.id
WHERE p.role = 'dealer'
GROUP BY p.supervisor_id, p.id, p.account_no, p.full_name;
