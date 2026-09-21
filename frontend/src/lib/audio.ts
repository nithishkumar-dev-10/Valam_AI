export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

const STOP_TIMEOUT_MS = 3000;

// FIX 4 — module-level guard: only one MediaRecorder may be live at a time.
// A second startRecording() cancels the previous one instead of silently
// letting two concurrent recorders (and their microphone streams) run.
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

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

export async function startRecording(): Promise<Recorder> {
  if (activeRecorder) {
    logWarn("startRecording called while a recorder is already active — cancelling it first");
    activeRecorder.cancel();
    activeRecorder = null;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stopTracks = () => stream.getTracks().forEach((track) => track.stop());

  let resolveStop: ((blob: Blob) => void) | null = null;
  let rejectStop: ((err: unknown) => void) | null = null;
  const stopPromise = new Promise<Blob>((resolve, reject) => {
    resolveStop = resolve;
    rejectStop = reject;
  });

  const rec: Recorder = {
    // FIX 3 — race the native "stop" event against a timeout so a missing
    // onstop can never hang the caller. On timeout we force-stop the stream
    // tracks, return whatever was captured, and log a warning.
    stop: async () => {
      if (recorder.state !== "inactive") recorder.stop();
      return new Promise<Blob>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          logWarn(
            `recorder stop event did not fire within ${STOP_TIMEOUT_MS}ms — force-stopping stream tracks`,
          );
          stopTracks();
          if (activeRecorder === rec) activeRecorder = null;
          resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        }, STOP_TIMEOUT_MS);
        stopPromise.then(
          (blob) => {
            window.clearTimeout(timer);
            resolve(blob);
          },
          (err) => {
            window.clearTimeout(timer);
            reject(err);
          },
        );
      });
    },
    cancel: () => {
      stopTracks();
      if (recorder.state !== "inactive") recorder.stop();
      if (activeRecorder === rec) activeRecorder = null;
    },
  };

  recorder.addEventListener(
    "stop",
    () => {
      stopTracks();
      if (activeRecorder === rec) activeRecorder = null;
      resolveStop?.(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    },
    { once: true },
  );

  // FIX 3 — surface recorder errors immediately instead of hanging.
  recorder.addEventListener(
    "error",
    (event) => {
      const err = (event as ErrorEvent).error ?? new Error("MediaRecorder error");
      logWarn(`MediaRecorder error: ${String(err)}`);
      stopTracks();
      if (activeRecorder === rec) activeRecorder = null;
      rejectStop?.(err);
    },
    { once: true },
  );

  recorder.start();
  activeRecorder = rec;

  return rec;
}