import { useEffect, useRef, useCallback } from "react";

export function useAlarmSound(shouldPlay: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAlarm = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (oscillatorRef.current) {
      try { oscillatorRef.current.stop(); } catch {}
      oscillatorRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const startAlarm = useCallback(() => {
    stopAlarm();
    
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      gainRef.current = gain;

      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = 880;
      osc.connect(gain);
      osc.start();
      oscillatorRef.current = osc;

      // Pulsing alarm pattern - loud beeps
      let on = true;
      const pulse = () => {
        if (!gainRef.current || !oscillatorRef.current) return;
        if (on) {
          gainRef.current.gain.setValueAtTime(0.8, ctx.currentTime);
          oscillatorRef.current.frequency.setValueAtTime(880, ctx.currentTime);
          setTimeout(() => {
            if (oscillatorRef.current && gainRef.current) {
              oscillatorRef.current.frequency.setValueAtTime(1100, ctx.currentTime);
            }
          }, 150);
        } else {
          gainRef.current.gain.setValueAtTime(0, ctx.currentTime);
        }
        on = !on;
      };

      pulse(); // Start immediately
      intervalRef.current = setInterval(pulse, 400);
    } catch (e) {
      console.error("Failed to start alarm:", e);
    }
  }, [stopAlarm]);

  useEffect(() => {
    if (shouldPlay) {
      startAlarm();
    } else {
      stopAlarm();
    }
    return stopAlarm;
  }, [shouldPlay, startAlarm, stopAlarm]);

  return { stopAlarm };
}
