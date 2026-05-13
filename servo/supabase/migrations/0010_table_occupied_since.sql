-- Track when a guest first enters a table's menu session.
-- Cleared by the waiter via clearTable(); set by guests via mark_table_occupied().

alter table public.table_status
  add column if not exists occupied_since timestamptz;

-- Security-definer function so anonymous guests can mark a table as occupied
-- without being able to touch any other column or clear the value.
create or replace function public.mark_table_occupied(p_table_id uuid, p_restaurant_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.table_status (table_id, restaurant_id, occupied_since, updated_at)
  values (p_table_id, p_restaurant_id, now(), now())
  on conflict (table_id) do update
    set occupied_since = coalesce(table_status.occupied_since, now()),
        updated_at     = now()
    where table_status.occupied_since is null;
end;
$$;

grant execute on function public.mark_table_occupied(uuid, uuid) to anon, authenticated;
