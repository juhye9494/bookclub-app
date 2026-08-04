-- Add encrypted shipping PII columns to public.book_orders.
-- Existing plaintext columns remain temporarily for safe dual-read/dual-write migration.

alter table public.book_orders
  add column if not exists shipping_name_enc text,
  add column if not exists shipping_phone_enc text,
  add column if not exists shipping_address_enc text,
  add column if not exists pii_key_version smallint;

comment on column public.book_orders.shipping_name_enc
  is 'AES-256-GCM encrypted shipping recipient name';

comment on column public.book_orders.shipping_phone_enc
  is 'AES-256-GCM encrypted shipping phone number';

comment on column public.book_orders.shipping_address_enc
  is 'AES-256-GCM encrypted shipping address';

comment on column public.book_orders.pii_key_version
  is 'Encryption key version used for book order shipping PII';
