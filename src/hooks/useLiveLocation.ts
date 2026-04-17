import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LiveLocationStatus = "idle" | "requesting" | "active" | "error" | "unsupported";

/**
 * Continuously shares the rider's GPS location while `enabled` is true.
 * - Uses watchPosition for accurate streaming
 * - Upserts into partner_locations (one row per partner)
 * - Marks rider offline when disabled or unmounted
 */
export function useLiveLocation(partnerId: string | undefined, enabled: boolean) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const [status, setStatus] = useState<LiveLocationStatus>("idle");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!partnerId) return;

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
      } catch {
        /* silent */
      }
    };

    if (!enabled) {
      stopWatch();
      markOffline();
      setStatus("idle");
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setErrorMsg("Geolocation not supported on this device");
      toast.error("Geolocation not supported on this device");
      return;
    }

    setStatus("requesting");
    setErrorMsg(null);

    const handlePosition = async (pos: GeolocationPosition) => {
      setStatus("active");
      setLastUpdate(new Date());

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

      const { error } = await supabase
        .from("partner_locations")
        .upsert(payload, { onConflict: "partner_id" });

      if (error) {
        console.error("Failed to push location", error);
        setErrorMsg(error.message);
      }
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
