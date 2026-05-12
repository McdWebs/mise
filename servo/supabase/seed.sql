-- =============================================================
-- Servo — seed data: Bistro Calanque
-- Run AFTER 0001_init.sql in the Supabase SQL editor.
-- =============================================================

-- Use fixed UUIDs so this is idempotent (re-runnable).
do $$
declare
  v_restaurant_id uuid := 'a1b2c3d4-0001-0001-0001-000000000001';
  v_cat_starters  uuid := 'a1b2c3d4-0002-0001-0001-000000000001';
  v_cat_mains     uuid := 'a1b2c3d4-0002-0002-0001-000000000001';
  v_cat_sides     uuid := 'a1b2c3d4-0002-0003-0001-000000000001';
  v_cat_drinks    uuid := 'a1b2c3d4-0002-0004-0001-000000000001';
  v_cat_desserts  uuid := 'a1b2c3d4-0002-0005-0001-000000000001';
begin

  -- ── Restaurant ──────────────────────────────────────────────
  insert into public.restaurants (id, slug, name, tagline, currency, accepting_orders)
  values (
    v_restaurant_id,
    'bistro-calanque',
    'Bistro Calanque',
    'Modern Provençal · Mile End',
    'CAD',
    true
  )
  on conflict (id) do update set
    slug             = excluded.slug,
    name             = excluded.name,
    tagline          = excluded.tagline,
    currency         = excluded.currency,
    accepting_orders = excluded.accepting_orders;

  -- ── Categories ──────────────────────────────────────────────
  insert into public.menu_categories (id, restaurant_id, name, sort_order) values
    (v_cat_starters, v_restaurant_id, 'Starters',  0),
    (v_cat_mains,    v_restaurant_id, 'Mains',     1),
    (v_cat_sides,    v_restaurant_id, 'Sides',     2),
    (v_cat_drinks,   v_restaurant_id, 'Drinks',    3),
    (v_cat_desserts, v_restaurant_id, 'Desserts',  4)
  on conflict (id) do update set
    name       = excluded.name,
    sort_order = excluded.sort_order;

  -- ── Starters ────────────────────────────────────────────────
  insert into public.menu_items
    (id, category_id, name, description, price_cents, available, tags, sort_order)
  values
    (
      'a1b2c3d4-0003-0001-0001-000000000001',
      v_cat_starters,
      'Pan con tomate',
      'Toasted country bread, ripe tomato, garlic, olive oil.',
      900,
      true,
      array['Vegan'],
      0
    ),
    (
      'a1b2c3d4-0003-0002-0001-000000000001',
      v_cat_starters,
      'Burrata, summer peach',
      'Stracciatella heart, grilled peach, basil oil, sea salt.',
      1700,
      true,
      array['Vegetarian'],
      1
    ),
    (
      'a1b2c3d4-0003-0003-0001-000000000001',
      v_cat_starters,
      'Anchovies on toast',
      'Cantabrian anchovy, butter, lemon zest.',
      1400,
      true,
      array['Contains fish'],
      2
    )
  on conflict (id) do update set
    name        = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    available   = excluded.available,
    tags        = excluded.tags,
    sort_order  = excluded.sort_order;

  -- ── Mains ───────────────────────────────────────────────────
  insert into public.menu_items
    (id, category_id, name, description, price_cents, available, tags, sort_order)
  values
    (
      'a1b2c3d4-0003-0004-0001-000000000001',
      v_cat_mains,
      'Wild mushroom tagliatelle',
      'Hand-cut pasta, chanterelles, brown butter, aged parmesan.',
      2400,
      true,
      array['Vegetarian'],
      0
    ),
    (
      'a1b2c3d4-0003-0005-0001-000000000001',
      v_cat_mains,
      'Bavette steak, salsa verde',
      'Grass-fed flank, charred peppers, fennel salt.',
      3200,
      true,
      array['Spicy'],
      1
    ),
    (
      'a1b2c3d4-0003-0006-0001-000000000001',
      v_cat_mains,
      'Whole grilled bream',
      'Lemon, fennel pollen, brown butter capers. For one.',
      3600,
      true,
      array[]::text[],
      2
    ),
    (
      'a1b2c3d4-0003-0007-0001-000000000001',
      v_cat_mains,
      'Chicken Milanese',
      'Crisp cutlet, arugula, lemon.',
      2600,
      false,   -- marked unavailable in owner kit
      array[]::text[],
      3
    )
  on conflict (id) do update set
    name        = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    available   = excluded.available,
    tags        = excluded.tags,
    sort_order  = excluded.sort_order;

  -- ── Sides ───────────────────────────────────────────────────
  insert into public.menu_items
    (id, category_id, name, description, price_cents, available, tags, sort_order)
  values
    (
      'a1b2c3d4-0003-0008-0001-000000000001',
      v_cat_sides,
      'Charred broccolini',
      'Anchovy, chili, lemon, smoked almond.',
      1400,
      true,
      array['Spicy'],
      0
    ),
    (
      'a1b2c3d4-0003-0009-0001-000000000001',
      v_cat_sides,
      'Frites, aioli',
      'Twice-cooked, sea salt, garlic aioli.',
      900,
      true,
      array['Vegetarian'],
      1
    )
  on conflict (id) do update set
    name        = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    available   = excluded.available,
    tags        = excluded.tags,
    sort_order  = excluded.sort_order;

  -- ── Drinks ──────────────────────────────────────────────────
  insert into public.menu_items
    (id, category_id, name, description, price_cents, available, tags, sort_order)
  values
    (
      'a1b2c3d4-0003-0010-0001-000000000001',
      v_cat_drinks,
      'Negroni',
      'Campari, Carpano Antica, Tanqueray. Stirred over a big rock.',
      1500,
      true,
      array[]::text[],
      0
    ),
    (
      'a1b2c3d4-0003-0011-0001-000000000001',
      v_cat_drinks,
      'House red — Côtes du Rhône',
      'By the glass. Grenache-syrah, light tannin.',
      1300,
      true,
      array[]::text[],
      1
    )
  on conflict (id) do update set
    name        = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    available   = excluded.available,
    tags        = excluded.tags,
    sort_order  = excluded.sort_order;

  -- Desserts category is seeded empty — owner can add items.

end;
$$;
