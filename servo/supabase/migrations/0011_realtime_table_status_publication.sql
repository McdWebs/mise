-- Broadcast table_status changes to subscribed clients (postgres_changes).
-- Required for both the kitchen floor (occupied/free updates) and the guest
-- page (detecting cleared_at changes to wipe the previous guest's cart).
do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_status'
  ) then
    alter publication supabase_realtime add table public.table_status;
  end if;
end
$migration$;
