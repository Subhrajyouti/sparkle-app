import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export function usePushNotifications(partnerId: string | undefined) {
  useEffect(() => {
    if (!partnerId || !Capacitor.isNativePlatform()) return;

    const register = async () => {
      // Listeners MUST be added before calling register()
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
        if (error) {
          console.error("Failed to save FCM token:", error);
        } else {
          console.log("FCM token saved for partner:", partnerId);
        }
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("FCM registration error:", JSON.stringify(err));
      });

      // Foreground: notification arrives while app is open
      // The useAlarmSound hook handles the alarm — nothing extra needed here
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Foreground notification:", notification);
      });

      // User tapped the notification
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("Notification tapped:", action);
      });

      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== "granted") {
        console.warn("Push permission denied");
        return;
      }

      await PushNotifications.register();
    };

    register();
    return () => { PushNotifications.removeAllListeners(); };
  }, [partnerId]);
}