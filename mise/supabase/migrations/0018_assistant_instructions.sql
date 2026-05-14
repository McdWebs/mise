alter table public.restaurants
  add column if not exists assistant_instructions text;
