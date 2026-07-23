BEGIN;

ALTER TABLE public.book_orders
ADD COLUMN IF NOT EXISTS tracking_number text NOT NULL DEFAULT '';

COMMIT;
