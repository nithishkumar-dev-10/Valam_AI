import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { IconMic } from "./Icons";
import { cn } from "../lib/utils";
import { SPRING } from "../lib/motion";

export type MicState = "idle" | "starting" | "listening" | "processing";

const BARS = [0.4, 0.9, 0.55, 1, 0.7, 1, 0.5, 0.85];

export function MicButton({
  state,
  disabled,
  onPress,
  className,
}: {
  state: MicState;
  disabled?: boolean;
  onPress: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const label =
    state === "starting"
      ? t("mic.starting")
      : state === "listening"
        ? t("mic.tapToStop")
        : state === "processing"
          ? t("mic.working")
          : t("mic.tapAndSpeak");

  return (
    <div className={cn("relative grid place-items-center", className)}>
      {/* Pulsing rings while listening */}
      {state === "listening" && (
        <>
          <motion.span
            className="absolute h-36 w-36 rounded-full bg-leaf-500/25"
            animate={{ scale: [1, 1.45], opacity: [0.55, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
          <motion.span
            className="absolute h-36 w-36 rounded-full bg-leaf-500/20"
            animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
          />
        </>
      )}

      {state === "listening" && (
        <div className="absolute bottom-2 flex h-6 items-end gap-[3px]">
          {BARS.map((h, i) => (
            <motion.span
              key={i}
              className="wave-dot w-[3px] rounded-full bg-leaf-600"
              style={{ height: `${Math.round(h * 22)}px`, animationDelay: `${i * 0.09}s` }}
            />
          ))}
        </div>
      )}

      {(state === "starting" || state === "processing") && (
        <motion.span
          className="absolute h-24 w-24 rounded-full border-2 border-leaf-300 border-t-leaf-600"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
      )}

      <motion.button
        type="button"
        onClick={onPress}
        aria-label={label}
        aria-busy={state === "processing"}
        disabled={disabled || state === "processing"}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.04 }}
        animate={
          state === "idle"
            ? { scale: [1, 1.035, 1] }
            : { scale: 1 }
        }
        transition={
          state === "idle"
            ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2, ease: SPRING }
        }
        className={cn(
          "grid h-28 w-28 place-items-center rounded-full shadow-lift transition-colors duration-300",
          state === "idle" && "bg-gradient-to-br from-pine-700 to-leaf-600 text-paper",
          (state === "starting" || state === "listening") && "bg-leaf-600 text-paper",
          state === "processing" && "bg-paper text-leaf-600 border-2 border-leaf-300",
        )}
      >
        <IconMic className={cn("h-10 w-10", state === "processing" && "h-9 w-9")} />
      </motion.button>

      <p className="mt-4 text-sm font-medium text-pine-800">
        {state === "listening" ? t("mic.listening") : label}
      </p>
    </div>
  );
}