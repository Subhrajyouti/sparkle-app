import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { partner_id, assignment_id } = await req.json();

    if (!partner_id) {
      return new Response(JSON.stringify({ error: "partner_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY")!; // Add this to Supabase secrets

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get FCM token for this partner
    const { data: sub, error } = await supabase
      .from("push_subscriptions")
      .select("fcm_token")
      .eq("partner_id", partner_id)
      .single();

    if (error || !sub?.fcm_token) {
      console.log("No FCM token for partner:", partner_id);
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via FCM HTTP v1 API
    const response = await fetch(
      "https://fcm.googleapis.com/fcm/send",
      {
        method: "POST",
        headers: {
          "Authorization": `key=${fcmServerKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: sub.fcm_token,
          priority: "high",
          notification: {
            title: "🔔 New Delivery Request!",
            body: "You have a new order. Open the app to accept.",
            sound: "default",
          },
          data: {
            assignment_id: assignment_id,
            url: "/",
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channel_id: "delivery_alerts",
              notification_priority: "PRIORITY_MAX",
              visibility: "PUBLIC",
            },
          },
        }),
      }
    );

    const result = await response.json();
    console.log("FCM result:", result);

    return new Response(JSON.stringify({ sent: 1, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});