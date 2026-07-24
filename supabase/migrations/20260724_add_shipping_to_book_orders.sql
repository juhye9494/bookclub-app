-- Migration: Add shipping info to book_orders

ALTER TABLE public.book_orders ADD COLUMN IF NOT EXISTS shipping_name text;
ALTER TABLE public.book_orders ADD COLUMN IF NOT EXISTS shipping_phone text;
ALTER TABLE public.book_orders ADD COLUMN IF NOT EXISTS shipping_address text;
