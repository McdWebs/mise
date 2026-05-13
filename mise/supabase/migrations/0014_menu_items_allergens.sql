alter table public.menu_items
  add column if not exists allergens text[] not null default '{}';
