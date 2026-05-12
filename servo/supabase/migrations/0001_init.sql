-- =============================================================
-- Servo — initial schema
-- Run this in the Supabase SQL editor (Dashboard → SQL editor → New query)
-- =============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────
create type order_stage as enum (
  'received',
  'cooking',
  'ready',
  'picked_up',
  'cancelled'
);

create type user_role as enum (
  'guest',
  'owner',
  'super_admin'
);

create type member_role as enum (
  'owner',
  'staff'
);

create type assistance_kind as enum (
  'call_server',
  'other'
);

create type assistance_status as enum (
  'open',
  'resolved'
);

-- ── users ────────────────────────────────────────────────────
-- Extends Supabase auth.users. One row per authenticated user.
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        user_role not null default 'guest',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── restaurants ──────────────────────────────────────────────
create table public.restaurants (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  tagline          text,
  currency         text not null default 'CAD',
  accepting_orders boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── restaurant_members ───────────────────────────────────────
-- Joins users to restaurants. Owners must have a row here.
create table public.restaurant_members (
  user_id       uuid not null references public.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role          member_role not null default 'owner',
  primary key (user_id, restaurant_id)
);

-- ── menu_categories ──────────────────────────────────────────
create table public.menu_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── menu_items ───────────────────────────────────────────────
create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.menu_categories(id) on delete cascade,
  name          text not null,
  description   text,
  price_cents   integer not null check (price_cents >= 0),
  available     boolean not null default true,
  tags          text[] not null default '{}',
  image_url     text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── orders ───────────────────────────────────────────────────
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  table_label     text not null,
  stage           order_stage not null default 'received',
  subtotal_cents  integer not null check (subtotal_cents >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── order_items ──────────────────────────────────────────────
create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  menu_item_id    uuid not null references public.menu_items(id) on delete restrict,
  quantity        integer not null check (quantity > 0),
  modifiers       text[] not null default '{}',
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at      timestamptz not null default now()
);

-- ── assistance_requests ──────────────────────────────────────
create table public.assistance_requests (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_label   text not null,
  kind          assistance_kind not null default 'call_server',
  status        assistance_status not null default 'open',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── assistant_conversations ──────────────────────────────────
create table public.assistant_conversations (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_label   text not null,
  messages_jsonb jsonb not null default '[]',
  escalated     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =============================================================
-- Indexes
-- =============================================================
create index on public.orders (restaurant_id, stage);
create index on public.orders (restaurant_id, created_at desc);
create index on public.order_items (order_id);
create index on public.menu_items (category_id, sort_order);
create index on public.menu_categories (restaurant_id, sort_order);
create index on public.assistance_requests (restaurant_id, status);
create index on public.assistant_conversations (restaurant_id, created_at desc);

-- =============================================================
-- updated_at trigger
-- =============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.menu_categories
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.assistance_requests
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.assistant_conversations
  for each row execute function public.set_updated_at();

-- =============================================================
-- Row-level security
-- =============================================================
alter table public.users                   enable row level security;
alter table public.restaurants             enable row level security;
alter table public.restaurant_members      enable row level security;
alter table public.menu_categories         enable row level security;
alter table public.menu_items              enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.assistance_requests     enable row level security;
alter table public.assistant_conversations enable row level security;

-- Helper: is the calling user a super_admin?
create or replace function public.is_super_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- Helper: does the calling user have any role in a restaurant?
create or replace function public.is_restaurant_member(rid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.restaurant_members
    where user_id = auth.uid() and restaurant_id = rid
  );
$$;

-- ── users policies ───────────────────────────────────────────
create policy "users: read own row"
  on public.users for select
  using (id = auth.uid() or public.is_super_admin());

create policy "users: update own row"
  on public.users for update
  using (id = auth.uid());

create policy "users: super_admin full access"
  on public.users for all
  using (public.is_super_admin());

-- ── restaurants policies ─────────────────────────────────────
-- Guests can read any restaurant (to show the menu cover).
create policy "restaurants: public read"
  on public.restaurants for select
  using (true);

create policy "restaurants: members update own"
  on public.restaurants for update
  using (public.is_restaurant_member(id));

create policy "restaurants: super_admin full access"
  on public.restaurants for all
  using (public.is_super_admin());

-- ── restaurant_members policies ──────────────────────────────
create policy "members: read own memberships"
  on public.restaurant_members for select
  using (user_id = auth.uid() or public.is_super_admin());

create policy "members: super_admin full access"
  on public.restaurant_members for all
  using (public.is_super_admin());

-- ── menu_categories policies ─────────────────────────────────
create policy "menu_categories: public read"
  on public.menu_categories for select
  using (true);

create policy "menu_categories: members write own restaurant"
  on public.menu_categories for all
  using (public.is_restaurant_member(restaurant_id));

create policy "menu_categories: super_admin full access"
  on public.menu_categories for all
  using (public.is_super_admin());

-- ── menu_items policies ──────────────────────────────────────
create policy "menu_items: public read"
  on public.menu_items for select
  using (true);

create policy "menu_items: members write own restaurant"
  on public.menu_items for all
  using (
    exists (
      select 1 from public.menu_categories mc
      where mc.id = menu_items.category_id
        and public.is_restaurant_member(mc.restaurant_id)
    )
  );

create policy "menu_items: super_admin full access"
  on public.menu_items for all
  using (public.is_super_admin());

-- ── orders policies ──────────────────────────────────────────
-- Guests can insert orders (anonymous or authenticated).
create policy "orders: public insert"
  on public.orders for insert
  with check (true);

-- Guests can read their own order by ID (no auth needed — they store the ID client-side).
create policy "orders: public read by id"
  on public.orders for select
  using (true);

-- Members can read/update all orders for their restaurant.
create policy "orders: members read own restaurant"
  on public.orders for select
  using (public.is_restaurant_member(restaurant_id));

create policy "orders: members update own restaurant"
  on public.orders for update
  using (public.is_restaurant_member(restaurant_id));

create policy "orders: super_admin full access"
  on public.orders for all
  using (public.is_super_admin());

-- ── order_items policies ─────────────────────────────────────
create policy "order_items: public insert"
  on public.order_items for insert
  with check (true);

create policy "order_items: public read"
  on public.order_items for select
  using (true);

create policy "order_items: members read own restaurant"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.is_restaurant_member(o.restaurant_id)
    )
  );

create policy "order_items: super_admin full access"
  on public.order_items for all
  using (public.is_super_admin());

-- ── assistance_requests policies ─────────────────────────────
create policy "assistance_requests: public insert"
  on public.assistance_requests for insert
  with check (true);

create policy "assistance_requests: members read/update own restaurant"
  on public.assistance_requests for all
  using (public.is_restaurant_member(restaurant_id));

create policy "assistance_requests: super_admin full access"
  on public.assistance_requests for all
  using (public.is_super_admin());

-- ── assistant_conversations policies ─────────────────────────
create policy "assistant_conversations: public insert"
  on public.assistant_conversations for insert
  with check (true);

create policy "assistant_conversations: public update own"
  on public.assistant_conversations for update
  using (true);

create policy "assistant_conversations: members read own restaurant"
  on public.assistant_conversations for select
  using (public.is_restaurant_member(restaurant_id));

create policy "assistant_conversations: super_admin full access"
  on public.assistant_conversations for all
  using (public.is_super_admin());

-- =============================================================
-- auto-create users row on auth.user sign-up
-- =============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'guest')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
