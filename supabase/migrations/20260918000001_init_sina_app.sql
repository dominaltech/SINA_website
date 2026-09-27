-- ==============================================================================
-- SINA APP & SINA ADMIN: SUPABASE DATABASE INITIALIZATION MIGRATION
-- Project: https://hlwmsllmqfdxfmqulrat.supabase.co
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES / USERS TABLE
-- Handles Representatives and Admin users with their credentials & roles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL, -- Stored securely / readable for admin credential management
    role TEXT NOT NULL CHECK (role IN ('admin', 'representative')),
    assigned_route TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. FIRMS TABLE
-- Pre-set firms list + dynamically added firms with contact and address
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.firms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    mobile TEXT NOT NULL,
    address TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_firms_name ON public.firms(firm_name);

-- ------------------------------------------------------------------------------
-- 3. CATEGORIES & PRODUCTS MASTER
-- Manageable by Admin; unit options: per_kg, per_piece, per_bag
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    default_unit TEXT NOT NULL CHECK (default_unit IN ('per_kg', 'per_piece', 'per_bag')),
    default_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. DAILY CASH FLOATS
-- Morning cash issued by Admin to representatives for field operations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_floats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    representative_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    float_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(representative_id, date)
);

-- ------------------------------------------------------------------------------
-- 5. FIELD EXPENSES
-- Travel, food, and other expenses incurred by representatives in the field
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    representative_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10, 2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('fuel', 'food', 'travel', 'vehicle_maintenance', 'misc')),
    notes TEXT,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. PROCUREMENT ENTRIES
-- Main transaction header matching the handwritten procurement form
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.procurement_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    representative_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL,
    firm_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    mobile TEXT NOT NULL,
    address TEXT NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer')),
    cash_amount NUMERIC(10, 2) DEFAULT 0.00,
    upi_id TEXT,
    upi_utr TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'verified', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. PROCUREMENT ITEMS
-- Line items for category, type, quantity, rate, unit
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.procurement_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES public.procurement_entries(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('per_kg', 'per_piece', 'per_bag')),
    quantity NUMERIC(10, 2) NOT NULL,
    rate NUMERIC(10, 2) NOT NULL,
    line_total NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. PAYMENT ATTACHMENTS
-- Images for Cash slips, UPI proofs, Cheques, Passbooks (multi-image support)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES public.procurement_entries(id) ON DELETE CASCADE,
    file_type TEXT NOT NULL CHECK (file_type IN ('passbook', 'cheque', 'receipt', 'other')),
    file_url TEXT NOT NULL, -- Storage URL or base64 data
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. LIVE NOTIFICATIONS TABLE
-- Real-time event log for Admin dashboard alerts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    representative_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('procurement', 'expense', 'payment_pending', 'login')),
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Enabled for security while allowing public API access via Anon Key
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_floats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow read and write for anon role (client applications using Anon key)
CREATE POLICY "Allow public all access on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on firms" ON public.firms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on daily_floats" ON public.daily_floats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on procurement_entries" ON public.procurement_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on procurement_items" ON public.procurement_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on payment_attachments" ON public.payment_attachments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all access on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for live notifications and instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.procurement_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_floats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ------------------------------------------------------------------------------
-- 11. INITIAL SEED DATA
-- Pre-populated users, categories, products, and firms for immediate demo
-- ------------------------------------------------------------------------------

-- Admin & Representative accounts
INSERT INTO public.profiles (id, name, phone, email, password_hash, role, assigned_route, status)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'SINA Operations Admin', '9876543210', 'admin@sina.com', 'admin123', 'admin', 'Headquarters', 'active'),
    ('22222222-2222-2222-2222-222222222222', 'Rahul Sharma', '9811223344', 'rahul@sina.com', 'rep123', 'representative', 'North Wholesale Market', 'active'),
    ('33333333-3333-3333-3333-333333333333', 'Suresh Kumar', '9822334455', 'suresh@sina.com', 'rep123', 'representative', 'South Industrial Zone', 'active'),
    ('44444444-4444-4444-4444-444444444444', 'Amit Patel', '9833445566', 'amit@sina.com', 'rep123', 'representative', 'East Rural Mandi', 'active')
ON CONFLICT (phone) DO NOTHING;

-- Product Categories
INSERT INTO public.categories (id, name)
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'Grains & Pulses'),
    ('c2222222-2222-2222-2222-222222222222', 'Spices & Condiments'),
    ('c3333333-3333-3333-3333-333333333333', 'Oils & Packaging'),
    ('c4444444-4444-4444-4444-444444444444', 'Raw Agricultural Produce')
ON CONFLICT (name) DO NOTHING;

-- Products with Units & Default Rates
INSERT INTO public.products (category_id, name, type, default_unit, default_rate)
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'Wheat (Grade A)', 'Sharbati', 'per_kg', 38.50),
    ('c1111111-1111-1111-1111-111111111111', 'Basmati Rice (50kg Bag)', 'Super 1121', 'per_bag', 3200.00),
    ('c1111111-1111-1111-1111-111111111111', 'Toor Dal (Premium)', 'Desi Polished', 'per_kg', 145.00),
    ('c2222222-2222-2222-2222-222222222222', 'Red Chilli Powder', 'Stemless Guntur', 'per_kg', 240.00),
    ('c2222222-2222-2222-2222-222222222222', 'Turmeric Whole', 'Salem Finger', 'per_kg', 180.00),
    ('c3333333-3333-3333-3333-333333333333', 'Mustard Oil Tin (15L)', 'Cold Pressed', 'per_piece', 1950.00),
    ('c3333333-3333-3333-3333-333333333333', 'Jute Gunny Bags (50kg)', 'Standard Heavy', 'per_piece', 48.00),
    ('c4444444-4444-4444-4444-444444444444', 'Dry Onion Bales (50kg)', 'Nashik Red', 'per_bag', 1400.00)
ON CONFLICT DO NOTHING;

-- Pre-set Firms for Auto-Suggest
INSERT INTO public.firms (firm_name, contact_person, mobile, address)
VALUES 
    ('Kishan Trading Co.', 'Ramesh Kishan', '9876501234', 'Plot 42, APMC Mandi, Sector 19'),
    ('Mahadev Agro Agency', 'Mahesh Bhai', '9876502345', '12/A Grain Merchant Lane, Old City'),
    ('Shree Balaji Enterprises', 'Gopal Sharma', '9876503456', 'Shop 7, Main Wholesale Market'),
    ('Om Sai Agro Foods', 'Sunil Patil', '9876504567', 'Highway Bypass Mandi, Gate 2'),
    ('Annapurna Grain Stores', 'Dinesh Agarwal', '9876505678', 'Station Road, Near Central Warehouse')
ON CONFLICT DO NOTHING;

-- Today's Cash Float for Rahul Sharma
INSERT INTO public.daily_floats (representative_id, date, float_amount, notes, issued_by)
VALUES 
    ('22222222-2222-2222-2222-222222222222', CURRENT_DATE, 15000.00, 'Morning field procurement float', '11111111-1111-1111-1111-111111111111'),
    ('33333333-3333-3333-3333-333333333333', CURRENT_DATE, 10000.00, 'South zone daily allowance', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (representative_id, date) DO NOTHING;
