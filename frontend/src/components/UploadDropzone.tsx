import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { IconCamera, IconRefresh, IconX } from "./Icons";
import { cn } from "../lib/utils";
import { SPRING } from "../lib/motion";

const MAX_SIZE = 15 * 1024 * 1024; // backend caps uploads at 15 MB

interface UploadDropzoneProps {
  file: File | null;
  analyzing?: boolean;
  apiError?: string | null;
  onFile: (file: File | null) => void;
  compact?: boolean;
}

export function UploadDropzone({
  file,
  analyzing,
  apiError,
  onFile,
  compact,
}: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
    return undefined;
  }, [file]);

  const acceptFile = (candidate: File | undefined | null) => {
    if (!candidate) return;
    if (!candidate.type.startsWith("image/")) {
      setLocalError(t("dropzone.notImage"));
      return;
    }
    if (candidate.size > MAX_SIZE) {
      setLocalError(t("dropzone.tooLarge"));
      return;
    }
    setLocalError(null);
    onFile(candidate);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const shownError = localError ?? apiError;

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35, ease: SPRING }}
            className="relative overflow-hidden rounded-3xl border border-mist bg-pine-950/5"
          >
            <img
              src={preview}
              alt={t("dropzone.previewAlt")}
              className={cn(
                "w-full object-cover transition-all duration-500",
                compact ? "h-44" : "h-64 sm:h-80",
                analyzing && "opacity-80 blur-[1px]",
              )}
            />
            {analyzing && <span className="scan-line" />}
            {!analyzing && (
              <button
                type="button"
                onClick={() => {
                  onFile(null);
                  setPreview(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-pine-950/60 text-paper backdrop-blur transition-colors hover:bg-pine-950/80"
                aria-label={t("dropzone.removeAria")}
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
            {!analyzing && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-2 text-xs font-semibold text-pine-800 shadow-card backdrop-blur transition-colors hover:bg-surface"
              >
                <IconRefresh className="h-3.5 w-3.5" /> {t("dropzone.retake")}
              </button>
            )}
          </motion.div>
        ) : (
          <motion.button
            key="empty"
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: SPRING }}
            className={cn(
              "group grid w-full place-items-center rounded-3xl border-2 border-dashed transition-all duration-300",
              compact ? "h-36" : "h-56",
              dragOver
                ? "border-leaf-500 bg-leaf-50 scale-[1.01]"
                : "border-mist bg-surface hover:border-leaf-300 hover:bg-leaf-500/5",
            )}
          >
            <span className="flex flex-col items-center gap-3 px-6 text-center">
              <motion.span
                animate={dragOver ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 20 }}
                className="grid h-14 w-14 place-items-center rounded-2xl bg-pine-100 text-pine-700 transition-colors duration-300 group-hover:bg-gradient-to-br group-hover:from-pine-600 group-hover:to-leaf-500 group-hover:text-paper"
              >
                <IconCamera className="h-7 w-7" />
              </motion.span>
              <span>
                <span className="block text-sm font-semibold text-pine-900">
                  {t("dropzone.tapAdd")}
                </span>
                <span className="mt-1 block text-[12.5px] text-sage">
                  {t("dropzone.dragHint")}
                </span>
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {shownError && (
        <motion.p
          key={shownError}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-[13px] text-clay-600"
        >
          {shownError}
        </motion.p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />
    </div>
  );
}