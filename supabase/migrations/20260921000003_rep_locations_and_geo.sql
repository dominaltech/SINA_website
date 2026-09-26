-- ==============================================================================
-- Migration: 20260921000003_rep_locations_and_geo.sql
-- Description:
--   1. Create 'rep_locations' table to track live field GPS coordinates.
--   2. Add automated trigger to notify Admins whenever a rep starts a new entry.
--   3. Enable Realtime publication for live tracking on Admin maps.
-- ==============================================================================

-- 1. Rep Locations Table
CREATE TABLE IF NOT EXISTS public.rep_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL,
    location_name TEXT,
    activity TEXT NOT NULL DEFAULT 'new_entry' CHECK (activity IN ('new_entry', 'visit_saved', 'check_in', 'ping')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for high-speed retrieval of rep's latest location
CREATE INDEX IF NOT EXISTS idx_rep_locations_rep_created ON public.rep_locations(rep_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.rep_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on rep_locations" ON public.rep_locations;
DROP POLICY IF EXISTS "Allow authenticated insert on rep_locations" ON public.rep_locations;

CREATE POLICY "Allow authenticated read on rep_locations"
ON public.rep_locations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert on rep_locations"
ON public.rep_locations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rep_locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rep_locations;
    END IF;
END $$;

-- 2. Automated Trigger: Notify Admin on New Location / New Entry
CREATE OR REPLACE FUNCTION public.handle_rep_location_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_rep_name TEXT;
    v_firm_name TEXT;
    v_body TEXT;
BEGIN
    SELECT name INTO v_rep_name FROM public.profiles WHERE id = NEW.rep_id;
    IF v_rep_name IS NULL THEN v_rep_name := 'Representative'; END IF;

    IF NEW.firm_id IS NOT NULL THEN
        SELECT name INTO v_firm_name FROM public.firms WHERE id = NEW.firm_id;
    END IF;

    IF v_firm_name IS NOT NULL THEN
        v_body := v_rep_name || ' started new procurement entry at ' || v_firm_name || '.';
    ELSIF NEW.location_name IS NOT NULL AND NEW.location_name <> '' THEN
        v_body := v_rep_name || ' is at ' || NEW.location_name || '.';
    ELSE
        v_body := v_rep_name || ' started entry at GPS (' || NEW.latitude::TEXT || ', ' || NEW.longitude::TEXT || ').';
    END IF;

    -- Only send alert for new_entry or check_in
    IF NEW.activity IN ('new_entry', 'check_in') THEN
        INSERT INTO public.notifications (target_role, title, body, type, data)
        VALUES (
            'admin',
            'Field Alert: ' || v_rep_name,
            v_body,
            'rep_location',
            jsonb_build_object(
                'location_id', NEW.id,
                'rep_id', NEW.rep_id,
                'rep_name', v_rep_name,
                'firm_id', NEW.firm_id,
                'firm_name', v_firm_name,
                'latitude', NEW.latitude,
                'longitude', NEW.longitude,
                'activity', NEW.activity,
                'created_at', NEW.created_at
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rep_location_notifications ON public.rep_locations;
CREATE TRIGGER trg_rep_location_notifications
AFTER INSERT ON public.rep_locations
FOR EACH ROW EXECUTE FUNCTION public.handle_rep_location_notifications();
