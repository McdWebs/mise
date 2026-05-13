-- Broadcast order INSERT/UPDATE to subscribed kitchen clients (postgres_changes).
-- Without this, the table is not in the replication publication and realtime never fires.
do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$migration$;
