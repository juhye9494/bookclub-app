ALTER TABLE public.cycles
  ADD COLUMN IF NOT EXISTS activity_start_date date;
