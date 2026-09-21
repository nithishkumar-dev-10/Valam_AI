import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { IconAlert, IconEye, IconEyeOff } from "./Icons";
import { cn } from "../lib/utils";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, type, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [show, setShow] = useState(false);
  const { t } = useTranslation();
  const isPassword = type === "password";
  const resolvedType = isPassword ? (show ? "text" : "password") : type ?? "text";

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-[13px] font-medium text-sage">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          {...rest}
          className={cn(
            "h-11 w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink outline-none transition-all duration-200 placeholder:text-sage/50",
            isPassword && "pr-11",
            error
              ? "border-clay-300 focus:border-clay-400 shadow-[0_0_0_3px_rgba(201,111,74,0.12)]"
              : "border-mist focus:border-pine-500 shadow-[0_0_0_3px_rgba(30,91,60,0.09)]",
            className,
          )}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t("field.hidePassword") : t("field.showPassword")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-sage transition-colors hover:text-pine-700"
          >
            {show ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
          </button>
        )}
      </div>
      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-1.5 text-[12.5px] text-clay-600"
          >
            <IconAlert className="h-3.5 w-3.5 shrink-0" />
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="text-[12.5px] text-sage"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
});