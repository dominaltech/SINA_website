-- ==============================================================================
-- Migration: 20260923000013_commodity_category_and_types.sql
-- Description:
--   1. Add 'type' column to procurement_items to store line item grade/variety.
--   2. Create public.product_types table to allow Admin to manage Types per Category.
--   3. Pre-seed common types and sync types from existing products.
-- ==============================================================================

-- 1. Ensure type column exists on procurement_items
ALTER TABLE public.procurement_items ADD COLUMN IF NOT EXISTS type TEXT;

-- 2. Create product_types table for Category Types Master
CREATE TABLE IF NOT EXISTS public.product_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category_name, name)
);

-- Enable RLS
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

-- Allow read & write access for authenticated users and anon (PWA/Mobile)
DROP POLICY IF EXISTS "Allow all access to product_types" ON public.product_types;
CREATE POLICY "Allow all access to product_types" ON public.product_types 
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Populate product_types from existing products table
INSERT INTO public.product_types (category_id, category_name, name)
SELECT DISTINCT 
    p.category_id, 
    COALESCE(c.name, 'General') AS category_name, 
    p.type AS name
FROM public.products p
LEFT JOIN public.categories c ON c.id = p.category_id
WHERE p.type IS NOT NULL AND p.type != '' AND p.type != 'Standard'
ON CONFLICT (category_name, name) DO NOTHING;

-- 4. Seed Standard Commodity & Types for Immediate Field Selection
DO $$
DECLARE
    cat_cotton_id UUID;
    cat_grains_id UUID;
BEGIN
    -- Ensure standard categories exist
    INSERT INTO public.categories (name, is_active)
    VALUES ('Cotton & Fibre', true)
    ON CONFLICT (name) DO UPDATE SET is_active = true
    RETURNING id INTO cat_cotton_id;
    IF cat_cotton_id IS NULL THEN
        SELECT id INTO cat_cotton_id FROM public.categories WHERE name = 'Cotton & Fibre';
    END IF;

    INSERT INTO public.categories (name, is_active)
    VALUES ('Grains & Pulses', true)
    ON CONFLICT (name) DO UPDATE SET is_active = true
    RETURNING id INTO cat_grains_id;
    IF cat_grains_id IS NULL THEN
        SELECT id INTO cat_grains_id FROM public.categories WHERE name = 'Grains & Pulses';
    END IF;

    -- Pre-seed Cotton Types
    INSERT INTO public.product_types (category_id, category_name, name)
    VALUES 
        (cat_cotton_id, 'Cotton & Fibre', '32mm'),
        (cat_cotton_id, 'Cotton & Fibre', '28mm'),
        (cat_cotton_id, 'Cotton & Fibre', 'Shankar-6'),
        (cat_cotton_id, 'Cotton & Fibre', 'DCH-32'),
        (cat_cotton_id, 'Cotton & Fibre', 'MCU-5'),
        (cat_cotton_id, 'Cotton & Fibre', 'Organic Cotton')
    ON CONFLICT (category_name, name) DO NOTHING;

    -- Pre-seed Grains Types
    INSERT INTO public.product_types (category_id, category_name, name)
    VALUES 
        (cat_grains_id, 'Grains & Pulses', 'Sharbati'),
        (cat_grains_id, 'Grains & Pulses', 'Super 1121'),
        (cat_grains_id, 'Grains & Pulses', 'Lokwan'),
        (cat_grains_id, 'Grains & Pulses', 'Desi Polished'),
        (cat_grains_id, 'Grains & Pulses', 'Grade A')
    ON CONFLICT (category_name, name) DO NOTHING;
END $$;
