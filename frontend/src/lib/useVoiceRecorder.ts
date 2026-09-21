import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isRecordingSupported, startRecording } from "./audio";
import type { Recorder } from "./audio";
import { useToast } from "./toast";

export type MicRecState = "idle" | "starting" | "listening" | "processing";

const MIN_RECORDING_BYTES = 1200;

/**
 * Shared voice-recorder toggle state machine used by HomePage and VoicePage.
 *
 * State flow: idle → starting → listening → (stop) → processing → idle.
 * - "starting" is set synchronously (before the async getUserMedia), so a
 *   second tap during the permission-prompt window can never re-enter start.
 * - Tapping while "starting" or "listening" runs the stop path; if the ref is
 *   missing/stale we still reset to "idle" so the UI can never get stuck.
 * - `onRecorded(blob)` is invoked once a usable recording is captured; it is
 *   kept in a ref so it always sees the latest closure (no stale state).
 */
export function useVoiceRecorder(onRecorded: (blob: Blob) => Promise<void> | void) {
  const toast = useToast();
  const { t } = useTranslation();
  const [recState, setRecState] = useState<MicRecState>("idle");
  const recorderRef = useRef<Recorder | null>(null);
  const cancelStartRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, []);

  const micTap = async () => {
    if (!isRecordingSupported()) {
      toast.error(t("voice.toastNoMicTitle"), t("voice.toastNoMicMsg"));
      return;
    }

    if (recState === "starting" || recState === "listening") {
      const recorder = recorderRef.current;
      if (!recorder) {
        cancelStartRef.current = true;
        setRecState("idle");
        return;
      }
      const blob = await recorder.stop();
      recorderRef.current = null;
      if (blob.size < MIN_RECORDING_BYTES) {
        toast.info(t("voice.toastShortTitle"), t("voice.toastShortMsg"));
        setRecState("idle");
        return;
      }
      await onRecordedRef.current(blob);
      return;
    }

    if (recState === "processing") return;

    setRecState("starting");
    cancelStartRef.current = false;
    try {
      recorderRef.current = await startRecording();
      if (cancelStartRef.current) {
        recorderRef.current.cancel();
        recorderRef.current = null;
        setRecState("idle");
        return;
      }
      setRecState("listening");
    } catch {
      recorderRef.current = null;
      setRecState("idle");
      toast.error(t("voice.toastMicDeniedTitle"), t("voice.toastMicDeniedMsg"));
    }
  };

  const resetRecorder = () => {
    cancelStartRef.current = true;
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecState("idle");
  };

  return { recState, setRecState, micTap, resetRecorder };
}

export type { Recorder } from "./audio";