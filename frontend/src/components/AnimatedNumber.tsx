import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  className?: string;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 950,
  suffix = "",
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t); // easeOutExpo
      setDisplay(from + (to - from) * eased);
      fromRef.current = to;
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={cn("tnum", className)}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}