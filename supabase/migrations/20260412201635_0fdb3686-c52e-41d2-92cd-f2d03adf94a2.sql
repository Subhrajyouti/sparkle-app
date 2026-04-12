
-- Add partner_id to push_subscriptions
ALTER TABLE public.push_subscriptions 
ADD COLUMN partner_id uuid REFERENCES public.delivery_partners(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_partner_id ON public.push_subscriptions(partner_id);

-- Create unique constraint to avoid duplicate subscriptions per partner+endpoint
ALTER TABLE public.push_subscriptions ADD CONSTRAINT unique_partner_endpoint UNIQUE (partner_id, endpoint);

-- Create function to call edge function on new assignment
CREATE OR REPLACE FUNCTION public.notify_new_delivery_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  -- Only notify on new requested assignments
  IF NEW.status = 'requested' THEN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;

    SELECT decrypted_secret INTO edge_function_url
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_URL'
    LIMIT 1;

    PERFORM net.http_post(
      url := edge_function_url || '/functions/v1/send-delivery-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'partner_id', NEW.delivery_partner_id,
        'assignment_id', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_new_delivery_assignment
AFTER INSERT ON public.delivery_assignments
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_delivery_assignment();
