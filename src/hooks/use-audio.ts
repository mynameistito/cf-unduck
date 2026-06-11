import { useEffect, useRef } from "react";

const SOURCES = {
  click: "/click-button.opus",
  copy: "/foot-switch.opus",
  spin: "/heavier-tick-sprite.opus",
  toggleOff: "/toggle-button-off.opus",
  toggleOn: "/toggle-button-on.opus",
  warning: "/double-button.opus",
} as const;

type AudioName = keyof typeof SOURCES;

export interface AudioController {
  pause: (name: AudioName) => void;
  play: (
    name: AudioName,
    opts?: { rate?: number; from?: number; force?: boolean }
  ) => void;
  reset: (name: AudioName) => void;
}

export const useAudio = (enabled: boolean): AudioController => {
  const ref = useRef<Partial<Record<AudioName, HTMLAudioElement>>>({});
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (Object.keys(ref.current).length > 0) {
      return;
    }
    const elements: Partial<Record<AudioName, HTMLAudioElement>> = {};
    for (const key of Object.keys(SOURCES) as AudioName[]) {
      const a = new Audio();
      a.src = SOURCES[key];
      elements[key] = a;
    }
    ref.current = elements;
  }, []);

  const play: AudioController["play"] = (name, opts) => {
    if (!(enabledRef.current || opts?.force)) {
      return;
    }
    const a = ref.current[name];
    if (!a) {
      return;
    }
    if (opts?.rate !== undefined) {
      a.playbackRate = opts.rate;
    }
    a.currentTime = opts?.from ?? 0;
    const playAudio = async () => {
      try {
        await a.play();
      } catch {
        // Autoplay can be blocked or interrupted by rapid UI changes.
      }
    };
    void playAudio();
  };

  const pause: AudioController["pause"] = (name) => {
    const a = ref.current[name];
    if (!a) {
      return;
    }
    a.pause();
  };

  const reset: AudioController["reset"] = (name) => {
    const a = ref.current[name];
    if (!a) {
      return;
    }
    a.pause();
    a.currentTime = 0;
  };

  return { pause, play, reset };
};
