/** Live meter + speech detector state published while recording. */
export interface VoiceMetrics {
  /** Normalised 0–1 input level for the meter. */
  level: number;
  /** True once at least MIN_SPEECH_MS of audio was above the threshold. */
  speechDetected: boolean;
  speechMs: number;
  remainingMs: number;
}

export type AutoStopReason = "silence" | "max" | "no-speech";

export interface RecordingResult {
  blob: Blob;
  hadSpeech: boolean;
  speechMs: number;
  durationMs: number;
  mimeType: string;
  /** Client-side Web Speech transcript (informational; backend still transcribes). */
  transcript: string;
  reason: "manual" | AutoStopReason;
}

export interface Recorder {
  stop: () => Promise<RecordingResult>;
  cancel: () => void;
}

export interface RecordingOptions {
  /** AudioContext created + resumed inside the click handler (user gesture). */
  audioContext?: AudioContext | null;
  /** BCP-47 tag for the optional Web Speech transcript (never a stop trigger). */
  speechLang?: string;
  maxDurationMs?: number;
  silenceMs?: number;
  noSpeechTimeoutMs?: number;
  onAutoStop?: (reason: AutoStopReason) => void;
  onMetrics?: (metrics: VoiceMetrics) => void;
  onError?: (error: unknown) => void;
}

const STOP_TIMEOUT_MS = 3000;
const DEFAULT_SILENCE_MS = 1500;
const DEFAULT_MAX_DURATION_MS = 10000;
const DEFAULT_NO_SPEECH_TIMEOUT_MS = 6000;
const CALIBRATION_MS = 300;
const MIN_SPEECH_MS = 400;
const MIN_SPEECH_RMS = 0.02;
const HYSTERESIS = 0.6;
const METER_SCALE = 6;
const LEVEL_POLL_MS = 100;

// Only one MediaRecorder may be live at a time. A second startRecording()
// cancels the previous one instead of leaking two microphone streams.
let activeRecorder: { cancel: () => void } | null = null;

