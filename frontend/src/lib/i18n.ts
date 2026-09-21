import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import ta from "../locales/ta.json";

export type AppLang = "en" | "ta";

const STORAGE_KEY = "valam.lang";
const stored = localStorage.getItem(STORAGE_KEY);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ta: { translation: ta },
  },
  lng: stored === "en" || stored === "ta" ? stored : "ta",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  keySeparator: ".",
  returnNull: false,
});

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng === "ta" ? "ta" : "en";
  localStorage.setItem(STORAGE_KEY, lng);
});
document.documentElement.lang = (i18n.resolvedLanguage as AppLang) ?? "ta";

export function setAppLang(lng: AppLang): void {
  void i18n.changeLanguage(lng);
}

/** Current app language — the same setting drives the voice `lang` field. */
export function getAppLang(): AppLang {
  return i18n.resolvedLanguage === "ta" ? "ta" : "en";
}

/**
 * Translate a backend-enum value (crop name, disease/pest class, confidence
 * word, resolution, soil source…). Looks up the normalized token in the active
 * locale's `values` map; falls back to the raw token when unknown.
 */
export function tValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const key =
    "values." +
    raw
      .toLowerCase()
      .replace(/[_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return i18n.t(key, { defaultValue: raw });
}

export default i18n;