ALTER TABLE public.delivery_assignment_orders
ADD COLUMN status text NOT NULL DEFAULT 'pending',
ADD COLUMN delivered_at timestamptz;