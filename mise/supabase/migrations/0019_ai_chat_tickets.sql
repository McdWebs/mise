-- Add source to support_tickets to distinguish AI-chat tickets from human tickets
alter table public.support_tickets
  add column if not exists source text not null default 'user'
  check (source in ('user', 'ai'));

-- Extend sender_role to allow 'ai' messages saved from the support AI chat
alter table public.support_messages
  drop constraint if exists support_messages_sender_role_check;

alter table public.support_messages
  add constraint support_messages_sender_role_check
  check (sender_role in ('owner', 'platform', 'ai'));
