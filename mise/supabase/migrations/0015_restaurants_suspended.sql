alter table public.restaurants
  add column if not exists suspended boolean not null default false;
