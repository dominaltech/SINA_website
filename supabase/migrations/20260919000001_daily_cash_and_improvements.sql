-- ==============================================================================
-- SINA APP & SINA ADMIN: MIGRATION 20260919000001
-- Description: Daily cash given improvements, unique constraint for PostgREST on_conflict,
--              updated_at tracking, and autocomplete indexes for categories and products.
-- ==============================================================================

-- 1. Ensure explicit unique constraint on daily_floats for PostgREST on_conflict upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'daily_floats_representative_id_date_key'
    ) THEN
        ALTER TABLE public.daily_floats 
            ADD CONSTRAINT daily_floats_representative_id_date_key UNIQUE (representative_id, date);
    END IF;
END $$;

-- 2. Add updated_at to daily_floats for tracking last modifications
ALTER TABLE public.daily_floats 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Case-insensitive search indexes for high-speed autocomplete on categories & products
CREATE INDEX IF NOT EXISTS idx_categories_name_lower ON public.categories (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_products_name_lower ON public.products (LOWER(name));

-- 4. Case-insensitive search index on firms
CREATE INDEX IF NOT EXISTS idx_firms_name_lower ON public.firms (LOWER(firm_name));
