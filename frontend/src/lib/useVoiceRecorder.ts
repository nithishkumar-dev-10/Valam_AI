import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createRecordingAudioContext,
  isRecordingSupported,
  isSecureContextForMic,
  startRecording,
} from "./audio";
import type { AutoStopReason, Recorder, RecordingResult, VoiceMetrics } from "./audio";
import { getSpeechLang } from "./i18n";
import { useToast } from "./toast";

export type MicRecState = "idle" | "starting" | "listening" | "processing" | "error";
/** The page-level phases the recorder is allowed to publish. */
export type MicPhase = "idle" | "listening" | "error";

export interface VoiceRecorderOptions {
  /** Receives the captured audio. Throw/return null to cancel delivery. */
  onAudio: (result: RecordingResult) => void | Promise<void>;
  onPhaseChange?: (phase: MicPhase) => void;
  onError?: (message: string, blob: Blob | null) => void;
  /** When true, taps are ignored (e.g. a photo upload is in flight). */
  disabled?: boolean;
}

export interface VoiceRecorderApi {
  recState: MicRecState;
  setRecState: (next: MicRecState) => void;
  micTap: () => void;
  /** Stops/releases the mic without delivering audio. */
  cancelRecording: () => void;
  resetRecorder: () => void;
  metrics: VoiceMetrics;
  /** Network/API failures call this to return to idle with a captured blob. */
  reportDeliveryError: (message: string, blob?: Blob | null) => void;
}

const FALLBACK_STOP_MS = 9000;
const TAP_DEBOUNCE_MS = 300;
const RETRY_DEBOUNCE_MS = 600;

type MicErrorCode =
  | "NotAllowedError"
  | "NotFoundError"
  | "NotReadableError"
  | "OverconstrainedError"
  | "unsupported"
  | "network"
  | "timeout"
  | "no-speech"
  | "unknown";

interface MicErrorInfo {
  code: MicErrorCode;
  message: string;
  titleKey: string;
  bodyKey: string;
  retryable: boolean;
}

function errorInfo(error: unknown): MicErrorInfo {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");

  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return {
      code: "NotAllowedError",
      message,
      titleKey: "voice.toastPermTitle",
      bodyKey: "voice.toastPermBody",
      retryable: true,
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      code: "NotFoundError",
      message,
      titleKey: "voice.toastNoMicTitle",
      bodyKey: "voice.toastNoMicBody",
      retryable: true,
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      code: "NotReadableError",
      message,
      titleKey: "voice.toastBusyTitle",
      bodyKey: "voice.toastBusyBody",
      retryable: true,
    };
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      code: "OverconstrainedError",
      message,
      titleKey: "voice.toastConstraintTitle",
      bodyKey: "voice.toastConstraintBody",
      retryable: true,
    };
  }
  if (/network|failed to fetch|load failed/i.test(message)) {
    return {
      code: "network",
      message,
      titleKey: "voice.toastNetTitle",
      bodyKey: "voice.toastNetBody",
      retryable: true,
    };
  }
  if (/timeout|timed out/i.test(message)) {
    return {
      code: "timeout",
      message,
      titleKey: "voice.toastTimeoutTitle",
      bodyKey: "voice.toastTimeoutBody",
      retryable: true,
    };
  }
  return {
    code: "unknown",
    message,
    titleKey: "voice.toastRecordErrTitle",
    bodyKey: "voice.toastRecordErrMsg",
    retryable: true,
  };
}

function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Haptics are best-effort.
  }
}

const EMPTY_METRICS: VoiceMetrics = {
  level: 0,
  speechDetected: false,
  speechMs: 0,
  remainingMs: 10000,
};

/**
 * Shared voice-recorder toggle state machine used by HomePage and VoicePage.
 *
 * All lifecycle paths (manual stop, auto-stop, fallback, error, unmount) go
 * through one idempotent finish(). State is read from refs, never from a stale
 * useState closure, so rapid taps can't double-start or double-stop.
 */
