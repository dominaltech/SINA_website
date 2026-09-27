-- ==============================================================================
-- SINA APP MIGRATION 21: RECEIPT FORMAT CUSTOMIZATION & FIRMS CRUD ENHANCEMENTS
-- ==============================================================================

-- 1. Enhance receipt_format_settings with company name, title, tagline, format style, and bank/gstin visibility
ALTER TABLE IF EXISTS public.receipt_format_settings
ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT 'SINA Recycling Limited',
ADD COLUMN IF NOT EXISTS receipt_title TEXT DEFAULT 'PROCUREMENT RECEIPT / BILL',
ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT 'Government Approved E-Waste & Metal Recycler',
ADD COLUMN IF NOT EXISTS receipt_format TEXT DEFAULT 'modern',
ADD COLUMN IF NOT EXISTS show_bank_details BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS show_gstin BOOLEAN DEFAULT TRUE;

-- Update existing default row if it has empty or outdated values
UPDATE public.receipt_format_settings
SET company_name = 'SINA Recycling Limited',
    receipt_title = COALESCE(receipt_title, 'PROCUREMENT RECEIPT / BILL'),
    tagline = COALESCE(tagline, 'Government Approved E-Waste & Metal Recycler')
WHERE company_name IS NULL OR company_name = 'SINA Agro Industries Ltd.';

-- 2. Ensure firms table has upi_id, is_active, and updated_at
ALTER TABLE IF EXISTS public.firms
ADD COLUMN IF NOT EXISTS upi_id TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Ensure public/anon and authenticated users have complete CRUD on firms table
DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all on firms" ON public.firms;
    CREATE POLICY "Allow all on firms" ON public.firms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
