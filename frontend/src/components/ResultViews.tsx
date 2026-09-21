import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { CropOutput, DiseaseOutput, ModelResult, WeedPestOutput } from "../types";
import { AnimatedNumber } from "./AnimatedNumber";
import { ProgressRing } from "./ProgressRing";
import { ConfidenceStamp, DataNote, Stamp, WarningBanner } from "./Stamps";
import { IconLeaf, IconMapPin, IconPause, IconPlay } from "./Icons";
import { cn } from "../lib/utils";
import { tValue } from "../lib/i18n";
import { fadeUp } from "../lib/motion";

// ---- typewriter (used for transcription + the spoken answer) ----

export function useTypewriter(text: string | undefined, active: boolean, speed = 7, delay = 0) {
  const [len, setLen] = useState(active && text ? 0 : text?.length ?? 0);

  useEffect(() => {
    if (!text) {
      setLen(0);
      return;
    }
    if (!active || delay > 0) {
      if (!active) {
        setLen(text.length);
        return;
      }
    }
    setLen(0);
    let i = 0;
    let timer = 0;
    const start = () => {
      const id = window.setInterval(() => {
        i += 1;
        setLen(i);
        if (i >= text.length) window.clearInterval(id);
      }, speed);
      timer = id;
    };
    if (delay > 0) {
      const t = window.setTimeout(start, delay);
      return () => {
        window.clearTimeout(t);
        window.clearInterval(timer);
      };
    }
    start();
    return () => window.clearInterval(timer);
  }, [text, active, speed, delay]);

  return text ? text.slice(0, len) : "";
}

// ---- confidence ring + label ----

export function ConfidenceRing({
  confidence,
  label,
  size = 150,
}: {
  confidence: number;
  label?: string;
  size?: number;
}) {
  return (
    <ProgressRing value={confidence} size={size} stroke={11}>
      <div className="text-center">
        <AnimatedNumber
          value={Math.round(confidence * 100)}
          suffix="%"
          className="font-display block text-[30px] font-semibold leading-none text-pine-900"
        />
        {label && (
          <span className="mt-1.5 inline-block">
            <ConfidenceStamp label={label} />
          </span>
        )}
      </div>
    </ProgressRing>
  );
}

// ---- crop result card ----

export function CropCard({ result }: { result: CropOutput }) {
  const { t } = useTranslation();
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="card overflow-hidden p-6"
    >
      <div className="flex flex-col-reverse items-center gap-6 sm:flex-row">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage"
          >
            {t("results.suggestedCrop")}
          </motion.p>
          <h3 className="font-display mt-1.5 text-3xl font-semibold text-pine-900">
            {tValue(result.predicted_crop)}
          </h3>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] text-sage sm:justify-start">
            <IconMapPin className="h-3.5 w-3.5" />
            {result.location || "—"}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Stamp label={tValue(result.data_resolution)} tone="leaf" />
            <Stamp label={tValue(result.soil_source)} tone="pine" />
          </div>
        </div>
        <ConfidenceRing confidence={result.confidence} label={result.confidence_label} />
      </div>

      <div className="mt-6 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniStat k={t("results.soilSource")} v={tValue(result.soil_source)} />
          <MiniStat k={t("results.weatherSource")} v={tValue(result.weather_source)} />
          <MiniStat k={t("results.inputConfidence")} v={tValue(result.input_confidence ?? "—")} />
          <MiniStat k={t("results.dataResolution")} v={tValue(result.data_resolution)} />
        </div>
        <WarningBanner message={result.warning} />
        <DataNote note={result.data_quality_note} />
      </div>
    </motion.div>
  );
}

// ---- disease / pest result ----

