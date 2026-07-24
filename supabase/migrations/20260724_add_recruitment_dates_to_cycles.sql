ALTER TABLE public.cycles
  ADD COLUMN IF NOT EXISTS recruitment_start_date date;

ALTER TABLE public.cycles
  ADD COLUMN IF NOT EXISTS recruitment_end_date date;