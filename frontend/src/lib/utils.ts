import i18n from "./i18n";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "Tomato___Leaf_Mold" -> "Leaf Mold" ; "healthy" -> "Healthy". */
export function prettifyClass(raw: string): string {
  const bits = raw.split("___");
  const label = bits[bits.length - 1] ?? raw;
  return label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export function prettifyCrop(raw: string): string {
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function percent(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

export function confidenceTone(label?: string): "leaf" | "honey" | "clay" | "sage" {
  switch ((label ?? "").toLowerCase()) {
    case "high":
      return "leaf";
    case "medium":
      return "honey";
    case "low":
      return "clay";
    default:
      return "sage";
  }
}

export function fmtPhone(phone: string): string {
  const p = phone.replace(/\D/g, "");
  if (p.length === 12 && p.startsWith("91")) return `+91 ${p.slice(2, 7)} ${p.slice(7)}`;
  if (p.length === 10) return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
  return phone;
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function fmtNumber(value: number, decimals = 0): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Extract a human message from a FastAPI/Axios error without leaking details. */
export function apiErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as { response?: unknown; message?: string; code?: string };
    if (e.message) return e.message;
  }
  if (err instanceof Error && "response" in err) {
    const res = (err as { response: { data?: unknown } }).response.data;
    if (res && typeof res === "object") {
      const detail = (res as { detail?: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        const parts = detail
          .map((d) => {
            const v = (d as { msg?: string }).msg;
            return typeof v === "string" ? v : null;
          })
          .filter(Boolean) as string[];
        if (parts.length) return parts.join(" · ");
      }
    }
    const status = (err as { response: { status?: number } }).response.status;
    if (status === 500) return i18n.t("errors.api500");
    if (status === 429) return i18n.t("errors.api429");
    if (status === 404) return i18n.t("errors.api404");
    if (status === 401) return i18n.t("errors.api401");
  }
  if (err instanceof Error && (err.message === "Network Error" || (err as Error & { code?: string }).code === "ERR_NETWORK")) {
    return i18n.t("errors.network");
  }
  if (err instanceof Error) return err.message;
  return i18n.t("errors.generic");
}