import { useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeLocationPlugin {
  startTracking(options: {
    partner_id: string;
    supabase_url: string;
    supabase_key: string;
  }): Promise<void>;
  stopTracking(): Promise<void>;
}

const NativeLocation = registerPlugin<NativeLocationPlugin>("NativeLocation");

// Your Supabase URL and anon key — same as in your client.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function useNativeAndroidLocation(
  partnerId: string | undefined,
  enabled: boolean
) {
  const running = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !partnerId) return;

    if (enabled && !running.current) {
      running.current = true;
      NativeLocation.startTracking({
        partner_id: partnerId,
        supabase_url: SUPABASE_URL,
        supabase_key: SUPABASE_KEY,
      }).catch(console.error);
    }

    if (!enabled && running.current) {
      running.current = false;
      NativeLocation.stopTracking().catch(console.error);
    }

    return () => {
      if (running.current) {
        running.current = false;
        NativeLocation.stopTracking().catch(console.error);
      }
    };
  }, [partnerId, enabled]);
}