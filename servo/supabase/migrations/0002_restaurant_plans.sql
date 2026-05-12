-- ── restaurant_plans ─────────────────────────────────────────
-- Fixed-price plans shown to guests (and managed in admin).
-- Apply in Dashboard → SQL → New query, or: supabase db push / migration up

create table public.restaurant_plans (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  title           text not null,
  description     text,
  price_cents     integer not null check (price_cents >= 0),
  includes        text[] not null default '{}',
  active          boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index restaurant_plans_restaurant_sort_idx
  on public.restaurant_plans (restaurant_id, sort_order);

create trigger set_updated_at before update on public.restaurant_plans
  for each row execute function public.set_updated_at();

alter table public.restaurant_plans enable row level security;

-- Guests: only active plans. Members: all plans for their restaurant.
create policy "restaurant_plans: select active or member"
  on public.restaurant_plans for select
  using (
    active = true
    or public.is_restaurant_member(restaurant_id)
    or public.is_super_admin()
  );

create policy "restaurant_plans: members insert"
  on public.restaurant_plans for insert
  with check (public.is_restaurant_member(restaurant_id));

create policy "restaurant_plans: members update"
  on public.restaurant_plans for update
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

create policy "restaurant_plans: members delete"
  on public.restaurant_plans for delete
  using (public.is_restaurant_member(restaurant_id));

create policy "restaurant_plans: super_admin all"
  on public.restaurant_plans for all
  using (public.is_super_admin());
