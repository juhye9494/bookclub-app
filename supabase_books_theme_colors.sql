ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS "bg" text,
ADD COLUMN IF NOT EXISTS "bgDark" text;

NOTIFY pgrst, 'reload schema';
