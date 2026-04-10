
-- Add payment_mode and upi_screenshot columns to delivery_assignments
ALTER TABLE public.delivery_assignments 
ADD COLUMN payment_mode text NOT NULL DEFAULT 'cash',
ADD COLUMN upi_screenshot_path text NULL;

-- Create storage bucket for UPI payment proof screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for delivery proofs
CREATE POLICY "Anyone can upload delivery proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'delivery-proofs');

CREATE POLICY "Anyone can view delivery proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-proofs');
