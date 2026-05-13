-- Broadcast waiter_calls changes to subscribed clients (postgres_changes).
do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'waiter_calls'
  ) then
    alter publication supabase_realtime add table public.waiter_calls;
  end if;
end
$migration$;
