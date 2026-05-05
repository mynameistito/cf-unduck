import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";
import { CUTIES } from "~/lib/constants";

const MIN_DELTA = 100;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function Cutie() {
  const reduced = usePrefersReducedMotion();
  const [face, setFace] = useState<string>(CUTIES.IDLE);

  useEffect(() => {
    if (reduced) {
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
  }, [reduced]);

  return <h1 id="cutie">{face}</h1>;
}
