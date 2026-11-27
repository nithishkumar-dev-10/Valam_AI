import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { IconMic } from "./Icons";
import { cn } from "../lib/utils";
import type { VoiceMetrics } from "../lib/audio";

export type MicState = "idle" | "starting" | "listening" | "processing" | "error";

const BARS = [0.4, 0.9, 0.55, 1, 0.7, 1, 0.5, 0.85];

export function MicButton({
  state,
  disabled,
  onPress,
  metrics,
  className,
}: {
  state: MicState;
  disabled?: boolean;
  onPress: () => void;
  metrics?: VoiceMetrics;
  className?: string;
}) {
  const { t } = useTranslation();
  const listening = state === "listening" || state === "starting";
  const label =
    state === "starting"
      ? t("mic.starting")
      : state === "listening"
        ? `${t("mic.listening")} · ${t("mic.tapToStop")}`
        : state === "processing"
          ? t("mic.working")
          : state === "error"
            ? t("mic.tapToRetry")
            : t("mic.tapAndSpeak");
  const secondsLeft = Math.ceil((metrics?.remainingMs ?? 10000) / 1000);

  return (
    <div className={cn("relative grid place-items-center", className)}>
      {/* Pulsing rings while listening — decorative, never blocks the tap. */}
      {listening && (
        <>
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute h-36 w-36 rounded-full bg-leaf-500/25"
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.15, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute h-28 w-28 rounded-full border border-leaf-400/50"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
        </>
      )}

      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        aria-label={label}
        aria-pressed={listening}
        title={label}
        className={cn(
          "relative z-10 grid h-28 w-28 place-items-center rounded-full text-paper shadow-float outline-none transition-transform duration-200 focus-visible:ring-4 focus-visible:ring-leaf-300",
          state === "error"
            ? "bg-clay-500 hover:bg-clay-600"
            : state === "processing"
              ? "bg-sage-500"
              : listening
                ? "bg-clay-500 hover:bg-clay-600"
                : "bg-leaf-600 hover:bg-leaf-700",
          disabled ? "cursor-not-allowed opacity-60" : "active:scale-95",
        )}
      >
        {state === "processing" ? (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none h-9 w-9 rounded-full border-[3px] border-paper/40 border-t-paper"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        ) : listening ? (
          <span aria-hidden="true" className="pointer-events-none flex h-9 items-end gap-1">
            {BARS.map((h, i) => (
              <motion.span
                key={i}
                className="w-1 rounded-full bg-paper"
                animate={{ height: [10, 10 + h * 22, 10] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
              />
            ))}
          </span>
        ) : (
          <IconMic className="pointer-events-none h-11 w-11" />
        )}
      </button>

      {/* Live level meter + max-time countdown, only while actually listening. */}
      {listening && (
        <div className="pointer-events-none absolute -bottom-5 flex flex-col items-center gap-1">
          <div className="flex h-1 w-20 overflow-hidden rounded-full bg-mist">
            <motion.div
              className="h-full bg-leaf-500"
              animate={{ width: `${Math.round((metrics?.level ?? 0) * 100)}%` }}
              transition={{ duration: 0.12 }}
            />
          </div>
          <span className="text-[11px] font-semibold text-sage">
            {t("mic.secondsLeft", { seconds: secondsLeft })}
            {metrics?.speechDetected ? ` · ${t("mic.speechHeard")}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
