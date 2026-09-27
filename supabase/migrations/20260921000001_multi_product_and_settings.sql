-- ==============================================================================
-- Migration: 20260921000001_multi_product_and_settings.sql
-- Description:
--   1. Create app_settings table for dynamic Admin toggles (e.g. mandatory expense receipts).
--   2. Expand expenses category check to include fuel, food, bus, vehicle_repair, travel, misc.
--   3. Ensure receipt_url column in expenses table.
--   4. Ensure procurement_entries status supports 'pending', 'pending_approval', 'verified', 'completed', 'rejected'.
--   5. Support null category_id on products to allow field reps to add ad-hoc products.
--   6. Insert default general category if not exists.
-- ==============================================================================

-- 1. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users and anon (for PWA)
DROP POLICY IF EXISTS "Allow read app_settings" ON public.app_settings;
CREATE POLICY "Allow read app_settings" ON public.app_settings
    FOR SELECT USING (true);

-- Allow all operations for service role and anon/admins
DROP POLICY IF EXISTS "Allow all on app_settings for service role / admin" ON public.app_settings;
CREATE POLICY "Allow all on app_settings for service role / admin" ON public.app_settings
    FOR ALL USING (true);

-- Seed initial settings
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('require_expense_receipt', 'false', 'Whether field reps must upload receipt photos before saving expenses')
ON CONFLICT (key) DO NOTHING;

-- 2. Expand Expenses Categories & Ensure receipt_url
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check 
    CHECK (category IN ('fuel', 'food', 'travel', 'bus', 'vehicle_repair', 'vehicle_maintenance', 'toll_market', 'misc'));

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 3. Ensure procurement_entries status values
ALTER TABLE public.procurement_entries DROP CONSTRAINT IF EXISTS procurement_entries_status_check;
ALTER TABLE public.procurement_entries ADD CONSTRAINT procurement_entries_status_check 
    CHECK (status IN ('pending', 'pending_approval', 'verified', 'completed', 'rejected'));

-- 4. Allow null category_id on products (for ad-hoc products added from field)
ALTER TABLE public.products ALTER COLUMN category_id DROP NOT NULL;

-- 5. Create default general category if not exists
INSERT INTO public.categories (name, is_active)
VALUES ('General / Field Added', true)
ON CONFLICT (name) DO NOTHING;
