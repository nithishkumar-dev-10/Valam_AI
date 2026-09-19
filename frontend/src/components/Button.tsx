import { useRef, useState } from "react";
import type { ButtonHTMLAttributes, MouseEvent, PointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/utils";
import { SPRING } from "../lib/motion";

type Variant = "primary" | "honey" | "secondary" | "ghost" | "danger";

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration" | "onDrag" | "onDragStart" | "onDragEnd" | "onDrop"> {
  variant?: Variant;
  loading?: boolean;
  full?: boolean;
}

const STYLES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-pine-700 via-pine-600 to-leaf-600 text-paper shadow-card hover:shadow-lift",
  honey:
    "bg-gradient-to-br from-honey-400 to-honey-500 text-pine-950 shadow-card hover:shadow-lift",
  secondary:
    "bg-surface text-pine-800 border border-mist shadow-edge hover:border-leaf-300 hover:text-pine-950",
  ghost: "text-pine-700 hover:bg-pine-50",
  danger: "bg-clay-500 text-white shadow-card hover:bg-clay-600",
};

export function Button({
  variant = "primary",
  loading,
  full,
  className,
  children,
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextRipple = useRef(0);

  const spawnRipple = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.1;
    const ripple = {
      id: ++nextRipple.current,
      x: event.clientX - rect.left - size / 2,
      y: event.clientY - rect.top - size / 2,
      size,
    };
    setRipples((rs) => [...rs.slice(-3), ripple]);
    window.setTimeout(() => {
      setRipples((rs) => rs.filter((r) => r.id !== ripple.id));
    }, 700);
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    spawnRipple(event as unknown as PointerEvent<HTMLButtonElement>);
    onClick?.(event);
  };

  return (
    <motion.button
      {...rest}
      type={rest.type ?? "button"}
      disabled={disabled || loading}
      onClick={handleClick}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.18, ease: SPRING }}
      className={cn(
        "relative inline-flex h-11 select-none items-center justify-center gap-2 overflow-hidden rounded-full px-5 text-sm font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50",
        STYLES[variant],
        loading && "cursor-wait",
        full && "w-full",
        className,
      )}
    >
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="pointer-events-none absolute rounded-full bg-current opacity-40"
            style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
            initial={{ scale: 0, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>
      {loading ? <LoadingDots /> : children}
    </motion.button>
  );
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1, 0.85] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.13 }}
        />
      ))}
    </span>
  );
}