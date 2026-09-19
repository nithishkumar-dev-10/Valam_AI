import { motion } from "framer-motion";
import { cn } from "../lib/utils";

export function Checkmark({ size = 72, className }: { size?: number; className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.55, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 17 }}
      className={cn("grid place-items-center", className)}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <motion.circle
          cx="32"
          cy="32"
          r="29"
          stroke="#3e9b6a"
          strokeWidth="4"
          fill="rgba(62,155,106,0.10)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <motion.path
          d="M20 33.5l8.5 8.5 15.5-17"
          stroke="#3e9b6a"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, delay: 0.4, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
  );
}