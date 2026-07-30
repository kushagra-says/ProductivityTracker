import { useEffect, useRef, useState } from 'react';

/**
 * Eases a numeric value from its previous reading to the new one over
 * `duration` ms, returning the live animated value each tick.
 */
export function useCountUp(value, duration = 600) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const rafId = useRef(null);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    const start = Date.now();

    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafId.current = requestAnimationFrame(step);
      } else {
        prev.current = to;
      }
    };
    rafId.current = requestAnimationFrame(step);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [value, duration]);

  return display;
}
