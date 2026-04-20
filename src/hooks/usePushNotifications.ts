import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export function usePushNotifications(partnerId: string | undefined) {
  useEffect(() => {
    if (!partnerId || !Capacitor.isNativePlatform()) return;

    const register = async () => {
      // ✅ Add listeners FIRST before calling register()
      PushNotifications.addListener("registration", async (token) => {
        console.log("FCM token:", token.value);
        alert("Got token: " + token.value.substring(0, 20) + "..."); // temp debug
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
        if (error) {
          console.error("Failed to save FCM token:", error);
          alert("DB error: " + error.message);
        } else {
          console.log("FCM token saved for partner:", partnerId);
        }
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("FCM registration error:", JSON.stringify(err));
        alert("FCM Error: " + JSON.stringify(err));
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Foreground notification:", notification);
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("Notification tapped:", action);
      });

      // ✅ Request permission then register AFTER listeners are ready
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== "granted") {
        alert("Push permission denied");
        return;
      }

      await PushNotifications.register();
    };

    register();
    return () => { PushNotifications.removeAllListeners(); };
  }, [partnerId]);
}