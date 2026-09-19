export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
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
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const stopPromise = new Promise<Blob>((resolve) => {
    recorder.addEventListener("stop", () => {
      const type = recorder.mimeType || "audio/webm";
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type }));
    });
  });

  recorder.start();

  return {
    stop: async () => {
      if (recorder.state !== "inactive") recorder.stop();
      return stopPromise;
    },
    cancel: () => {
      stream.getTracks().forEach((track) => track.stop());
      if (recorder.state !== "inactive") recorder.stop();
    },
  };
}