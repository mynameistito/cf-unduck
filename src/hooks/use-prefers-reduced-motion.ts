import { useEffect, useState } from "react";

/** Track the system reduced-motion preference.
 * @returns Whether reduced motion is preferred.
 */
export const usePrefersReducedMotion = (): boolean => {
  const [prefers, setPrefers] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handler = (e: MediaQueryListEvent) => {
      setPrefers(e.matches);
    };

    mq.addEventListener("change", handler);

    return () => {
      mq.removeEventListener("change", handler);
    };
  }, []);

  return prefers;
};
