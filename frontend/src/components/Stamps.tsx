import { motion } from "framer-motion";
import { IconAlert, IconShield } from "./Icons";
import { cn, confidenceTone } from "../lib/utils";
import { fadeUp } from "../lib/motion";

const TONES: Record<string, string> = {
  leaf: "bg-leaf-100 text-leaf-800 border-leaf-200",
  honey: "bg-honey-100 text-honey-700 border-honey-200",
  clay: "bg-clay-100 text-clay-700 border-clay-200",
  sage: "bg-paper text-sage border-mist",
};

export function Stamp({ label, tone = "sage", className }: { label: string; tone?: keyof typeof TONES; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wide",
        TONES[tone],
        className,
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-60" />
      {label}
    </span>
  );
}

export function ConfidenceStamp({ label }: { label?: string | null }) {
  if (!label) return null;
  const tone = confidenceTone(label);
  return <Stamp label={label} tone={tone} />;
}

export function WarningBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex items-start gap-3 rounded-xl border border-honey-200 bg-honey-50 p-3.5"
    >
      <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-honey-600" />
      <p className="text-[13px] leading-relaxed text-honey-800">{message}</p>
    </motion.div>
  );
}

export function DataNote({ note }: { note?: string | null }) {
  if (!note) return null;
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="flex items-start gap-2.5 border-t border-mist pt-3"
    >
      <IconShield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
      <p className="text-[12.5px] leading-relaxed text-sage">{note}</p>
    </motion.div>
  );
}