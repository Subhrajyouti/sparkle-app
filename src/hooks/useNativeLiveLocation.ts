import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLiveLocation } from "./useLiveLocation";
import { LocalNotifications } from '@capacitor/local-notifications';

export type NativeLiveLocationStatus = "idle" | "requesting" | "active" | "error" | "unsupported";

/**
 * Native background-geolocation plugin shape (subset we use).
 * Docs: https://github.com/capacitor-community/background-geolocation
 */
interface BackgroundLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  bearing: number | null;
  time: number;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location: BackgroundLocation | null, error?: { code: string; message: string }) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

/**
 * Hook that:
 * - On native (Android/iOS via Capacitor) uses background-geolocation plugin
 * so location keeps streaming even when the app is in background or screen off.
 * - On web (browser) falls back to the existing useLiveLocation watchPosition hook.
 */
export function useNativeLiveLocation(partnerId: string | undefined, enabled: boolean) {
  const isNative = Capacitor.isNativePlatform();
  const watcherIdRef = useRef<string | null>(null);
  const lastSentRef = useRef<number>(0);
  const [status, setStatus] = useState<NativeLiveLocationStatus>("idle");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Web fallback — only active when not running natively.
  const webState = useLiveLocation(partnerId, enabled && !isNative);

  useEffect(() => {
    if (!isNative || !partnerId) return;

    const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

    const markOffline = async () => {
      try {
        await supabase
          .from("partner_locations")
          .update({ is_online: false, updated_at: new Date().toISOString() })
          .eq("partner_id", partnerId);
      } catch {
        /* silent */
      }
    };

    const removeWatcher = async () => {
      if (watcherIdRef.current) {
        try {
          await BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
        } catch (e) {
          console.warn("removeWatcher failed", e);
        }
        watcherIdRef.current = null;
      }
    };

    if (!enabled) {
      removeWatcher();
      markOffline();
      setStatus("idle");
      return;
    }

    setStatus("requesting");
    setErrorMsg(null);

    let cancelled = false;

    (async () => {
      try {
        // --- Added Notification Permission Check ---
        const perms = await LocalNotifications.checkPermissions();
        if (perms.display !== 'granted') {
          const request = await LocalNotifications.requestPermissions();
          if (request.display !== 'granted') {
            toast.error("Notification permission is required to track location in the background.");
            setStatus("error");
            setErrorMsg("Notification permission denied");
            return;
          }
        }
        // --------------------------------------------

        const id = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: "Sharing your location with Khanismita",
            backgroundTitle: "Delivery tracking active",
            requestPermissions: true,
            stale: false,
            distanceFilter: 0, // meters — only fire when moved at least 10m
          },
          async (location, error) => {
            if (error) {
              console.warn("BackgroundGeolocation error:", error);
              setStatus("error");
              setErrorMsg(error.message);
              if (error.code === "NOT_AUTHORIZED") {
                toast.error("Location permission denied. Please enable 'Allow all the time' in app settings.", {
                  action: {
                    label: "Open settings",
                    onClick: () => BackgroundGeolocation.openSettings(),
                  },
                });
              } else {
                toast.error(error.message);
              }
              return;
            }
            if (!location) return;

            setStatus("active");
            setLastUpdate(new Date());

            // Throttle DB writes to once every 5s even if plugin fires more often.
            const now = Date.now();
            if (now - lastSentRef.current < 5000) return;
            lastSentRef.current = now;

            const payload = {
              partner_id: partnerId,
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy ?? null,
              speed: location.speed ?? null,
              heading: location.bearing ?? null,
              is_online: true,
              reported_at: new Date(location.time).toISOString(),
              updated_at: new Date().toISOString(),
            };

            const { error: dbError } = await supabase
              .from("partner_locations")
              .upsert(payload, { onConflict: "partner_id" });

            if (dbError) {
              console.error("Failed to push native location", dbError);
              setErrorMsg(dbError.message);
            }
          }
        );
        if (cancelled) {
          await BackgroundGeolocation.removeWatcher({ id });
        } else {
          watcherIdRef.current = id;
        }
      } catch (e: any) {
        console.error("Failed to start background watcher", e);
        setStatus("error");
        setErrorMsg(e?.message ?? "Failed to start background tracking");
      }
    })();

    return () => {
      cancelled = true;
      removeWatcher();
      markOffline();
    };
  }, [isNative, partnerId, enabled]);

  if (!isNative) {
    return {
      status: webState.status as NativeLiveLocationStatus,
      lastUpdate: webState.lastUpdate,
      errorMsg: webState.errorMsg,
      isNative,
    };
  }

  return { status, lastUpdate, errorMsg, isNative };
}