function logWarn(message: string): void {
  console.warn(`[audio] ${message}`);
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

export function isSecureContextForMic(): boolean {
  return typeof window === "undefined" || window.isSecureContext;
}

/**
 * Must be called synchronously from the mic click handler so the browser
 * treats resume() as user-initiated. The returned context is handed to
 * startRecording(), which verifies that it actually reached "running".
 */
export function createRecordingAudioContext(): AudioContext | null {
  const w = window as unknown as { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  const context = new Ctor();
  void context.resume().catch(() => undefined);
  return context;
}

function pickMimeType(): string {
  // Safari/iOS records AAC in MP4; Chrome/Firefox prefer Opus in WebM.
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Optional Web Speech transcript source. It never stops the recorder. */
interface SpeechResultLike {
  isFinal: boolean;
  0?: { transcript?: string };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechResultLike> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  abort: () => void;
}

function makeTranscriptSource(
  lang: string,
  onFinalText: (text: string) => void,
): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false; // final results only
  recognition.onresult = (event) => {
    // Transcript source ONLY — never call stop()/abort() from here. The
    // MediaRecorder + silence detector own the recording lifetime.
    for (let i = event.results.length - 1; i >= 0; i -= 1) {
      const result = event.results[i];
      if (result?.isFinal) {
        const text = result[0]?.transcript?.trim();
        if (text) onFinalText(text);
        return;
      }
    }
  };
  // These handlers exist so no stale recognition state can leak; they never
  // influence the MediaRecorder lifecycle.
  recognition.onend = () => undefined;
  recognition.onerror = () => undefined;
  recognition.onspeechend = () => undefined;
  return recognition;
}

export async function startRecording(options: RecordingOptions = {}): Promise<Recorder> {
  const silenceMs = options.silenceMs ?? DEFAULT_SILENCE_MS;
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const noSpeechTimeoutMs = options.noSpeechTimeoutMs ?? DEFAULT_NO_SPEECH_TIMEOUT_MS;

  if (activeRecorder) {
    logWarn("startRecording called while a recorder is already active — cancelling it first");
    activeRecorder.cancel();
    activeRecorder = null;
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err) {
    // Some older devices reject these ideal constraints outright; retry with
    // plain audio so the mic still works. Permission/other errors are not retried.
    if (err instanceof DOMException && err.name === "OverconstrainedError") {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } else {
      throw err;
    }
  }
  const stopTracks = () => stream.getTracks().forEach((track) => track.stop());
  const mimeType = pickMimeType();

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (err) {
    stopTracks();
    throw err;
  }

  const startedAt = Date.now();
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  let settled = false;
  let cancelled = false;
  let stopReason: RecordingResult["reason"] = "manual";
  let stopPromise: Promise<RecordingResult> | null = null;
  let resolveStop: ((result: RecordingResult) => void) | null = null;
  let rejectStop: ((error: unknown) => void) | null = null;
  let stopTimer: number | null = null;
  let maxTimer: number | null = null;
  let noSpeechTimer: number | null = null;
  let levelTimer: number | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let recognition: SpeechRecognitionLike | null = null;
  const transcriptParts: string[] = [];

  // Speech detector state.
  let contextUsable = false;
  let threshold = MIN_SPEECH_RMS;
  let releaseThreshold = MIN_SPEECH_RMS * HYSTERESIS;
  let calibrationSamples: number[] = [];
  let speechMs = 0;
  let speechStarted = false;
  let belowSince: number | null = null;
  let lastLevel = 0;
  let lastMetricsAt = 0;

  const metrics = (): VoiceMetrics => ({
    level: Math.min(1, lastLevel * METER_SCALE),
    speechDetected: speechMs >= MIN_SPEECH_MS,
    speechMs,
    remainingMs: Math.max(0, maxDurationMs - (Date.now() - startedAt)),
  });

  const cleanup = () => {
    if (stopTimer !== null) window.clearTimeout(stopTimer);
    if (maxTimer !== null) window.clearTimeout(maxTimer);
    if (noSpeechTimer !== null) window.clearTimeout(noSpeechTimer);
    if (levelTimer !== null) window.clearInterval(levelTimer);
    stopTimer = null;
    maxTimer = null;
    noSpeechTimer = null;
    levelTimer = null;
    try {
      source?.disconnect();
      analyser?.disconnect();
    } catch {
      // Nodes may already be detached.
    }
    source = null;
    analyser = null;
    const context = options.audioContext;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
    try {
      const signal = recognition;
      if (signal) {
        signal.onresult = null;
        signal.onend = null;
        signal.onerror = null;
        signal.onspeechend = null;
        signal.abort();
      }
    } catch {
      // Recognition may never have started.
    }
    recognition = null;
    stopTracks();
    if (activeRecorder === rec) activeRecorder = null;
  };

  const blob = () => new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });

  const result = (): RecordingResult => ({
    blob: blob(),
    hadSpeech: speechMs >= MIN_SPEECH_MS,
    speechMs,
    durationMs: Date.now() - startedAt,
    mimeType: recorder.mimeType || mimeType || "audio/webm",
    transcript: transcriptParts.join(" ").trim(),
    reason: stopReason,
  });

  const finish = (finalResult: RecordingResult) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolveStop?.(finalResult);
  };

  const fail = (error: unknown) => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectStop?.(error);
    options.onError?.(error);
  };

  const rec: Recorder = {
    // Idempotent: manual tap, silence, max, no-speech and fallback can race
    // without double-stopping or double-delivering a blob.
    stop: () => {
      if (stopPromise) return stopPromise;
      stopPromise = new Promise<RecordingResult>((resolve, reject) => {
        resolveStop = resolve;
        rejectStop = reject;
        stopTimer = window.setTimeout(() => {
          logWarn(`recorder stop event did not fire within ${STOP_TIMEOUT_MS}ms — force-stopping`);
          finish(result());
        }, STOP_TIMEOUT_MS);
      });
      try {
        if (recorder.state !== "inactive") recorder.stop();
        else finish(result());
      } catch (err) {
        fail(err);
      }
      return stopPromise;
    },
    cancel: () => {
      cancelled = true;
      stopReason = "manual";
      if (stopPromise) finish({ ...result(), blob: new Blob([]), hadSpeech: false });
      else {
        settled = true;
        cleanup();
      }
    },
  };

  recorder.addEventListener("stop", () => finish(cancelled ? { ...result(), blob: new Blob([]), hadSpeech: false } : result()), { once: true });
  recorder.addEventListener(
    "error",
    (event) => fail((event as ErrorEvent).error ?? new Error("MediaRecorder error")),
    { once: true },
  );

  try {
    recorder.start();
  } catch (err) {
    cleanup();
    throw err;
  }
  activeRecorder = rec;

  // Verify AudioContext after resume(). A suspended context means no reliable
  // level readings, so silence detection stays off and the max timer is the
  // only automatic stop (plus the hook's own fallback).
  const context = options.audioContext ?? null;
  if (context) {
    try {
      await context.resume();
      contextUsable = context.state === "running";
    } catch {
      contextUsable = false;
    }
    if (!contextUsable) {
      logWarn("AudioContext is suspended — silence detection disabled, using the max-duration timer");
    }
  }

  let autoStopNotified = false;
  const autoStop = (reason: AutoStopReason) => {
    if (settled || autoStopNotified) return;
    autoStopNotified = true;
    stopReason = reason;
    rec.stop();
    options.onAutoStop?.(reason);
  };

  maxTimer = window.setTimeout(() => autoStop("max"), maxDurationMs);
  if (contextUsable) {
    noSpeechTimer = window.setTimeout(() => {
      if (!speechStarted) autoStop("no-speech");
    }, noSpeechTimeoutMs);
  } else {
    // No AudioContext means no level readings: keep the countdown alive and
    // let the max timer stop us. Never claim "no speech" without evidence.
    levelTimer = window.setInterval(() => {
      if (!settled) options.onMetrics?.(metrics());
    }, LEVEL_POLL_MS);
  }

  if (contextUsable && context && analyser === null) {
    try {
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const samples = new Uint8Array(analyser.fftSize);
      levelTimer = window.setInterval(() => {
        if (settled || recorder.state !== "recording") return;
        if (context.state !== "running" || !analyser) return;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const value = (samples[i] - 128) / 128;
          sum += value * value;
        }
        const now = Date.now();
        const level = Math.sqrt(sum / samples.length);
        lastLevel = level;

        // Calibrate the noise floor for the first ~300ms, then use a 2.5x
        // threshold with a sane minimum and hysteresis on the release side.
        if (now - startedAt < CALIBRATION_MS) {
          calibrationSamples.push(level);
          const floor = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
          threshold = Math.max(floor * 2.5, MIN_SPEECH_RMS);
          releaseThreshold = threshold * HYSTERESIS;
        } else if (level > threshold) {
          speechMs += LEVEL_POLL_MS;
          speechStarted = true;
          belowSince = null;
        } else if (level > releaseThreshold) {
          // Inside the hysteresis band: keep the current speech state.
          belowSince = null;
        } else if (speechMs >= MIN_SPEECH_MS) {
          if (belowSince === null) belowSince = now;
          else if (now - belowSince >= silenceMs) autoStop("silence");
        }

        if (now - lastMetricsAt >= LEVEL_POLL_MS) {
          lastMetricsAt = now;
          options.onMetrics?.(metrics());
        }
      }, LEVEL_POLL_MS);
    } catch (err) {
      logWarn(`silence detection unavailable, using timers only: ${String(err)}`);
      source = null;
      analyser = null;
    }
  }

  if (options.speechLang) {
    try {
      const signal = makeTranscriptSource(options.speechLang, (text) => transcriptParts.push(text));
      recognition = signal;
      signal?.start();
    } catch {
      recognition = null;
    }
  }

  return rec;
}
