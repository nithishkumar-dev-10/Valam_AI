import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../components/Button";
import { Segmented } from "../components/Segmented";
import { UploadDropzone } from "../components/UploadDropzone";
import { Burst } from "../components/Burst";
import { DetectCard } from "../components/ResultViews";
import { IconAlert, IconLeaf, IconRefresh, IconScan } from "../components/Icons";
import type { DiseaseOutput, WeedPestOutput } from "../types";
import { PredictAPI } from "../lib/api";
import { apiErrorMessage } from "../lib/utils";
import { fadeUp } from "../lib/motion";

type Target = "disease" | "pest";
type Phase = "input" | "analyzing" | "result" | "error";

const PROGRESS: Record<Target, string[]> = {
  disease: [
    "Reading the photo…",
    "Looking for leaf patterns…",
    "Comparing against 38 plant conditions…",
    "Calibrating confidence…",
  ],
  pest: [
    "Reading the photo…",
    "Scanning for weeds & pests…",
    "Matching against the species gallery…",
    "Calibrating confidence…",
  ],
};

export function ScanPage() {
  const [target, setTarget] = useState<Target>("disease");
  const [phase, setPhase] = useState<Phase>("input");
  const [file, setFile] = useState<File | null>(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const [result, setResult] = useState<DiseaseOutput | WeedPestOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tickerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
    };
  }, []);

  const analyze = async (t: Target, f: File) => {
    setPhase("analyzing");
    setError(null);
    setProgressIndex(0);
    tickerRef.current = window.setInterval(() => {
      setProgressIndex((i) => (i + 1) % PROGRESS[t].length);
    }, 900);

    try {
      const data = t === "disease" ? await PredictAPI.disease(f) : await PredictAPI.pest(f);
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
    if (file) void analyze(target, file);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setPhase("input");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="text-center sm:text-left">
        <h1 className="font-display text-3xl font-semibold text-pine-900 sm:text-4xl">
          What&apos;s on this leaf?
        </h1>
        <p className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-sage sm:mx-0">
          Add a clear field photo — a vision model checks it and shows its confidence, not just a name.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-6 flex justify-center sm:justify-start">
        <Segmented<Target>
          id="scan-target"
          options={[
            { value: "disease", label: "Disease", icon: <IconLeaf className="h-4 w-4" /> },
            { value: "pest", label: "Pest & weed", icon: <IconScan className="h-4 w-4" /> },
          ]}
          value={target}
          onChange={(t) => {
            setTarget(t);
            if (phase === "result") reset();
          }}
        />
      </motion.div>

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
            <Button onClick={() => file && void analyze(target, file)} disabled={!file} full className="max-w-md">
              {file ? `Analyze ${target === "disease" ? "for disease" : "for pests"}` : "Add a photo first"}
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
                  Analyzing your photo
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

        {phase === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative mt-6"
          >
            <Burst burst={burst} />
            <DetectCard result={result} kind={target} />
            <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row">
              <Button onClick={reset} full>
                Scan another
              </Button>
              <Button
                variant="secondary"
                onClick={() => setTarget(target === "disease" ? "pest" : "disease")}
                full
              >
                {target === "disease" ? "Also check for pests" : "Also check for disease"}
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
              <p className="font-display text-lg font-semibold text-pine-900">The scan failed</p>
              <p className="mt-1 max-w-sm text-[13.5px] text-sage">{error}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={reset}>
                New photo
              </Button>
              <Button variant="primary" onClick={retry}>
                <IconRefresh className="h-4 w-4" /> Try again
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
          Best in daylight, leaf flat and filling the frame. Blurry or tiny leaves → weaker confidence.
        </motion.p>
      )}
    </div>
  );
}