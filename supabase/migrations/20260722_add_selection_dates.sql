ALTER TABLE cycles ADD COLUMN IF NOT EXISTS selection_start_date DATE;
ALTER TABLE cycles ADD COLUMN IF NOT EXISTS selection_end_date DATE;

-- Update existing cycles to have selection period match cycle period as a fallback
UPDATE cycles SET selection_start_date = start_date WHERE selection_start_date IS NULL;
UPDATE cycles SET selection_end_date = end_date WHERE selection_end_date IS NULL;
