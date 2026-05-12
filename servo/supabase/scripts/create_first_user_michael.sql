-- =============================================================
-- DEV ONLY — paste into Supabase Dashboard → SQL → New query → Run
--
-- Creates an Auth user (email + password) and links auth.identities
-- so email/password sign-in works. Uses pgcrypto for bcrypt hash.
--
-- After this runs, also run the OPTIONAL block if you need /kitchen:
-- owner role + membership on seeded Bistro Calanque.
--
-- Security: rotate this password after first login; do not commit
-- real credentials to a public repository.
--
-- If sign-in fails with a "weak password" style error: Dashboard →
-- Authentication → Providers → Email → relax "password strength" for
-- dev, OR use a password that satisfies your policy (mixed case,
-- digits, symbols — not digits-only like 12345678).
--
-- GoTrue expects auth.users token columns as '' not NULL; otherwise
-- sign-in returns 500 "Database error querying schema". See
-- github.com/supabase/auth/issues/1940
-- =============================================================

create extension if not exists "pgcrypto";

do $$
declare
  v_user_id       uuid := gen_random_uuid();
  v_email         text := 'michaelhalperin2@gmail.com';
  v_password      text := '12345678';
  v_encrypted_pw  text := crypt(v_password, gen_salt('bf'));
  v_restaurant_id uuid := 'a1b2c3d4-0001-0001-0001-000000000001'; -- from seed.sql
begin
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'User already exists: %', v_email;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  raise notice 'Created auth user % with id %', v_email, v_user_id;
end $$;

-- Trigger handle_new_user should have inserted public.users (role guest).

-- OPTIONAL — owner + Bistro Calanque staff (needed for /kitchen with your RLS)
update public.users
set role = 'owner'
where email = 'michaelhalperin2@gmail.com';

insert into public.restaurant_members (user_id, restaurant_id, role)
select u.id, 'a1b2c3d4-0001-0001-0001-000000000001'::uuid, 'owner'::member_role
from public.users u
where u.email = 'michaelhalperin2@gmail.com'
on conflict (user_id, restaurant_id) do update
set role = excluded.role;
