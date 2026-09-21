import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { UploadDropzone } from "../components/UploadDropzone";
import { Burst } from "../components/Burst";
import { CropForm } from "../components/CropForm";
import { DetectCard } from "../components/ResultViews";
import { IconAlert, IconEar, IconLeaf, IconRefresh, IconScan } from "../components/Icons";
import type { DiseaseOutput, WeedPestOutput } from "../types";
import { PredictAPI } from "../lib/api";
import { apiErrorMessage, cn } from "../lib/utils";
import { fadeUp } from "../lib/motion";

type Target = "disease" | "weed" | "pest" | "crop";
type DetectTarget = Exclude<Target, "crop">;
type Phase = "input" | "analyzing" | "result" | "error";

export function ScanPage() {
  const { t } = useTranslation();
  const PROGRESS: Record<DetectTarget, string[]> = {
    disease: t("scan.progressDisease", { returnObjects: true }) as unknown as string[],
    weed: t("scan.progressWeed", { returnObjects: true }) as unknown as string[],
    pest: t("scan.progressPest", { returnObjects: true }) as unknown as string[],
  };
  const [target, setTarget] = useState<Target>("disease");
  const [phase, setPhase] = useState<Phase>("input");
  const [file, setFile] = useState<File | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const [result, setResult] = useState<DiseaseOutput | WeedPestOutput | null>(null);
  const [resultKind, setResultKind] = useState<DetectTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tickerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
    };
  }, []);

  const analyze = async (tl: DetectTarget, f: File) => {
    setPhase("analyzing");
    setError(null);
    setResultKind(tl);
    setProgressIndex(0);
    const list = PROGRESS[tl];
    tickerRef.current = window.setInterval(() => {
      setProgressIndex((i) => (i + 1) % list.length);
    }, 900);

    try {
      const data =
        tl === "disease"
          ? await PredictAPI.disease(f)
          : tl === "weed"
            ? await PredictAPI.weed(f)
            : await PredictAPI.pest(f);
      if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
      setResult(data);
      setPhase("result");
      if (data.confidence >= 0.8) setBurst((b) => b + 1);
    } catch (err) {
      if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
      setError(apiErrorMessage(err));
      setPhase("error");
    }
  };

  const retry = () => {
    if (file && target !== "crop") void analyze(target, file);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setResultKind(null);
    setError(null);
    setPhase("input");
  };

  const switchTab = (next: Target) => {
    setTarget(next);
    if (phase === "result") reset();
  };

  const TABS: Array<{ value: Target; label: string; icon: ReactNode }> = [
    { value: "disease", label: t("scan.tabs.disease"), icon: <IconLeaf className="h-4 w-4" /> },
    { value: "weed", label: t("scan.tabs.weed"), icon: <IconScan className="h-4 w-4" /> },
    { value: "pest", label: t("scan.tabs.pest"), icon: <IconScan className="h-4 w-4" /> },
    { value: "crop", label: t("scan.tabs.crop"), icon: <IconEar className="h-4 w-4" /> },
  ];

  const analyzeLabel =
    target === "disease"
      ? t("scan.analyzeDisease")
      : target === "weed"
        ? t("scan.analyzeWeed")
        : t("scan.analyzePest");

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="text-center sm:text-left">
        <h1 className="font-display text-3xl font-semibold text-pine-900 sm:text-4xl">
          {t("scan.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-sage sm:mx-0">
          {t("scan.subtitle")}
        </p>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((tb) => {
          const active = tb.value === target;
          return (
            <button
              key={tb.value}
              type="button"
              onClick={() => switchTab(tb.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-[13px] font-semibold transition-colors duration-200",
                active
                  ? "border-pine-700 bg-gradient-to-br from-pine-700 to-leaf-600 text-paper shadow-card"
                  : "border-mist bg-surface text-sage hover:border-leaf-300 hover:text-pine-800",
              )}
            >
              {tb.icon}
              {tb.label}
            </button>
          );
        })}
      </motion.div>

      {target === "crop" ? (
        <div className="mt-8">
          <CropForm />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <UploadDropzone
              file={file}
              analyzing={phase === "analyzing"}
              apiError={phase === "error" ? error : null}
              onFile={setFile}
            />
          </div>

          <AnimatePresence mode="wait">
            {phase === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 flex justify-center"
              >
                <Button
                  onClick={() => file && void analyze(target, file)}
                  disabled={!file}
                  full
                  className="max-w-md"
                >
                  {file ? analyzeLabel : t("scan.addPhotoFirst")}
                </Button>
              </motion.div>
            )}

            {phase === "analyzing" && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card mt-6 flex items-center justify-between gap-4 overflow-hidden p-5"
              >
                <div className="flex items-center gap-3.5">
                  <span className="relative grid h-10 w-10 place-items-center">
                    <motion.span
                      className="absolute inset-0 rounded-full border-2 border-leaf-200 border-t-leaf-600"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                    />
                    <IconScan className="h-5 w-5 text-leaf-600" />
                  </span>
                  <div>
                    <p className="font-display animate-pulse text-[15px] font-semibold text-pine-900">
                      {t("scan.analyzing")}
                    </p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={progressIndex}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25 }}
                        className="text-[12.5px] text-sage"
                      >
                        {PROGRESS[target][progressIndex]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
                <div className="hidden gap-1.5 sm:flex">
                  {PROGRESS[target].map((_, i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full"
                      animate={{ backgroundColor: i <= progressIndex ? "#3e9b6a" : "#ece5d6" }}
                      transition={{ duration: 0.3 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {phase === "result" && result && resultKind && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative mt-6"
              >
                <Burst burst={burst} />
                <DetectCard result={result} kind={resultKind} />
                <div className="mt-4 flex justify-center">
                  <Button onClick={reset} full className="max-w-md">
                    {t("scan.scanAnother")}
                  </Button>
                </div>
              </motion.div>
            )}

            {phase === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="card mt-6 flex flex-col items-center gap-4 p-8 text-center"
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-clay-100 text-clay-600">
                  <IconAlert className="h-7 w-7" />
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-pine-900">{t("scan.errorTitle")}</p>
                  <p className="mt-1 max-w-sm text-[13.5px] text-sage">{error}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={reset}>
                    {t("scan.newPhoto")}
                  </Button>
                  <Button variant="primary" onClick={retry}>
                    <IconRefresh className="h-4 w-4" /> {t("scan.tryAgain")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === "input" && !file && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-center text-[12.5px] text-sage"
            >
              {t("scan.hint")}
            </motion.p>
          )}
        </>
      )}
    </div>
  );
}