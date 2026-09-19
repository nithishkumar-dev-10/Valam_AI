import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function Segmented<T extends string>({
  id,
  options,
  value,
  onChange,
  className,
}: {
  id: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex rounded-full border border-mist bg-surface p-1 shadow-edge",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200",
              active ? "text-paper" : "text-sage hover:text-pine-800",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-pine-700 to-leaf-600 shadow-card"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}