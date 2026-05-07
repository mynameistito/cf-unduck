import { useEffect, useRef } from "react";

const SOURCES = {
  spin: "/heavier-tick-sprite.opus",
  toggleOff: "/toggle-button-off.opus",
  toggleOn: "/toggle-button-on.opus",
  click: "/click-button.opus",
  warning: "/double-button.opus",
  copy: "/foot-switch.opus",
} as const;

export type AudioName = keyof typeof SOURCES;

export interface AudioController {
  pause: (name: AudioName) => void;
  play: (
    name: AudioName,
    opts?: { rate?: number; from?: number; force?: boolean }
  ) => void;
  reset: (name: AudioName) => void;
}

export function useAudio(enabled: boolean): AudioController {
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
    a.play().catch(() => {
      /* autoplay blocked or interrupted */
    });
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

  return { play, pause, reset };
}
