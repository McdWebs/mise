-- Allow order lines that reference a restaurant_plan instead of a menu_item.

alter table public.order_items
  add column if not exists restaurant_plan_id uuid references public.restaurant_plans(id) on delete set null;

alter table public.order_items
  alter column menu_item_id drop not null;

alter table public.order_items
  drop constraint if exists order_items_menu_item_id_fkey;

alter table public.order_items
  add constraint order_items_menu_item_id_fkey
  foreign key (menu_item_id) references public.menu_items(id) on delete restrict;

alter table public.order_items
  drop constraint if exists order_items_one_line_kind;

alter table public.order_items
  add constraint order_items_one_line_kind check (
    (menu_item_id is not null and restaurant_plan_id is null)
    or (menu_item_id is null and restaurant_plan_id is not null)
  );
