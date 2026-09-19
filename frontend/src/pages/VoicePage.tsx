import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../components/Button";
import { Segmented } from "../components/Segmented";
import { UploadDropzone } from "../components/UploadDropzone";
import { MicButton } from "../components/MicButton";
import {
  AudioBar,
  CropCard,
  DetectCard,
  TranscriptBlock,
  VoiceResultCard,
} from "../components/ResultViews";
import { IconAlert, IconMapPin, IconSparkle, IconX } from "../components/Icons";
import type { UnifiedVoiceResponse, VoiceLang } from "../types";
import { VoiceAPI } from "../lib/api";
import { isRecordingSupported, startRecording } from "../lib/audio";
import type { Recorder } from "../lib/audio";
import { getPosition, coordsInIndia } from "../lib/geo";
import { useToast } from "../lib/toast";
import { apiErrorMessage, fmtNumber } from "../lib/utils";
import { fadeUp, staggerParent, SPRING } from "../lib/motion";

type RecState = "idle" | "listening" | "processing";

const PROGRESS = [
  "Transcribing your voice…",
  "Working out what you need…",
  "Checking field data…",
  "Writing your answer…",
];

const INTENT_LABEL: Record<string, string> = {
  crop: "Crop suggestion",
  disease: "Disease check",
  pest: "Pest check",
  answer: "Direct answer",
  unknown: "General",
};

