import { useEffect, useState } from "react";

import { CUTIES } from "@/lib/constants";
import { randomIndex } from "@/lib/random";

const MIN_DELTA = 100;

const pick = <T,>(arr: readonly [T, ...T[]]): T =>
  arr[randomIndex(arr.length)] ?? arr[0];

export const Cutie = ({ reducedMotion }: { reducedMotion: boolean }) => {
  const [face, setFace] = useState<string>(CUTIES.IDLE);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    const handler = (e: MouseEvent) => {
      const dx = e.clientX - window.innerWidth / 2;
      const dy = e.clientY - window.innerHeight / 2;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MIN_DELTA) {
        setFace(pick(dx < 0 ? CUTIES.LEFT : CUTIES.RIGHT));
      } else if (Math.abs(dy) > MIN_DELTA) {
        setFace(pick(dy < 0 ? CUTIES.UP : CUTIES.DOWN));
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [reducedMotion]);

  return <h1 id="cutie">{face}</h1>;
};
