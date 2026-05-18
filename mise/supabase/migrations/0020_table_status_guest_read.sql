-- Guests need cleared_at / occupied_since for session turnover (QR menu).
-- Kitchen staff already have full member access via 0005.

grant select on public.table_status to anon;

create policy "table_status: guest read active table session"
  on public.table_status for select
  using (
    exists (
      select 1 from public.tables t
      where t.id = table_id and t.active = true
    )
  );
