import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export function usePushNotifications(partnerId: string | undefined) {
  useEffect(() => {
    if (!partnerId || !Capacitor.isNativePlatform()) return;

    const register = async () => {
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== "granted") return;

      await PushNotifications.register();

      PushNotifications.addListener("registration", async (token) => {
        console.log("FCM token:", token.value);
        const { error } = await supabase
          .from("fcm_tokens")
          .upsert(
            {
              token: token.value,
              partner_id: partnerId,
              platform: "android",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "token" }
          );
        if (error) console.error("Failed to save FCM token:", error);
        else console.log("FCM token saved for partner:", partnerId);
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("FCM registration error:", err);
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Foreground notification:", notification);
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("Notification tapped:", action);
      });
      PushNotifications.addListener("registrationError", (err) => {
        console.error("FCM registration error:", JSON.stringify(err));
  // Also show as alert so you see it on device
        alert("FCM Error: " + JSON.stringify(err));
      });
    };

    register();
    return () => { PushNotifications.removeAllListeners(); };
  }, [partnerId]);
}