export function useVoiceRecorder(options: VoiceRecorderOptions): VoiceRecorderApi {
  const { t } = useTranslation();
  const toast = useToast();

  const [recState, setRecStateState] = useState<MicRecState>("idle");
  const [metrics, setMetrics] = useState<VoiceMetrics>(EMPTY_METRICS);

  const recStateRef = useRef<MicRecState>("idle");
  const recorderRef = useRef<Recorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef(0);
  const mountedRef = useRef(true);
  const sessionRef = useRef(0);
  const finishedRef = useRef(false);
  const capturedBlobRef = useRef<Blob | null>(null);
  const optionsRef = useRef(options);
  const disabledRef = useRef(Boolean(options.disabled));

  optionsRef.current = options;
  disabledRef.current = Boolean(options.disabled);

  const setRecState = useCallback((next: MicRecState) => {
    recStateRef.current = next;
    if (mountedRef.current) setRecStateState(next);
  }, []);

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  /**
   * The single, idempotent lifecycle exit. Every path ends in idle/error, and
   * always releases the mic + AudioContext + timers before publishing state.
   */
  const finish = useCallback(
    (params: {
      session: number;
      result?: RecordingResult | null;
      error?: unknown;
      phase?: MicPhase;
      noSpeech?: boolean;
      notifyIdle?: boolean;
    }) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearFallback();

      const recorder = recorderRef.current;
      recorderRef.current = null;
      try {
        recorder?.cancel();
      } catch {
        // cleanup() inside cancel() is defensive; never let it break state.
      }
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => undefined);

      if (params.session !== sessionRef.current || !mountedRef.current) return;

      if (params.noSpeech || (params.result && !params.result.hadSpeech)) {
        setRecState("idle");
        optionsRef.current.onPhaseChange?.("idle");
        toast.info(t("voice.noSpeechTitle"), t("voice.noSpeechBody"));
        return;
      }

      if (params.error !== undefined) {
        const info = errorInfo(params.error);
        setRecState("error");
        optionsRef.current.onPhaseChange?.("error");
        optionsRef.current.onError?.(t(info.bodyKey), capturedBlobRef.current);
        toast.error(t(info.titleKey), t(info.bodyKey));
        return;
      }

      if (params.result) {
        capturedBlobRef.current = params.result.blob;
        setRecState("processing");
        Promise.resolve(optionsRef.current.onAudio(params.result)).catch((err) => {
          if (params.session !== sessionRef.current || !mountedRef.current) return;
          const info = errorInfo(err);
          setRecState("error");
          optionsRef.current.onPhaseChange?.("error");
          optionsRef.current.onError?.(t(info.bodyKey), capturedBlobRef.current);
          toast.error(t(info.titleKey), t(info.bodyKey));
        });
        return;
      }

      setRecState("idle");
      if (params.notifyIdle !== false) optionsRef.current.onPhaseChange?.("idle");
    },
    [clearFallback, setRecState, t, toast],
  );

  const publishError = useCallback(
    (err: unknown, retryDelay = 0) => {
      const session = sessionRef.current;
      const delay = retryDelay || (err instanceof Error && err.name === "NotAllowedError" ? RETRY_DEBOUNCE_MS : 0);
      lastTapRef.current = Date.now() + delay;
      finish({ session, error: err });
    },
    [finish],
  );

  const stopAndDeliver = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || finishedRef.current) return;
    const session = sessionRef.current;
    void recorder.stop().then(
      (result) => finish({ session, result }),
      (err) => finish({ session, error: err }),
    );
  }, [finish]);

  const beginRecording = useCallback(async () => {
    const session = sessionRef.current;
    setRecState("starting");

    if (!isSecureContextForMic()) {
      publishError(new Error("Microphone requires HTTPS or localhost"));
      return;
    }
    if (!isRecordingSupported()) {
      publishError(new Error("Recording is not supported in this browser"));
      return;
    }

    // Must happen synchronously in the click handler for autoplay policies.
    const audioContext = createRecordingAudioContext();
    audioContextRef.current = audioContext;

    try {
      const recorder = await startRecording({
        audioContext,
        speechLang: getSpeechLang(), // snapshot; language changes apply next session
        maxDurationMs: 10000,
        silenceMs: 1500,
        noSpeechTimeoutMs: 6000,
        onMetrics: (next) => {
          if (session === sessionRef.current && mountedRef.current) setMetrics(next);
        },
        onAutoStop: (reason: AutoStopReason) => {
          if (session !== sessionRef.current || finishedRef.current) return;
          if (reason === "no-speech") finish({ session, noSpeech: true });
          else stopAndDeliver();
        },
        onError: () => undefined,
      });

      if (session !== sessionRef.current || !mountedRef.current) {
        recorder.cancel();
        // A stop tap / cancel arrived while getUserMedia was pending: make
        // sure the state machine actually leaves "starting".
        if (mountedRef.current && recStateRef.current !== "idle") {
          finish({ session: sessionRef.current, notifyIdle: true });
        }
        return;
      }
      recorderRef.current = recorder;
      setRecState("listening");
      optionsRef.current.onPhaseChange?.("listening");
      vibrate(30);

      clearFallback();
      fallbackTimerRef.current = window.setTimeout(() => {
        if (session !== sessionRef.current || finishedRef.current) return;
        console.warn("[voice] fallback stop timer fired at 9s");
        stopAndDeliver();
      }, FALLBACK_STOP_MS);
    } catch (err) {
      publishError(err);
    }
  }, [clearFallback, finish, publishError, setRecState, stopAndDeliver]);

  /** The strict toggle. Debounced with a ref; state always read from a ref. */
  const micTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_DEBOUNCE_MS) return;
    lastTapRef.current = now;

    if (disabledRef.current) return;
    const state = recStateRef.current;

    if (state === "listening" || state === "starting") {
      // Stop: increment the session so a still-in-flight start() is discarded.
      sessionRef.current += 1;
      vibrate(30);
      if (recorderRef.current) stopAndDeliver();
      else finish({ session: sessionRef.current, notifyIdle: true });
      return;
    }
    if (state === "processing") return;
    if (state === "error") {
      setRecState("idle");
      capturedBlobRef.current = null;
    }
    // idle/done/error -> fresh session.
    sessionRef.current += 1;
    finishedRef.current = false;
    capturedBlobRef.current = null;
    setMetrics(EMPTY_METRICS);
    void beginRecording();
  }, [beginRecording, setRecState, stopAndDeliver]);

  const cancelRecording = useCallback(() => {
    if (recStateRef.current === "idle" || recStateRef.current === "processing") return;
    sessionRef.current += 1;
    finish({ session: sessionRef.current, notifyIdle: true });
  }, [finish]);

  const resetRecorder = useCallback(() => {
    sessionRef.current += 1;
    finish({ session: sessionRef.current, notifyIdle: false });
    setRecState("idle");
    capturedBlobRef.current = null;
    setMetrics(EMPTY_METRICS);
  }, [finish, setRecState]);

  /**
   * API/network failures happen after finish() already closed the recording,
   * so this path deliberately bypasses the recorder idempotency guard.
   */
  const reportDeliveryError = useCallback(
    (message: string, blob: Blob | null = null) => {
      if (!mountedRef.current) return;
      if (blob) capturedBlobRef.current = blob;
      const info = errorInfo(new Error(message));
      setRecState("error");
      optionsRef.current.onPhaseChange?.("error");
      optionsRef.current.onError?.(message, capturedBlobRef.current);
      toast.error(t(info.titleKey), message);
    },
    [setRecState, t, toast],
  );

  // Escape and visibility changes always release the mic immediately.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && recStateRef.current !== "idle" && recStateRef.current !== "processing") {
        cancelRecording();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") cancelRecording();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [cancelRecording]);

  // Unmount / language toggle: cancel any live session without restarting.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      sessionRef.current += 1;
      finishedRef.current = true;
      clearFallback();
      try {
        recorderRef.current?.cancel();
      } catch {
        // Ignore.
      }
      recorderRef.current = null;
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => undefined);
    };
  }, [clearFallback]);

  return {
    recState,
    setRecState,
    micTap,
    cancelRecording,
    resetRecorder,
    metrics,
    reportDeliveryError,
  };
}
