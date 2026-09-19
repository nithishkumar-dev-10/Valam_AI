import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconAlert, IconCheck, IconSparkle } from "../components/Icons";
import { SPRING } from "../lib/motion";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: { icon: IconCheck, className: "bg-leaf-500", tone: "text-leaf-700" },
  error: { icon: IconAlert, className: "bg-clay-500", tone: "text-clay-600" },
  info: { icon: IconSparkle, className: "bg-honey-500", tone: "text-honey-600" },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const push = useCallback((kind: ToastKind, title: string, description?: string) => {
    const id = ++nextId.current;
    setToasts((ts) => [...ts, { id, kind, title, description }]);
    window.setTimeout(() => {
      setToasts((ts) => ts.filter((t) => t.id !== id));
    }, kind === "error" ? 4600 : 3400);
  }, []);

  const success = useCallback(
    (title: string, description?: string) => push("success", title, description),
    [push],
  );
  const error = useCallback(
    (title: string, description?: string) => push("error", title, description),
    [push],
  );
  const info = useCallback(
    (title: string, description?: string) => push("info", title, description),
    [push],
  );

  const value: ToastContextValue = { push, success, error, info };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const { icon: Icon, className, tone } = ICONS[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                transition={{ duration: 0.3, ease: SPRING }}
                className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border border-mist bg-surface/95 py-3 pl-3 pr-4 shadow-lift backdrop-blur"
              >
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-paper ${className}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${tone}`}>{t.title}</span>
                  {t.description && (
                    <span className="mt-0.5 block text-[13px] leading-snug text-sage">
                      {t.description}
                    </span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}