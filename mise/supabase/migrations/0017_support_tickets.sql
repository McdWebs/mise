-- Support tickets: each thread belongs to a topic-tagged ticket
create table if not exists public.support_tickets (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  topic         text        not null,
  status        text        not null default 'open' check (status in ('open', 'closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists support_tickets_restaurant_idx
  on public.support_tickets(restaurant_id, created_at desc);

-- Link existing + future messages to a ticket (nullable for legacy rows)
alter table public.support_messages
  add column if not exists ticket_id uuid references public.support_tickets(id) on delete cascade;

create index if not exists support_messages_ticket_idx
  on public.support_messages(ticket_id, created_at);

-- RLS
alter table public.support_tickets enable row level security;

create policy "restaurant members can manage their tickets"
  on public.support_tickets for all to authenticated
  using (exists (
    select 1 from public.restaurant_members
    where restaurant_members.restaurant_id = support_tickets.restaurant_id
      and restaurant_members.user_id = auth.uid()
  ));

create policy "super_admin full access to tickets"
  on public.support_tickets for all to authenticated
  using (public.is_super_admin());

alter publication supabase_realtime add table public.support_tickets;
