import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Capacitor, registerPlugin } from "@capacitor/core";

export type LiveLocationStatus = "idle" | "requesting" | "active" | "error" | "unsupported";

// Native plugin interface (only used inside the Android/iOS app)
interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (
      location?: {
        latitude: number;
        longitude: number;
        accuracy: number;
        speed: number | null;
        bearing: number | null;
        time: number;
      },
      error?: { code: string; message: string }
    ) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

const BackgroundGeolocation =
  Capacitor.isNativePlatform()
    ? registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation")
    : null;

/**
 * Continuously shares the rider's GPS location while `enabled` is true.
 * - On native (Capacitor) uses background-geolocation plugin (works with screen off)
 * - On web falls back to navigator.geolocation.watchPosition (foreground only)
 */
export function useLiveLocation(partnerId: string | undefined, enabled: boolean) {
  const watchIdRef = useRef<number | null>(null);
  const nativeWatcherIdRef = useRef<string | null>(null);
  const lastSentRef = useRef<number>(0);
  const [status, setStatus] = useState<LiveLocationStatus>("idle");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!partnerId) return;

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

    const stopWatch = async () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (nativeWatcherIdRef.current && BackgroundGeolocation) {
        try {
          await BackgroundGeolocation.removeWatcher({ id: nativeWatcherIdRef.current });
        } catch {
          /* silent */
        }
        nativeWatcherIdRef.current = null;
      }
    };

    if (!enabled) {
      stopWatch();
      markOffline();
      setStatus("idle");
      return;
    }

    const pushLocation = async (
      latitude: number,
      longitude: number,
      accuracy: number | null,
      speed: number | null,
      heading: number | null,
      timestamp: number
    ) => {
      setStatus("active");
      setLastUpdate(new Date());

      // Throttle: send at most once every 5 seconds
      const now = Date.now();
      if (now - lastSentRef.current < 5000) return;
      lastSentRef.current = now;

      const payload = {
        partner_id: partnerId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        is_online: true,
        reported_at: new Date(timestamp).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("partner_locations")
        .upsert(payload, { onConflict: "partner_id" });

      if (error) {
        console.error("Failed to push location", error);
        setErrorMsg(error.message);
      }
    };

    setStatus("requesting");
    setErrorMsg(null);

    // ---------- NATIVE PATH (Android / iOS) ----------
    if (BackgroundGeolocation) {
      BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "Sharing your live location with the kitchen",
          backgroundTitle: "Delivery tracking active",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10, // metres — only fire when moved 10m
        },
        (location, error) => {
          if (error) {
            console.warn("Native geolocation error:", error);
            // "NOT_AUTHORIZED" => user must grant background permission manually
            if (error.code === "NOT_AUTHORIZED") {
              toast.error(
                "Background location not allowed. Tap settings and choose 'Allow all the time'.",
                {
                  action: {
                    label: "Open settings",
                    onClick: () => BackgroundGeolocation?.openSettings(),
                  },
                  duration: 10000,
                }
              );
            } else {
              toast.error(error.message);
            }
            setStatus("error");
            setErrorMsg(error.message);
            return;
          }
          if (!location) return;
          pushLocation(
            location.latitude,
            location.longitude,
            location.accuracy,
            location.speed,
            location.bearing,
            location.time
          );
        }
      ).then((id) => {
        nativeWatcherIdRef.current = id;
      }).catch((e) => {
        console.error("Failed to start native watcher", e);
        setStatus("error");
        setErrorMsg(String(e?.message ?? e));
      });

      return () => {
        stopWatch();
        markOffline();
      };
    }

    // ---------- WEB FALLBACK ----------
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setErrorMsg("Geolocation not supported on this device");
      toast.error("Geolocation not supported on this device");
      return;
    }

    const handlePosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy, speed, heading } = pos.coords;
      pushLocation(latitude, longitude, accuracy, speed, heading, pos.timestamp);
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn("Geolocation error:", err.message, err.code);
      setStatus("error");
      const msg =
        err.code === 1
          ? "Location permission denied. Enable it in browser settings."
          : err.code === 2
          ? "Location unavailable. Check GPS."
          : err.code === 3
          ? "Location request timed out."
          : err.message;
      setErrorMsg(msg);
      toast.error(msg);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      }
    );

    return () => {
      stopWatch();
      markOffline();
    };
  }, [partnerId, enabled]);

  return { status, lastUpdate, errorMsg };
}
