import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Segmented } from "./Segmented";
import { ResultSkeleton } from "./Skeleton";
import { CropCard } from "./ResultViews";
import { ConfidenceStamp, Stamp } from "./Stamps";
import { IconAlert, IconMapPin, IconRefresh } from "./Icons";
import type { CropOutput, ManualCropInput } from "../types";
import { CropAPI } from "../lib/api";
import { getPosition, coordsInIndia } from "../lib/geo";
import { useToast } from "../lib/toast";
import { apiErrorMessage, cn } from "../lib/utils";
import { tValue } from "../lib/i18n";
import { fadeUp, staggerParent } from "../lib/motion";

type Mode = "gps" | "manual";
type Phase = "input" | "loading" | "result" | "error";

interface GpsState {
  latitude: number;
  longitude: number;
}

interface ManualState {
  N: number;
  P: number;
  K: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
}

const DEFAULT_MANUAL: ManualState = {
  N: 50,
  P: 40,
  K: 40,
  temperature: 25,
  humidity: 60,
  ph: 6.5,
  rainfall: 150,
};

export function CropForm() {
  const toast = useToast();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("gps");
  const [phase, setPhase] = useState<Phase>("input");

  const FIELDS: Array<{
    key: keyof ManualState;
    label: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    decimals?: number;
  }> = [
    { key: "N", label: t("crop.fields.n"), unit: t("crop.units.kgHa"), min: 0, max: 140, step: 1 },
    { key: "P", label: t("crop.fields.p"), unit: t("crop.units.kgHa"), min: 0, max: 145, step: 1 },
    { key: "K", label: t("crop.fields.k"), unit: t("crop.units.kgHa"), min: 0, max: 205, step: 1 },
    { key: "temperature", label: t("crop.fields.temperature"), unit: t("crop.units.celsius"), min: 8, max: 44, step: 0.5, decimals: 1 },
    { key: "humidity", label: t("crop.fields.humidity"), unit: t("crop.units.percent"), min: 10, max: 100, step: 1 },
    { key: "ph", label: t("crop.fields.ph"), unit: "", min: 3.5, max: 9.9, step: 0.1, decimals: 1 },
    { key: "rainfall", label: t("crop.fields.rainfall"), unit: t("crop.units.mmYr"), min: 20, max: 300, step: 1 },
  ];

  const [gps, setGps] = useState<GpsState | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsManual, setGpsManual] = useState(false);

  const [manual, setManual] = useState<ManualState>(DEFAULT_MANUAL);

  const [result, setResult] = useState<CropOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<(() => Promise<void>) | null>(null);

  const run = (fn: () => Promise<void>) => {
    pendingRef.current = fn;
    void fn();
  };

  const runSimple = async (lat: number, lon: number) => {
    setPhase("loading");
    setError(null);
    try {
      const data = await CropAPI.simple(lat, lon);
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError(apiErrorMessage(err));
      setPhase("error");
    }
  };

  const runManual = async () => {
    setPhase("loading");
    setError(null);
    try {
      const payload: ManualCropInput = { ...manual };
      const data = await CropAPI.manual(payload);
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError(apiErrorMessage(err));
      setPhase("error");
    }
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { latitude, longitude } = await getPosition();
      setGps({ latitude, longitude });
      if (!coordsInIndia(latitude, longitude)) {
        toast.info(t("crop.toastOutsideTitle"), t("crop.toastOutsideMsg"));
      }
    } catch (err) {
      toast.error(t("crop.toastLocErrTitle"), tValue(apiErrorMessage(err)));
      setGpsManual(true);
    } finally {
      setLocating(false);
    }
  };

  const submit = () => {
    if (mode === "gps") {
      if (!gps) {
        toast.info(t("crop.toastAddTitle"), t("crop.toastAddMsg"));
        return;
      }
      run(() => runSimple(gps.latitude, gps.longitude));
    } else {
      run(runManual);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setPhase("input");
  };

  return (
    <>
      <motion.div variants={staggerParent} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="flex justify-center sm:justify-start">
          <Segmented<Mode>
            id="crop-mode"
            options={[
              { value: "gps", label: t("crop.segGps") },
              { value: "manual", label: t("crop.segManual") },
            ]}
            value={mode}
            onChange={setMode}
          />
        </motion.div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28 }}
          className="mt-6"
        >
          {mode === "gps" ? (
            <div className="card space-y-4 p-6">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-honey-100 text-honey-600">
                  <IconMapPin className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-pine-900">{t("crop.gpsTitle")}</h2>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-sage">
                    {t("crop.gpsDesc")}
                  </p>
                </div>
              </div>

              {gps ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between rounded-xl border border-leaf-200 bg-leaf-50 p-3.5"
                >
                  <span className="tnum text-sm font-semibold text-leaf-800">
                    {gps.latitude.toFixed(4)}°N, {gps.longitude.toFixed(4)}°E
                  </span>
                  <button
                    type="button"
                    onClick={useMyLocation}
                    className="text-[12.5px] font-medium text-pine-700 underline-offset-4 hover:underline"
                  >
                    {t("crop.refresh")}
                  </button>
                </motion.div>
              ) : (
                <Button
                  variant="primary"
                  loading={locating}
                  full
                  onClick={useMyLocation}
                  className="bg-gradient-to-br from-honey-400 to-honey-500 text-pine-950"
                >
                  {locating ? t("crop.findingLocation") : t("crop.useLocation")}
                  {!locating && <IconMapPin className="h-4 w-4" />}
                </Button>
              )}

              <div className="flex items-center gap-3 text-[12.5px] text-sage">
                <button
                  type="button"
                  onClick={() => setGpsManual((v) => !v)}
                  className="font-medium text-pine-700 underline-offset-4 hover:underline"
                >
                  {gpsManual ? t("crop.hide") : t("crop.enterCoords")}
                </button>
                <span className="h-3 w-px bg-mist" />
                <IconAlert className="h-3.5 w-3.5 text-honey-500" />
                <span>{t("crop.worksBest")}</span>
              </div>

              <AnimatePresence>
                {gpsManual && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <NumberChip
                        label={t("crop.latitude")}
                        value={gps?.latitude}
                        min={6}
                        max={37.5}
                        step={0.0001}
                        onChange={(v) => setGps((g) => ({ ...(g ?? { longitude: 80 }), latitude: v }))}
                      />
                      <NumberChip
                        label={t("crop.longitude")}
                        value={gps?.longitude}
                        min={68}
                        max={97.5}
                        step={0.0001}
                        onChange={(v) => setGps((g) => ({ ...(g ?? { latitude: 15 }), longitude: v }))}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="card space-y-5 p-6">
              <p className="text-[13px] leading-relaxed text-sage">
                {t("crop.manualIntro")}
              </p>
              {FIELDS.map((f) => (
                <MeasureRow
                  key={f.key}
                  label={f.label}
                  unit={f.unit}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  decimals={f.decimals}
                  value={manual[f.key]}
                  onChange={(v) => setManual((m) => ({ ...m, [f.key]: v }))}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {phase === "input" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex justify-center"
        >
          <Button onClick={submit} full className="max-w-md">
            {t("crop.suggest")}
          </Button>
        </motion.div>
      )}

      <div className="mt-8">
        <AnimatePresence mode="wait">
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <ResultSkeleton />
              <p className="mt-3 text-center text-[13px] font-medium text-sage">
                {t("crop.loading")}
              </p>
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="card flex flex-col items-center gap-4 p-8 text-center"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-clay-100 text-clay-600">
                <IconAlert className="h-7 w-7" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-pine-900">
                  {t("crop.errorTitle")}
                </p>
                <p className="mt-1 max-w-sm text-[13.5px] text-sage">{error}</p>
              </div>
              <Button variant="danger" onClick={() => pendingRef.current?.()}>
                <IconRefresh className="h-4 w-4" /> {t("crop.tryAgain")}
              </Button>
            </motion.div>
          )}

          {phase === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <CropCard result={result} />
              <div className="flex items-center justify-between rounded-2xl border border-mist bg-surface px-5 py-4 shadow-edge">
                <div className="flex flex-wrap items-center gap-2">
                  <ConfidenceStamp label={result.confidence_label} />
                  <Stamp label={tValue(result.input_confidence ?? "—")} tone="pine" />
                </div>
                <Button variant="secondary" onClick={reset}>
                  {t("crop.askAgain")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function MeasureRow({
  label,
  unit,
  min,
  max,
  step,
  decimals = 0,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[13px] font-medium text-pine-900">
          {label}
          {unit && <span className="ml-1 text-[11.5px] font-normal text-sage">{unit}</span>}
        </label>
        <span className="tnum rounded-lg bg-pine-50 px-2 py-0.5 text-[13px] font-semibold text-pine-800">
          {value.toFixed(decimals)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-input w-full"
        aria-label={label}
        style={{ "--fill": `${pct}%` } as CSSProperties}
      />
    </div>
  );
}

function NumberChip({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value?: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-sage">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value === undefined ? "" : value}
        placeholder="—"
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className={cn(
          "tnum h-10 w-full rounded-xl border border-mist bg-surface px-3 text-sm text-ink outline-none transition-all duration-200",
          "focus:border-pine-500 shadow-[0_0_0_3px_rgba(30,91,60,0.09)]",
        )}
      />
    </label>
  );
}