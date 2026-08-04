-- 20260804_add_inquiries_pii_encryption_columns.sql
alter table public.inquiries
  add column if not exists user_name_enc text,
  add column if not exists user_email_enc text,
  add column if not exists user_phone_enc text,
  add column if not exists pii_key_version smallint;

comment on column public.inquiries.user_name_enc is 'Encrypted user name (AES-256-GCM)';
comment on column public.inquiries.user_email_enc is 'Encrypted user email (AES-256-GCM)';
comment on column public.inquiries.user_phone_enc is 'Encrypted user phone (AES-256-GCM)';
comment on column public.inquiries.pii_key_version is 'Key version used for encryption';
