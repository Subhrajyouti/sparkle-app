
-- Live location per delivery partner (one row per partner, updated continuously)
CREATE TABLE IF NOT EXISTS public.partner_locations (
  partner_id UUID NOT NULL PRIMARY KEY REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy NUMERIC,
  speed NUMERIC,
  heading NUMERIC,
  is_online BOOLEAN NOT NULL DEFAULT true,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access" ON public.partner_locations
  FOR ALL USING (true) WITH CHECK (true);

-- Index for "show only online riders updated recently" queries
CREATE INDEX IF NOT EXISTS idx_partner_locations_online_reported
  ON public.partner_locations (is_online, reported_at DESC);

-- Enable realtime
ALTER TABLE public.partner_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_locations;
