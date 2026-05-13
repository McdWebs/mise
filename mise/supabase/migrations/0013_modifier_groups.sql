-- Optional/required modifier groups per menu item.
-- e.g. "Sauces" (optional, multi) or "Cooking preference" (required, single-choice).

create table public.modifier_groups (
  id           uuid primary key default gen_random_uuid(),
  menu_item_id uuid    not null references public.menu_items(id) on delete cascade,
  name         text    not null,
  required     boolean not null default false,
  max_selections int,          -- null = unlimited; 1 = single-choice (radio)
  sort_order   int     not null default 0,
  created_at   timestamptz not null default now()
);

create table public.modifier_options (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid    not null references public.modifier_groups(id) on delete cascade,
  name        text    not null,
  price_cents int     not null default 0,
  sort_order  int     not null default 0,
  created_at  timestamptz not null default now()
);

create index modifier_groups_menu_item_id on public.modifier_groups (menu_item_id);
create index modifier_options_group_id    on public.modifier_options (group_id);

alter table public.modifier_groups  enable row level security;
alter table public.modifier_options enable row level security;

-- Guests (anon) can read all groups and options for any menu item
create policy "anyone reads modifier_groups"
  on public.modifier_groups for select using (true);

create policy "anyone reads modifier_options"
  on public.modifier_options for select using (true);

-- Owners can fully manage groups for their own menu items
create policy "owners manage modifier_groups"
  on public.modifier_groups for all
  using (
    menu_item_id in (
      select mi.id from public.menu_items mi
      join public.menu_categories mc on mc.id = mi.category_id
      join public.restaurant_members rm on rm.restaurant_id = mc.restaurant_id
      where rm.user_id = auth.uid()
    )
  )
  with check (
    menu_item_id in (
      select mi.id from public.menu_items mi
      join public.menu_categories mc on mc.id = mi.category_id
      join public.restaurant_members rm on rm.restaurant_id = mc.restaurant_id
      where rm.user_id = auth.uid()
    )
  );

-- Owners can fully manage options for groups they own
create policy "owners manage modifier_options"
  on public.modifier_options for all
  using (
    group_id in (
      select mg.id from public.modifier_groups mg
      join public.menu_items mi on mi.id = mg.menu_item_id
      join public.menu_categories mc on mc.id = mi.category_id
      join public.restaurant_members rm on rm.restaurant_id = mc.restaurant_id
      where rm.user_id = auth.uid()
    )
  )
  with check (
    group_id in (
      select mg.id from public.modifier_groups mg
      join public.menu_items mi on mi.id = mg.menu_item_id
      join public.menu_categories mc on mc.id = mi.category_id
      join public.restaurant_members rm on rm.restaurant_id = mc.restaurant_id
      where rm.user_id = auth.uid()
    )
  );
