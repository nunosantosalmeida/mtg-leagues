"use client";

import { useEffect, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
}

export function AnimatedCounter({ value, duration = 600 }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * value);
      setDisplay(current);
      if (progress < 1) {
        start = requestAnimationFrame(tick);
      }
    }

    start = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(start);
  }, [value, duration]);

  return <>{display}</>;
}
