alter table public.event_participants
  add column if not exists user_name_enc text,
  add column if not exists user_email_enc text,
  add column if not exists pii_key_version smallint;
