-- Optional time window for plans (guest UI filters by current time).
-- Run in Supabase SQL editor if you already applied 0002 without these columns.

alter table public.restaurant_plans
  add column if not exists start_time time,
  add column if not exists end_time time;
