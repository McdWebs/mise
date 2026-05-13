-- Floor plan + waiter-call signals (kitchen / guest).
-- Apply to your Supabase project: `supabase db push` or paste in SQL editor.

-- ── tables ─────────────────────────────────────────────────
create table public.tables (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  label           text not null,
  seats           integer not null default 4 check (seats > 0 and seats <= 99),
  sort_order      integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (restaurant_id, label)
);

create index tables_restaurant_active_sort_idx
  on public.tables (restaurant_id, active, sort_order);

-- ── table_status (one row per table; ops metadata) ───────────
create table public.table_status (
  table_id        uuid primary key references public.tables(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  waiter_name     text,
  merged_into     uuid references public.tables(id) on delete set null,
  notes           text,
  updated_at      timestamptz not null default now()
);

create index table_status_restaurant_idx
  on public.table_status (restaurant_id);

create trigger set_updated_at before update on public.table_status
  for each row execute function public.set_updated_at();

-- ── waiter_calls (guest rings; staff acknowledges) ───────────
create table public.waiter_calls (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants(id) on delete cascade,
  table_label       text not null,
  called_at         timestamptz not null default now(),
  acknowledged_at   timestamptz
);

create index waiter_calls_restaurant_called_idx
  on public.waiter_calls (restaurant_id, called_at desc);

create index waiter_calls_pending_idx
  on public.waiter_calls (restaurant_id)
  where acknowledged_at is null;

-- ── RLS ─────────────────────────────────────────────────────
alter table public.tables         enable row level security;
alter table public.table_status   enable row level security;
alter table public.waiter_calls   enable row level security;

-- Guests resolve table by label; staff see inactive too.
create policy "tables: select active or member"
  on public.tables for select
  using (
    (active = true)
    or public.is_restaurant_member(restaurant_id)
    or public.is_super_admin()
  );

create policy "tables: members write"
  on public.tables for insert
  with check (public.is_restaurant_member(restaurant_id));

create policy "tables: members update"
  on public.tables for update
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

create policy "tables: members delete"
  on public.tables for delete
  using (public.is_restaurant_member(restaurant_id));

create policy "tables: super_admin all"
  on public.tables for all
  using (public.is_super_admin());

create policy "table_status: members all"
  on public.table_status for all
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));

create policy "table_status: super_admin all"
  on public.table_status for all
  using (public.is_super_admin());

-- Same pattern as orders: anonymous guests can signal the kitchen.
create policy "waiter_calls: public insert"
  on public.waiter_calls for insert
  with check (true);

create policy "waiter_calls: members read own"
  on public.waiter_calls for select
  using (public.is_restaurant_member(restaurant_id) or public.is_super_admin());

create policy "waiter_calls: members update own"
  on public.waiter_calls for update
  using (public.is_restaurant_member(restaurant_id));

create policy "waiter_calls: super_admin all"
  on public.waiter_calls for all
  using (public.is_super_admin());
