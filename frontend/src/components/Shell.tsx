import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  BrandMark,
  IconHome,
  IconMic,
  IconScan,
  IconSprout,
  IconUser,
} from "./Icons";
import { useAuth } from "../lib/auth";
import { HealthAPI } from "../lib/api";
import { cn } from "../lib/utils";
import { SPRING } from "../lib/motion";
import { getAppLang, setAppLang } from "../lib/i18n";
import type { AppLang } from "../lib/i18n";

export function Shell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { status, farmer } = useAuth();
  const [health, setHealth] = useState<boolean | null>(null);

  const lang = getAppLang();

  const NAV = [
    { to: "/", label: t("nav.home"), Icon: IconHome, end: true },
    { to: "/crop", label: t("nav.crops"), Icon: IconSprout, end: false },
    { to: "/voice", label: t("nav.voice"), Icon: null, end: false, center: true },
    { to: "/scan", label: t("nav.scan"), Icon: IconScan, end: false },
    { to: "/profile", label: t("nav.my"), Icon: IconUser, end: false },
  ];

  const DESKTOP_NAV = NAV.filter((n) => !n.center);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location.pathname]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const h = await HealthAPI.get();
        if (alive) setHealth(h.status === "ok");
      } catch {
        if (alive) setHealth(false);
      }
    };
    void check();
    const timer = window.setInterval(check, 45_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-50 border-b border-mist/80 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Wordmark />

          <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.topBanner")}>
            {DESKTOP_NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "bg-pine-700 text-paper shadow-card"
                      : "text-sage hover:bg-pine-50 hover:text-pine-800",
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "live-dot h-2 w-2 rounded-full transition-colors duration-500",
                health === null
                  ? "bg-sage/50 text-sage/50"
                  : health
                    ? "bg-leaf-500 text-leaf-500"
                    : "bg-clay-500 text-clay-500",
              )}
              title={
                health === null
                  ? t("nav.healthNull")
                  : health
                    ? t("nav.healthOk")
                    : t("nav.healthDown")
              }
            />
            <LangToggle value={lang} onChange={setAppLang} />
            {status === "authed" && farmer ? (
              <Link
                to="/profile"
                className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-pine-700 to-leaf-600 text-sm font-bold text-paper shadow-card transition-transform duration-200 hover:-rotate-3"
                aria-label={t("nav.profileAria")}
              >
                {(farmer.name || "?").charAt(0).toUpperCase()}
              </Link>
            ) : (
              <motion.button
                type="button"
                onClick={() => navigate("/auth")}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.15, ease: SPRING }}
                className="hidden rounded-full bg-gradient-to-br from-pine-700 to-leaf-600 px-4 py-2 text-sm font-semibold text-paper shadow-card sm:inline-flex"
              >
                {t("nav.signIn")}
              </motion.button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6 lg:pb-20">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: SPRING }}
        >
          <Outlet />
        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-pine-700 to-leaf-600 text-paper shadow-card transition-transform duration-300 group-hover:-rotate-3">
        <BrandMark className="h-5 w-5" />
      </span>
      <span className="font-display text-[17px] font-semibold tracking-tight text-pine-900">
        Valam <span className="text-leaf-600">AI</span>
        <span className="ml-1.5 font-sans text-[12.5px] font-medium text-sage">வாலம்</span>
      </span>
    </Link>
  );
}

function LangToggle({ value, onChange }: { value: AppLang; onChange: (l: AppLang) => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex rounded-full border border-mist bg-surface p-0.5 shadow-edge"
      role="group"
      aria-label={t("nav.langAria")}
    >
      {(["en", "ta"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={value === l}
          className={cn(
            "relative rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors duration-200",
            value === l ? "text-paper" : "text-sage hover:text-pine-800",
          )}
        >
          {value === l && (
            <motion.span
              layoutId="lang-pill"
              className="absolute inset-0 rounded-full bg-pine-700"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className="relative">{l === "en" ? "EN" : "த"}</span>
        </button>
      ))}
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const NAV = [
    { to: "/", label: t("nav.home"), Icon: IconHome, end: true },
    { to: "/crop", label: t("nav.crops"), Icon: IconSprout, end: false },
    { to: "/voice", label: t("nav.voice"), Icon: null, end: false, center: true },
    { to: "/scan", label: t("nav.scan"), Icon: IconScan, end: false },
    { to: "/profile", label: t("nav.my"), Icon: IconUser, end: false },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-mist bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label={t("nav.topBanner")}
    >
      <div className="mx-auto flex h-16 max-w-md items-end justify-between px-2">
        {NAV.map(({ to, label, Icon, end, center }) => {
          const active = end ? location.pathname === to : location.pathname.startsWith(to);

          if (center) {
            return (
              <div key={to} className="relative flex w-1/5 justify-center">
                <Link
                  to={to}
                  aria-label={t("nav.voiceAria")}
                  className="grid h-14 w-14 -translate-y-3.5 place-items-center rounded-full bg-gradient-to-br from-pine-700 via-pine-600 to-leaf-600 text-paper shadow-lift"
                >
                  <IconMic className="h-6 w-6" />
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className="relative flex w-1/5 flex-col items-center gap-0.5 py-2"
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute top-1 h-6 w-12 rounded-full bg-pine-100"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span
                className={cn(
                  "relative grid h-6 w-6 place-items-center transition-colors duration-200",
                  active ? "text-pine-800" : "text-sage",
                )}
              >
                {Icon && <Icon className="h-5 w-5" />}
              </span>
              <span
                className={cn(
                  "relative text-[10px] font-semibold leading-none transition-colors duration-200",
                  active ? "text-pine-800" : "text-sage",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}