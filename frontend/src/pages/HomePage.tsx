import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { FeatureCard } from "../components/FeatureCard";
import { MicButton } from "../components/MicButton";
import { UploadDropzone } from "../components/UploadDropzone";
import {
  AudioBar,
  CropCard,
  DetectCard,
  TranscriptBlock,
  VoiceResultCard,
} from "../components/ResultViews";
import {
  IconAlert,
  IconDroplet,
  IconEar,
  IconLeaf,
  IconScan,
  IconSparkle,
  IconSun,
} from "../components/Icons";
import type { DiseaseOutput, UnifiedVoiceResponse, WeedPestOutput } from "../types";
import { PredictAPI, VoiceAPI } from "../lib/api";
import { useVoiceRecorder } from "../lib/useVoiceRecorder";
import { useAuth } from "../lib/auth";
import { getAppLang } from "../lib/i18n";
import { fadeUp, staggerParent, SPRING } from "../lib/motion";
import { useToast } from "../lib/toast";
import { apiErrorMessage, cn } from "../lib/utils";

type ImageIntent = "disease" | "weed" | "pest" | "crop";
type Phase = "input" | "working" | "done" | "error";

const INTENTS: ImageIntent[] = ["disease", "weed", "pest", "crop"];

export function HomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();
  const { status, farmer } = useAuth();
  const lang = getAppLang();

  const { recState, setRecState, micTap, resetRecorder } = useVoiceRecorder((blob) => {
    setAudioBlob(blob);
    return submitVoice(blob, imageFile);
  });

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [intent, setIntent] = useState<ImageIntent | null>(null);

  const [phase, setPhase] = useState<Phase>("input");
  const [progressIndex, setProgressIndex] = useState(0);
  const [response, setResponse] = useState<UnifiedVoiceResponse | null>(null);
  const [imageResult, setImageResult] = useState<DiseaseOutput | WeedPestOutput | null>(null);
  const [imageKind, setImageKind] = useState<"disease" | "weed" | "pest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tickerRef = useRef<number | null>(null);

  const PROGRESS: Record<Exclude<ImageIntent, "crop">, string[]> = {
    disease: t("scan.progressDisease", { returnObjects: true }) as unknown as string[],
    weed: t("scan.progressWeed", { returnObjects: true }) as unknown as string[],
    pest: t("scan.progressPest", { returnObjects: true }) as unknown as string[],
  };
  const VOICE_PROGRESS: string[] = t("voice.progress", { returnObjects: true }) as unknown as string[];

  const intentLabel = (intentName?: string): string =>
    t(`voice.intent.${intentName ?? "unknown"}` as const);

  const FEATURES = [
    {
      to: "/crop",
      title: t("home.features.crop.title"),
      description: t("home.features.crop.description"),
      icon: <IconEar className="h-6 w-6" />,
      accent: "honey" as const,
    },
    {
      to: "/scan",
      title: t("home.features.disease.title"),
      description: t("home.features.disease.description"),
      icon: <IconLeaf className="h-6 w-6" />,
      accent: "leaf" as const,
    },
    {
      to: "/scan",
      title: t("home.features.pest.title"),
      description: t("home.features.pest.description"),
      icon: <IconScan className="h-6 w-6" />,
      accent: "clay" as const,
    },
  ];

  const STEPS = [
    { n: "01", title: t("home.steps.one.title"), description: t("home.steps.one.description") },
    { n: "02", title: t("home.steps.two.title"), description: t("home.steps.two.description") },
    { n: "03", title: t("home.steps.three.title"), description: t("home.steps.three.description") },
  ];

  const SOURCES = [
    { icon: IconSun, label: t("home.sources.power") },
    { icon: IconDroplet, label: t("home.sources.weather") },
    { icon: IconLeaf, label: t("home.sources.soil") },
    { icon: IconSparkle, label: t("home.sources.models") },
  ];

  useEffect(() => {
    return () => {
      if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
    };
  }, []);

  const clearTicker = () => {
    if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
    tickerRef.current = null;
  };

  const submitVoice = async (audio: Blob, image: File | null) => {
    setPhase("working");
    setError(null);
    setResponse(null);
    setImageResult(null);
    setRecState("processing");
    setProgressIndex(0);
    tickerRef.current = window.setInterval(() => {
      setProgressIndex((i) => (i + 1) % VOICE_PROGRESS.length);
    }, 950);

    try {
      const data = await VoiceAPI.query({ audio, image: image ?? undefined, lang });
      clearTicker();
      setResponse(data);
      setPhase("done");
      setRecState("idle");
    } catch (err) {
      clearTicker();
      setError(apiErrorMessage(err));
      setPhase("error");
      setRecState("idle");
    }
  };

  const submitImage = async () => {
    if (!imageFile) return;
    if (intent === "crop") {
      navigate("/crop");
      return;
    }
    if (!intent) {
      toast.info(t("home.toastPick.title"), t("home.toastPick.msg"));
      return;
    }
    setPhase("working");
    setError(null);
    setResponse(null);
    setImageResult(null);
    setProgressIndex(0);
    const list = PROGRESS[intent];
    tickerRef.current = window.setInterval(() => {
      setProgressIndex((i) => (i + 1) % list.length);
    }, 900);

    try {
      const data =
        intent === "disease"
          ? await PredictAPI.disease(imageFile)
          : intent === "weed"
            ? await PredictAPI.weed(imageFile)
            : await PredictAPI.pest(imageFile);
      clearTicker();
      setImageResult(data);
      setImageKind(intent);
      setPhase("done");
    } catch (err) {
      clearTicker();
      setError(apiErrorMessage(err));
      setPhase("error");
    }
  };

  const retry = () => {
    if (audioBlob) void submitVoice(audioBlob, imageFile);
    else if (imageFile) void submitImage();
  };

  const reset = () => {
    clearTicker();
    setAudioBlob(null);
    setImageFile(null);
    setIntent(null);
    setResponse(null);
    setImageResult(null);
    setImageKind(null);
    setError(null);
    resetRecorder();
    setPhase("input");
  };

  const progressList = audioBlob ? VOICE_PROGRESS : intent ? PROGRESS[intent as Exclude<ImageIntent, "crop">] : VOICE_PROGRESS;

  return (
    <>
      <section className="relative overflow-hidden pb-2 pt-2 sm:pb-4 sm:pt-6">
        <HeroArt />
        <motion.div
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto max-w-2xl text-center"
        >
          <motion.span
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full border border-leaf-200 bg-leaf-50/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-leaf-800"
          >
            <IconSparkle className="h-3.5 w-3.5" />
            {status === "authed" && farmer
              ? t("home.greeting", { name: farmer.name.split(" ")[0] })
              : t("home.badgeAnon")}
            <span className="font-normal text-leaf-600">{t("home.badgeTamil")}</span>
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="font-display mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-pine-900 sm:text-6xl"
          >
            {t("home.titleLine1")}
            <br />
            {t("home.titlePrefix")}{" "}
            <span className="relative text-honey-600">
              {t("home.titleAccent")}
              <motion.svg
                viewBox="0 0 120 10"
                className="absolute -bottom-1 left-0 h-2.5 w-full text-honey-400"
                fill="none"
                aria-hidden="true"
              >
                <motion.path
                  d="M2 8C30 3 60 3 118 6"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                />
              </motion.svg>
            </span>
            .
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-sage sm:text-base"
          >
            {t("home.subtitle")}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mx-auto mt-8 max-w-3xl text-left"
          >
            <div className="card p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-pine-900">
                {t("home.inputTitle")}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-sage">
                {t("home.inputSub")}
              </p>

              <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="grid place-items-center">
                  <MicButton state={recState} onPress={micTap} />
                </div>
                <UploadDropzone
                  file={imageFile}
                  analyzing={phase === "working" && !audioBlob}
                  apiError={phase === "error" ? error : null}
                  onFile={setImageFile}
                  compact
                />
              </div>

              {audioBlob && phase !== "working" && (
                <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-sage">
                  <span className="h-1.5 w-1.5 rounded-full bg-leaf-500" />
                  {t("home.voiceWithPhoto")}
                </p>
              )}

              {phase === "input" && imageFile && !audioBlob && (
                <div className="mt-5 border-t border-mist pt-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-sage">
                    {t("home.pickIntent")}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {INTENTS.map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setIntent(i === intent ? null : i)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200",
                          intent === i
                            ? "border-pine-700 bg-pine-700 text-paper shadow-card"
                            : "border-mist bg-surface text-sage hover:border-leaf-300 hover:text-pine-800",
                        )}
                      >
                        {t(`home.intent.${i}` as const)}
                      </button>
                    ))}
                  </div>
                  {intent === "crop" && (
                    <p className="mt-2 text-[12.5px] text-sage">{t("home.cropOpenHint")}</p>
                  )}
                  <div className="mt-4 flex justify-center">
                    <Button
                      onClick={() => void submitImage()}
                      disabled={!intent}
                      full
                      className="max-w-md"
                    >
                      {intent === "crop" ? t("crop.suggest") : t("home.analyze")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </section>

      <motion.div className="mx-auto mt-2 max-w-3xl">
        <AnimatePresence mode="wait">
          {phase === "working" && (
            <motion.div
              key="working"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card flex items-center gap-4 overflow-hidden p-5"
            >
              <div className="flex h-9 items-end gap-1">
                {[0.5, 1, 0.65, 1, 0.8, 1, 0.55, 0.9].map((h, i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 rounded-full bg-leaf-500"
                    style={{ height: 14 }}
                    animate={{ scaleY: [h, 1, h] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.09 }}
                  />
                ))}
              </div>
              <div className="min-w-0">
                <p className="font-display animate-pulse text-[15px] font-semibold text-pine-900">
                  {audioBlob ? t("voice.thinking") : t("scan.analyzing")}
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={progressIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="truncate text-[12.5px] text-sage"
                  >
                    {progressList[progressIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="card mt-4 flex flex-col items-center gap-3 p-6 text-center"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-clay-100 text-clay-600">
                <IconAlert className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-pine-900">
                  {t("voice.errorTitle")}
                </p>
                <p className="mt-1 max-w-sm text-[13.5px] text-sage">{error}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="secondary" onClick={reset}>
                  {t("dropzone.removeAria")}
                </Button>
                <Button onClick={() => void retry()}>
                  {t("voice.tryAgain")}
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "done" && imageResult && imageKind && (
            <motion.div
              key="image-result"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: SPRING }}
              className="mt-4 space-y-4"
            >
              <DetectCard result={imageResult} kind={imageKind} />
              <div className="flex justify-center">
                <Button variant="secondary" onClick={reset} full className="max-w-md">
                  {t("scan.scanAnother")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === "done" && response && (
          <motion.div
            key="response"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: SPRING }}
            className="mt-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-200 bg-leaf-50 px-3 py-1 text-[12px] font-semibold text-leaf-800">
                <IconSparkle className="h-3.5 w-3.5" />
                {intentLabel(response.intent ?? undefined)}
              </span>
              <button
                type="button"
                onClick={reset}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-sage transition-colors hover:bg-pine-50 hover:text-pine-800"
              >
                {t("voice.startOver")}
              </button>
            </div>

            {response.transcribed_text && (
              <TranscriptBlock label={t("voice.transcriptHeard")} text={response.transcribed_text} active />
            )}
            <TranscriptBlock
              label={t("voice.transcriptAnswer")}
              text={response.text_response || response.response_text || ""}
              active
              delay={420}
            />
            {response.audio_url && <AudioBar url={response.audio_url} />}

            {(response.crop_result ||
              response.disease_result ||
              response.pest_result ||
              response.results.length > 0) && (
              <div className="pt-2">
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-sage">
                  {t("voice.fieldData")}
                </p>
                <div className="grid gap-3">
                  {response.crop_result && <CropCard result={response.crop_result} />}
                  {response.disease_result && (
                    <DetectCard result={response.disease_result} kind="disease" />
                  )}
                  {response.pest_result && <DetectCard result={response.pest_result} kind="pest" />}
                  {response.results.map((r, i) => (
                    <VoiceResultCard key={`${r.model}-${i}`} model={r.model} result={r} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      <motion.section
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </motion.section>

      <motion.section
        variants={staggerParent}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="mt-14"
      >
        <h2 className="font-display text-center text-2xl font-semibold text-pine-900 sm:text-3xl">
          {t("home.stepsTitle")}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <motion.div variants={fadeUp} key={s.n} className="card card-lift relative p-6">
              <span className="font-display text-4xl font-semibold text-leaf-200">{s.n}</span>
              <h3 className="font-display mt-2 text-lg font-semibold text-pine-900">{s.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-sage">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-12"
      >
        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-mist bg-surface/70 px-5 py-4">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-sage">
            {t("home.sourcesTitle")}
          </span>
          {SOURCES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-paper px-3 py-1.5 text-[12.5px] font-medium text-pine-800"
            >
              <Icon className="h-3.5 w-3.5 text-leaf-600" />
              {label}
            </span>
          ))}
        </div>
        <p className="mt-6 text-center text-[12px] leading-relaxed text-sage">{t("home.footer")}</p>
      </motion.section>
    </>
  );
}

function HeroArt() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <motion.div
        animate={{ x: [0, -10, 0], y: [0, 8, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-16 -top-8 text-honey-200 sm:right-8 sm:top-2"
      >
        <IconSun className="h-40 w-40 opacity-70 sm:h-52 sm:w-52" />
      </motion.div>
      <motion.div
        animate={{ x: [0, 12, 0], y: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-20 bottom-4 text-leaf-200 sm:left-4"
      >
        <IconLeaf className="h-36 w-36 opacity-60" />
      </motion.div>
    </div>
  );
}