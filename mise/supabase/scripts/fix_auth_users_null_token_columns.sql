-- =============================================================
-- One-time repair: SQL-created auth.users rows often have NULL
-- in token columns; GoTrue then returns 500 "Database error
-- querying schema" on /auth/v1/token (sign-in).
--
-- Run in Supabase SQL Editor after creating users by hand.
-- Safe to run multiple times.
-- =============================================================

update auth.users
set
  confirmation_token     = coalesce(confirmation_token, ''),
  email_change           = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  recovery_token         = coalesce(recovery_token, '')
where confirmation_token is null
   or email_change is null
   or email_change_token_new is null
   or recovery_token is null;

-- Optional: only your dev user
-- update auth.users
-- set confirmation_token = '', email_change = '', email_change_token_new = '', recovery_token = ''
-- where email = 'michaelhalperin2@gmail.com';