export function VoicePage() {
  const toast = useToast();
  const [lang, setLang] = useState<VoiceLang>(
    () => (localStorage.getItem("valam.lang") as VoiceLang) || "ta",
  );
  const [recState, setRecState] = useState<RecState>("idle");
  const recorderRef = useRef<Recorder | null>(null);

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const [progressIndex, setProgressIndex] = useState(0);
  const [response, setResponse] = useState<UnifiedVoiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tickerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem("valam.lang", lang);
  }, [lang]);

  useEffect(() => {
    return () => {
      if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
      recorderRef.current?.cancel();
    };
  }, []);

  const micTap = async () => {
    if (!isRecordingSupported()) {
      toast.error(
        "Voice recording isn't supported here",
        "You can still add a photo or your location and ask that way.",
      );
      return;
    }
    if (recState === "listening") {
      const recorder = recorderRef.current;
      if (!recorder) return;
      const blob = await recorder.stop();
      recorderRef.current = null;
      if (blob.size < 1200) {
        toast.info("That was too short", "Tap the mic again and speak a little longer.");
        setRecState("idle");
        return;
      }
      setAudioBlob(blob);
      await submit({ audio: blob });
      return;
    }
    try {
      recorderRef.current = await startRecording();
      setRecState("listening");
    } catch {
      toast.error(
        "Mic permission denied",
        "Allow microphone access, or use a photo / location instead.",
      );
    }
  };

  const submit = async (overrides?: { audio?: Blob }) => {
    const audio = overrides?.audio ?? audioBlob ?? undefined;
    const image = imageFile ?? undefined;
    const inputs = { audio, image, latitude: coords?.latitude, longitude: coords?.longitude, lang };

    if (!audio && !imageFile && !coords) {
      toast.info("Nothing to ask with", "Speak, add a photo, or drop your location — then ask again.");
      setRecState("idle");
      return;
    }

    setRecState("processing");
    setError(null);
    setResponse(null);
    setProgressIndex(0);
    tickerRef.current = window.setInterval(() => {
      setProgressIndex((i) => (i + 1) % PROGRESS.length);
    }, 950);

    try {
      const data = await VoiceAPI.query(inputs);
      if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
      setResponse(data);
      setRecState("idle");
    } catch (err) {
      if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
      setError(apiErrorMessage(err));
      setRecState("idle");
    }
  };

  const addLocation = async () => {
    setLocating(true);
    try {
      const next = await getPosition();
      setCoords(next);
      if (!coordsInIndia(next.latitude, next.longitude)) {
        toast.info("Outside India", "Crop results work best inside India's bounds.");
      }
    } catch (err) {
      toast.error("Couldn't fetch location", apiErrorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  const reset = () => {
    setAudioBlob(null);
    setImageFile(null);
    setCoords(null);
    setResponse(null);
    setError(null);
    setRecState("idle");
  };

  const working = recState === "processing";

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div variants={staggerParent} initial="hidden" animate="show" className="text-center">
        <motion.div variants={fadeUp} className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-200 bg-leaf-50 px-3 py-1 text-[12px] font-semibold text-leaf-800">
            <IconSparkle className="h-3.5 w-3.5" />
            Ask in your own words
          </span>
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="font-display mt-3 text-3xl font-semibold text-pine-900 sm:text-4xl"
        >
          The farm, in your voice.
        </motion.h1>
        <motion.p variants={fadeUp} className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-sage">
          Speak in Tamil or English — or add a photo and a location. Valam ties them together.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-5 flex justify-center">
          <Segmented<VoiceLang>
            id="voice-lang"
            options={[
              { value: "en", label: "English" },
              { value: "ta", label: "தமிழ்" },
            ]}
            value={lang}
            onChange={setLang}
          />
        </motion.div>
      </motion.div>

      <div className="mt-10 space-y-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="grid place-items-center"
        >
          <MicButton state={recState} onPress={micTap} />
          {!audioBlob && recState === "idle" && (imageFile || coords) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="-mt-2"
            >
              <Button variant="secondary" onClick={() => void submit()}>
                <IconSparkle className="h-4 w-4" />
                Analyze photo{coords ? " + location" : ""} instead
              </Button>
            </motion.div>
          )}
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-sage">
              Optional photo
            </p>
            <UploadDropzone file={imageFile} onFile={setImageFile} compact analyzing={false} />
            {imageFile && (
              <p className="mt-2 text-[12px] text-sage">
                A crop, leaf or weed picture — we&apos;ll check it too.
              </p>
            )}
          </div>

          <div className="card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-sage">
              <IconMapPin className="h-3.5 w-3.5" /> Location (for crops)
            </p>
            {coords ? (
              <div className="flex items-center justify-between rounded-xl border border-leaf-200 bg-leaf-50 px-3.5 py-2.5">
                <span className="tnum text-[13.5px] font-semibold text-leaf-800">
                  {fmtNumber(coords.latitude, 4)}°N, {fmtNumber(coords.longitude, 4)}°E
                </span>
                <button
                  type="button"
                  onClick={() => setCoords(null)}
                  aria-label="Remove location"
                  className="grid h-7 w-7 place-items-center rounded-full text-leaf-700 transition-colors hover:bg-leaf-100"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button variant="secondary" full loading={locating} onClick={addLocation}>
                <IconMapPin className="h-4 w-4" />
                {locating ? "Locating…" : "Add my location"}
              </Button>
            )}
            <p className="mt-2.5 text-[12px] leading-relaxed text-sage">
              Needed for crop suggestions. Falls back to nothing — GPS is never required to speak.
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {working && (
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
                <p className="font-display text-[15px] font-semibold text-pine-900">
                  Thinking it through
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
                    {PROGRESS[progressIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {error && !working && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="card flex flex-col items-center gap-3 p-6 text-center"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-clay-100 text-clay-600">
                <IconAlert className="h-6 w-6" />
              </span>
              <p className="font-display text-lg font-semibold text-pine-900">We lost that one</p>
              <p className="max-w-sm text-[13.5px] text-sage">{error}</p>
              <Button variant="secondary" onClick={() => void submit()}>
                Try again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {response && !working && (
          <motion.div
            key="response"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: SPRING }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-200 bg-leaf-50 px-3 py-1 text-[12px] font-semibold text-leaf-800">
                <IconSparkle className="h-3.5 w-3.5" />
                {INTENT_LABEL[response.intent ?? "unknown"] ?? "General"}
              </span>
              <button
                type="button"
                onClick={reset}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-medium text-sage transition-colors hover:bg-pine-50 hover:text-pine-800"
              >
                Start over
              </button>
            </div>

            {response.transcribed_text && (
              <TranscriptBlock label="What we heard" text={response.transcribed_text} active />
            )}
            <TranscriptBlock
              label={lang === "ta" ? "பதில் — your answer" : "Your answer"}
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
                  Field data
                </p>
                <div className="grid gap-3">
                  {response.crop_result && <CropCard result={response.crop_result} />}
                  {response.disease_result && (
                    <DetectCard result={response.disease_result} kind="disease" />
                  )}
                  {response.pest_result && <DetectCard result={response.pest_result} kind="pest" />}
                  <AnimatePresence>
                    {response.results.map((r, i) => (
                      <VoiceResultCard key={`${r.model}-${i}`} model={r.model} result={r} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}