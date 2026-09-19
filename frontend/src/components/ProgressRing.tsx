import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { SPRING } from "../lib/motion";
import { cn } from "../lib/utils";

interface ProgressRingProps {
  value: number; // 0–1
  size?: number;
  stroke?: number;
  children?: ReactNode;
  className?: string;
}

export function ProgressRing({
  value,
  size = 168,
  stroke = 12,
  children,
  className,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));

  const tone =
    clamped >= 0.7 ? "stroke-leaf-500" : clamped >= 0.45 ? "stroke-honey-400" : "stroke-clay-400";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-paper"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={tone}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 1.1, ease: SPRING }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}