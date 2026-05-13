-- PostgREST / Supabase Data API: ensure roles can use tables created in 0005.
-- Without these, writes can fail with permission denied even when RLS policies allow the row.

grant select, insert, update, delete on public.tables to authenticated;
grant select, insert, update, delete on public.table_status to authenticated;
grant select, insert, update, delete on public.waiter_calls to authenticated;

-- Guest flows: read active floor (RLS still applies); ring waiter without auth.
grant select on public.tables to anon;
grant insert on public.waiter_calls to anon;
