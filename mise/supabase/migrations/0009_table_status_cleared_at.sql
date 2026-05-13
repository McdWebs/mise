-- Guest/kitchen use `cleared_at` to reset order visibility after table turnover.
alter table public.table_status
  add column if not exists cleared_at timestamptz;
