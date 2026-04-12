import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BLAgB2OshIeM0XME-MbkFa_yOZEfvXqXxOT7OEMOqRjnTsKgY_bRkmAJJxl-vH3HG0MiW-CO4GQnGBYzGL9v9M";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(partnerId: string | undefined) {
  useEffect(() => {
    if (!partnerId || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    const registerPush = async () => {
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // Request permission
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            console.log("Push notification permission denied");
            return;
          }

          // Subscribe
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        // Save subscription to Supabase (upsert by partner+endpoint)
        const subJson = subscription.toJSON();
        const { error } = await supabase
          .from("push_subscriptions")
          .upsert(
            {
              partner_id: partnerId,
              endpoint: subJson.endpoint!,
              p256dh: subJson.keys!.p256dh!,
              auth: subJson.keys!.auth!,
            },
            { onConflict: "partner_id,endpoint" }
          );

        if (error) {
          console.error("Failed to save push subscription:", error);
        } else {
          console.log("Push subscription saved successfully");
        }
      } catch (err) {
        console.error("Push registration failed:", err);
      }
    };

    registerPush();
  }, [partnerId]);
}
