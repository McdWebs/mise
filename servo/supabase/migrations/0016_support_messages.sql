create table if not exists public.support_messages (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  sender_role   text        not null check (sender_role in ('owner', 'platform')),
  body          text        not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists support_messages_restaurant_created_idx
  on public.support_messages(restaurant_id, created_at);

create index if not exists support_messages_unread_platform_idx
  on public.support_messages(restaurant_id) where sender_role = 'owner' and read_at is null;

alter table public.support_messages enable row level security;

create policy "restaurant members can manage their support messages"
  on public.support_messages
  for all
  to authenticated
  using (
    exists (
      select 1 from public.restaurant_members
      where restaurant_members.restaurant_id = support_messages.restaurant_id
        and restaurant_members.user_id = auth.uid()
    )
  );

create policy "super_admin full access to support messages"
  on public.support_messages
  for all
  to authenticated
  using (public.is_super_admin());

alter publication supabase_realtime add table public.support_messages;
