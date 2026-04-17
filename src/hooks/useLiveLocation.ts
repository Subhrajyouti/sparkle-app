import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Continuously shares the rider's GPS location while `enabled` is true.
 * - Uses watchPosition for accurate, battery-friendly streaming
 * - Upserts into partner_locations (one row per partner, updated in place)
 * - Marks rider offline when disabled or unmounted
 */
export function useLiveLocation(partnerId: string | undefined, enabled: boolean) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!partnerId) return;

    // Cleanup any existing watcher before deciding what to do
    const stopWatch = () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const markOffline = async () => {
      try {
        await supabase
          .from("partner_locations")
          .update({ is_online: false, updated_at: new Date().toISOString() })
          .eq("partner_id", partnerId);
      } catch (e) {
        // silent
      }
    };

    if (!enabled) {
      stopWatch();
      markOffline();
      return;
    }

    if (!("geolocation" in navigator)) {
      console.warn("Geolocation not supported on this device");
      return;
    }

    const handlePosition = async (pos: GeolocationPosition) => {
      // Throttle: send at most once every 5 seconds
      const now = Date.now();
      if (now - lastSentRef.current < 5000) return;
      lastSentRef.current = now;

      const { latitude, longitude, accuracy, speed, heading } = pos.coords;
      const payload = {
        partner_id: partnerId,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: heading ?? null,
        is_online: true,
        reported_at: new Date(pos.timestamp).toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        await supabase
          .from("partner_locations")
          .upsert(payload, { onConflict: "partner_id" });
      } catch (e) {
        console.error("Failed to push location", e);
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn("Geolocation error:", err.message);
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
}