export function DetectCard({
  result,
  kind,
}: {
  result: DiseaseOutput | WeedPestOutput;
  kind: "disease" | "weed" | "pest";
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="card overflow-hidden p-6"
    >
      <div className="flex flex-col-reverse items-center gap-6 sm:flex-row">
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage"
          >
            {kind === "disease" ? t("results.mostLikely") : t("results.identifiedPest")}
          </motion.p>
          <h3 className="font-display mt-1.5 text-[26px] font-semibold leading-tight text-pine-900">
            {tValue(result.predicted_class)}
          </h3>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Stamp
              label={tValue(result.confidence >= 0.7 ? "confident" : result.confidence >= 0.45 ? "moderate" : "uncertain")}
              tone={result.confidence >= 0.7 ? "leaf" : result.confidence >= 0.45 ? "honey" : "clay"}
            />
            <Stamp label={kind === "disease" ? t("results.plantVillage") : t("results.deepWeed")} tone="pine" />
          </div>
        </div>
        <ConfidenceRing confidence={result.confidence} size={150} />
      </div>
    </motion.div>
  );
}

// ---- generic model result (from /voice/query results[]) ----

export function ModelRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[12.5px] text-sage">{label}</span>
      <span className="text-right text-[12.5px] font-medium text-pine-900">{value}</span>
    </div>
  );
}

export function VoiceResultCard({ model, result }: { model: string; result: ModelResult }) {
  const { t } = useTranslation();
  const confidence = Number(result.confidence ?? 0);
  const label = result.confidence_label as string | undefined;
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="card flex items-center gap-4 p-5"
    >
      <ConfidenceRing confidence={confidence} label={label} size={96} />
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sage">
          {model}
        </span>
        <p className="font-display mt-1 truncate text-lg font-semibold text-pine-900">
          {tValue(String(result.predicted_crop ?? result.predicted_class ?? "—"))}
        </p>
        <div className="mt-2 space-y-0.5">
          <ModelRow label={t("results.location")} value={result.location ?? null} />
          <ModelRow label={t("results.data")} value={tValue(result.data_resolution ?? null) ?? null} />
        </div>
      </div>
    </motion.div>
  );
}

function MiniStat({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="rounded-xl bg-paper p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sage">{k}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-pine-900" title={v ?? undefined}>
        {v ?? "—"}
      </p>
    </div>
  );
}

// ---- TTS audio player ----

const EQ_BARS = [5, 9, 6, 11, 7, 12, 6, 9, 5, 8];

export function AudioBar({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    const onTime = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    const onEnd = () => setPlaying(false);
    const onPause = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("pause", onPause);
    };
  }, [url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
    }
  };

  const lit = Math.round(progress * EQ_BARS.length);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-mist bg-surface p-3 shadow-edge">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("audioBar.pauseAria") : t("audioBar.playAria")}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pine-700 to-leaf-600 text-paper shadow-card transition-transform duration-150 hover:scale-105 active:scale-95"
      >
        {playing ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5" />}
      </button>
      <div className="flex h-8 flex-1 items-center justify-center gap-[3px]">
        {EQ_BARS.map((h, i) => {
          const on = playing && i < lit;
          return (
            <span
              key={i}
              className={cn(
                "w-[3px] rounded-full transition-colors duration-150",
                on ? "bg-leaf-500" : i < lit ? "bg-leaf-300" : "bg-mist",
              )}
              style={{ height: h }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function TranscriptBlock({
  label,
  text,
  active,
  delay = 0,
  className,
}: {
  label: string;
  text: string;
  active: boolean;
  delay?: number;
  className?: string;
}) {
  const typed = useTypewriter(text, active, 8, delay);
  const done = !active || typed.length >= (text?.length ?? 0);
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className={className}>
      <p className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-sage">
        <IconLeaf className="h-3.5 w-3.5 text-leaf-600" />
        {label}
      </p>
      <p className="rounded-2xl border border-mist bg-surface p-4 text-[15px] leading-relaxed text-pine-900" dir="auto">
        {typed || <span className="text-sage/60">…</span>}
        {!done && <Cursor />}
      </p>
    </motion.div>
  );
}

function Cursor() {
  return <motion.span aria-hidden animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] bg-honey-500" />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-sage">{children}</p>
  );
}