alter table public.book_orders
add column if not exists delivery_note_enc text;

comment on column public.book_orders.delivery_note_enc is
  'AES-256-GCM encrypted delivery instruction. Never store plaintext delivery notes.';
