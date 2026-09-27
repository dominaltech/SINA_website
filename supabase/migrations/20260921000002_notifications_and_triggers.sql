-- ==============================================================================
-- Migration: 20260921000002_notifications_and_triggers.sql
-- Description:
--   1. Ensure 'notifications' table has all required columns (user_id, target_role, body, data).
--   2. Backward compatible: migrate representative_id -> user_id, message -> body if existed.
--   3. Create 'push_subscriptions' table for VAPID Web-Push endpoints.
--   4. Triggers for UPI request, visit logged, cash assigned, and payment approved.
--   5. Compatible with existing 'daily_floats' table (with compatibility view for daily_cash_float).
-- ==============================================================================

-- 1. Notifications Table: Create or Alter Safely
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all required columns exist
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_role TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'SINA Notification';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- Migrate legacy column values if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'representative_id'
    ) THEN
        UPDATE public.notifications SET user_id = representative_id WHERE user_id IS NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'message'
    ) THEN
        UPDATE public.notifications SET body = message WHERE body IS NULL;
    END IF;
END $$;

UPDATE public.notifications SET body = title WHERE body IS NULL;
ALTER TABLE public.notifications ALTER COLUMN body SET NOT NULL;

-- Safe indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read their own notifications or role notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow update read status for own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow system / authenticated inserts" ON public.notifications;

CREATE POLICY "Allow users to read their own notifications or role notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    OR (
        target_role IN ('admin', 'super_admin') 
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
        )
    )
);

CREATE POLICY "Allow update read status for own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR target_role IS NOT NULL)
WITH CHECK (true);

CREATE POLICY "Allow system / authenticated inserts"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Enable Realtime for notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

-- 2. Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_type TEXT DEFAULT 'android',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to manage their own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Allow users to manage their own push subscriptions"
ON public.push_subscriptions FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Compatibility View for daily_cash_float -> daily_floats
CREATE OR REPLACE VIEW public.daily_cash_float AS
SELECT 
    id,
    representative_id AS rep_id,
    date,
    float_amount AS amount,
    notes,
    issued_by AS assigned_by,
    created_at,
    updated_at
FROM public.daily_floats;

-- 4. Automated Database Trigger Functions

-- Trigger A: Procurement Entries
CREATE OR REPLACE FUNCTION public.handle_procurement_entry_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_rep_name TEXT;
    v_firm_name TEXT;
    v_amount_str TEXT;
BEGIN
    SELECT name INTO v_rep_name FROM public.profiles WHERE id = NEW.rep_id;
    IF v_rep_name IS NULL THEN v_rep_name := 'Representative'; END IF;
    
    SELECT name INTO v_firm_name FROM public.firms WHERE id = NEW.firm_id;
    IF v_firm_name IS NULL THEN v_firm_name := 'Supplier'; END IF;

    v_amount_str := '₹' || TO_CHAR(NEW.total_amount, 'FM99,99,999.00');

    IF (TG_OP = 'INSERT') THEN
        IF (NEW.payment_mode = 'upi' AND NEW.payment_status = 'pending') THEN
            INSERT INTO public.notifications (target_role, title, body, type, data)
            VALUES (
                'admin',
                'New UPI Payment Request: ' || v_amount_str,
                v_rep_name || ' requested UPI payment for ' || v_firm_name || ' (UPI: ' || COALESCE(NEW.firm_upi_id, 'N/A') || ')',
                'upi_request',
                jsonb_build_object(
                    'entry_id', NEW.id,
                    'amount', NEW.total_amount,
                    'firm_id', NEW.firm_id,
                    'firm_name', v_firm_name,
                    'firm_upi_id', NEW.firm_upi_id,
                    'rep_id', NEW.rep_id,
                    'rep_name', v_rep_name
                )
            );
        END IF;

        INSERT INTO public.notifications (user_id, title, body, type, data)
        VALUES (
            NEW.rep_id,
            'Visit Recorded: ' || v_amount_str,
            'Procurement entry successfully logged for ' || v_firm_name || ' (' || UPPER(NEW.payment_mode) || ').',
            'visit_success',
            jsonb_build_object(
                'entry_id', NEW.id,
                'amount', NEW.total_amount,
                'firm_name', v_firm_name,
                'payment_mode', NEW.payment_mode
            )
        );

    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.payment_status <> 'paid' AND NEW.payment_status = 'paid') THEN
            INSERT INTO public.notifications (user_id, title, body, type, data)
            VALUES (
                NEW.rep_id,
                'UPI Payment Approved! ' || v_amount_str,
                'Payment to ' || v_firm_name || ' has been completed. UTR: ' || COALESCE(NEW.payment_ref, 'Confirmed by Admin'),
                'payment_approved',
                jsonb_build_object(
                    'entry_id', NEW.id,
                    'amount', NEW.total_amount,
                    'firm_name', v_firm_name,
                    'payment_ref', NEW.payment_ref
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_procurement_entry_notifications ON public.procurement_entries;
CREATE TRIGGER trg_procurement_entry_notifications
AFTER INSERT OR UPDATE ON public.procurement_entries
FOR EACH ROW EXECUTE FUNCTION public.handle_procurement_entry_notifications();

-- Trigger B: Daily Floats (Morning Float Assigned to Rep)
CREATE OR REPLACE FUNCTION public.handle_daily_float_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_amount_str TEXT;
BEGIN
    v_amount_str := '₹' || TO_CHAR(NEW.float_amount, 'FM99,99,999.00');

    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND OLD.float_amount <> NEW.float_amount) THEN
        INSERT INTO public.notifications (user_id, title, body, type, data)
        VALUES (
            NEW.representative_id,
            'Cash Float Allocated: ' || v_amount_str,
            'Your morning cash float for ' || TO_CHAR(NEW.date, 'DD Mon YYYY') || ' is set to ' || v_amount_str || '.',
            'cash_assigned',
            jsonb_build_object(
                'float_id', NEW.id,
                'amount', NEW.float_amount,
                'date', NEW.date
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_daily_cash_notifications ON public.daily_floats;
DROP TRIGGER IF EXISTS trg_daily_cash_notifications ON public.daily_cash_float;

CREATE TRIGGER trg_daily_cash_notifications
AFTER INSERT OR UPDATE ON public.daily_floats
FOR EACH ROW EXECUTE FUNCTION public.handle_daily_float_notifications();
