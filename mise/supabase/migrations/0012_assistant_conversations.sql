-- Persists every AI assistant exchange for owner analytics.
-- Each row is one guest conversation turn (user message + assistant reply).
-- The full message history is stored in messages_jsonb as an array of
-- { role: 'user' | 'assistant', content: string } objects.

create table if not exists public.assistant_conversations (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  table_label   text        not null,
  messages_jsonb jsonb      not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists assistant_conversations_restaurant_created
  on public.assistant_conversations (restaurant_id, created_at desc);

alter table public.assistant_conversations enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'assistant_conversations'
      and policyname = 'members read own conversations'
  ) then
    create policy "members read own conversations"
      on public.assistant_conversations for select
      using (
        restaurant_id in (
          select restaurant_id from public.restaurant_members
          where user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Only the service role (API) may insert — no anon/authenticated insert
