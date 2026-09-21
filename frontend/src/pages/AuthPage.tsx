import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Checkmark } from "../components/Checkmark";
import { Burst } from "../components/Burst";
import { Segmented } from "../components/Segmented";
import { IconArrowRight, IconLeaf, IconSun } from "../components/Icons";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import { apiErrorMessage, cn } from "../lib/utils";
import { tValue } from "../lib/i18n";
import { SPRING } from "../lib/motion";

const PHONE_RE = /^\+?\d{10,15}$/;
type Mode = "signin" | "signup";
type Phase = "form" | "submitting" | "done";

function strength(password: string): number {
  let s = 0;
  if (password.length >= 6) s += 1;
  if (password.length >= 10) s += 1;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) s += 1;
  if (/[^A-Za-z0-9]/.test(password)) s += 1;
  return s;
}

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>("signin");
  const [phase, setPhase] = useState<Phase>("form");
  const [burst, setBurst] = useState(0);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const submit = async () => {
    const e: Record<string, string> = {};
    const p = phone.trim();
    if (!PHONE_RE.test(p)) e.phone = t("auth.errPhone");
    if (password.length < 6) e.password = t("auth.errPasswordShort");
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      e.password = t("auth.errPasswordMix");
    if (mode === "signup") {
      if (name.trim().length < 2) e.name = t("auth.errName");
      if (password !== confirm) e.confirm = t("auth.errConfirm");
    }
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setPhase("submitting");
    setBurst((b) => b + 1);
    try {
      if (mode === "signin") await signIn(p, password);
      else await signUp(name.trim(), p, password);
      setPhase("done");
      toast.success(mode === "signin" ? t("auth.toastSignin") : t("auth.toastSignup"));
      window.setTimeout(() => navigate(from, { replace: true }), 1050);
    } catch (err) {
      setPhase("form");
      const msg = apiErrorMessage(err);
      if (/creden|password|incorrect/i.test(msg)) {
        setErrors((prev) => ({ ...prev, password: msg.split(" · ")[0] }));
      } else if (/exist/i.test(msg)) {
        setErrors((prev) => ({ ...prev, phone: msg }));
      } else {
        toast.error(t("auth.errGeneric"), tValue(msg));
      }
    }
  };

  return (
    <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
      <BrandPanel />

      <div className="relative mx-auto w-full max-w-md pb-6">
        <AnimatePresence mode="wait">
          {phase === "done" ? (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid place-items-center py-16 text-center"
            >
              <div className="relative">
                <Burst burst={burst} />
                <Checkmark size={96} />
              </div>
              <p className="font-display mt-6 text-2xl font-semibold text-pine-900">
                {t("auth.done")}
              </p>
              <p className="mt-1 text-sm text-sage">{t("auth.doneSub")}</p>
            </motion.div>
          ) : (
            <motion.form
              key={mode}
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              noValidate
              initial={{ opacity: 0, x: mode === "signup" ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === "signup" ? -20 : 20 }}
              transition={{ duration: 0.32, ease: SPRING }}
              className="card p-6 sm:p-8"
            >
              <Segmented<Mode>
                id="auth"
                options={[
                  { value: "signin", label: t("auth.segSignin") },
                  { value: "signup", label: t("auth.segSignup") },
                ]}
                value={mode}
                onChange={setMode}
                className="w-full"
              />

              <h1 className="font-display mt-6 text-[26px] font-semibold text-pine-900">
                {mode === "signin" ? t("auth.titleSignin") : t("auth.titleSignup")}
              </h1>
              <p className="mt-1 text-[13.5px] text-sage">
                {mode === "signin" ? t("auth.subSignin") : t("auth.subSignup")}
              </p>

              <div className="mt-6 space-y-4">
                {mode === "signup" && (
                  <Field
                    label={t("auth.yourName")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("auth.namePlaceholder")}
                    autoComplete="name"
                    error={errors.name ?? null}
                  />
                )}
                <Field
                  label={t("auth.phone")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("auth.phonePlaceholder")}
                  inputMode="tel"
                  autoComplete="tel"
                  error={errors.phone ?? null}
                />
                <Field
                  label={t("auth.password")}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  error={errors.password ?? null}
                  hint={mode === "signup" ? t("auth.passwordHint") : undefined}
                />
                {mode === "signup" && (
                  <>
                    <PasswordStrength password={password} />
                    <Field
                      label={t("auth.confirm")}
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      error={errors.confirm ?? null}
                    />
                  </>
                )}
              </div>

              <Button
                type="submit"
                full
                loading={phase === "submitting"}
                className="mt-6"
              >
                {mode === "signin" ? t("auth.submitSignin") : t("auth.submitSignup")}
                {phase !== "submitting" && <IconArrowRight className="h-4 w-4" />}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setErrors({});
                  setMode(mode === "signin" ? "signup" : "signin");
                }}
                className="mx-auto mt-5 block text-[13px] font-medium text-pine-700 underline-offset-4 transition-colors hover:text-pine-900 hover:underline"
              >
                {mode === "signin"
                  ? t("auth.switchToSignup")
                  : t("auth.switchToSignin")}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  const score = strength(password);
  const colors = ["bg-mist", "bg-clay-400", "bg-honey-400", "bg-leaf-400", "bg-leaf-500"];
  const labels = ["", t("auth.strength.weak"), t("auth.strength.okay"), t("auth.strength.good"), t("auth.strength.strong")];
  return (
    <div className="pb-1">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className={cn("h-1.5 flex-1 rounded-full", colors[score])}
            animate={{ opacity: i < score ? 1 : 0.25 }}
            transition={{ duration: 0.2 }}
          />
        ))}
      </div>
      {password && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-1.5 text-right text-[11.5px] font-medium text-sage"
        >
          {labels[score]}
        </motion.p>
      )}
    </div>
  );
}

function BrandPanel() {
  const { t } = useTranslation();
  return (
    <div className="relative hidden min-h-[420px] overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-pine-900 via-pine-800 to-leaf-800 p-10 text-paper shadow-lift lg:flex lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <motion.div
          animate={{ rotate: [0, 8, 0], x: [0, 10, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-8 top-6"
        >
          <IconSun className="h-32 w-32 text-honey-400/60" />
        </motion.div>
        <motion.div
          animate={{ rotate: [0, -10, 0], y: [0, -12, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-10 bottom-8"
        >
          <IconLeaf className="h-32 w-32 text-leaf-400/40" />
        </motion.div>
      </div>

      <p className="font-display relative z-10 text-[15px] italic text-leaf-200/80">{t("auth.brandPanel.hello")}</p>
      <div className="relative z-10">
        <h2 className="font-display text-3xl font-semibold leading-tight">
          {t("auth.brandPanel.heading1")}
          <br />
          {t("auth.brandPanel.heading2")}
        </h2>
        <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-pine-100/80">
          {t("auth.brandPanel.subtitle")}
        </p>
      </div>
    </div>
  );
}