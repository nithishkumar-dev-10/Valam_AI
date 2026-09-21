import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  CropOutput,
  DiseaseOutput,
  FarmerOut,
  Health,
  ManualCropInput,
  TokenPair,
  UnifiedVoiceResponse,
  VoiceInput,
  WeedPestOutput,
} from "../types";

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

// The refresh token NEVER touches JavaScript: it lives in an httpOnly + SameSite
// cookie scoped to /api/v1/auth (set by the backend on login, rotated on every
// /auth/refresh, cleared on logout). The access token is the only thing client
// code holds, and only in memory — NOT localStorage — so injected JS can read
// neither long-lived credential.
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;
export const isAuthed = () => Boolean(accessToken);
export function setAccessToken(token: string) {
  accessToken = token;
}
export function clearAccessToken() {
  accessToken = null;
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 150_000,
  // With the refresh token in a cookie, every request must carry credentials
  // so the cookie is sent — and the browser will store the Set-Cookie from
  // login/refresh/logout responses (cross-origin it refuses without this).
  withCredentials: true,
});

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

// Single-flight refresh so concurrent 401s share one network call. The cookie
// is sent automatically (withCredentials); no body is needed.
let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios
    .post<TokenPair>(`${BASE_URL}/api/v1/auth/refresh`, undefined, {
      withCredentials: true,
    })
    .then(({ data }) => {
      setAccessToken(data.access_token);
    })
    .catch((error: unknown) => {
      clearAccessToken();
      onUnauthorized();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

// Routes that must never trigger a 401 -> refresh -> retry loop (they ARE the
// refresh machinery, or need the cookie/provider state to change first).
const NO_REFRESH_RETRY = ["/auth/login", "/auth/refresh", "/auth/logout"];

// On 401 (except the auth endpoints above): rotate the cookie-backed refresh
// token once, retry the original request; otherwise bounce to the auth screen.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequestConfig | undefined;
    const isAuthRoute = NO_REFRESH_RETRY.some((p) => original?.url?.includes(p));
    const canRetry =
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !isAuthRoute;

    if (canRetry) {
      original._retried = true;
      try {
        await refreshSession();
        original.headers.set("Authorization", `Bearer ${getAccessToken()}`);
        return await api(original);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

// ---- typed endpoints ----

export const AuthAPI = {
  signup: (body: { name: string; phone_number: string; password: string }) =>
    api.post<FarmerOut>("/auth/signup", body),

  login: (phone: string, password: string) =>
    api.post<TokenPair>(
      "/auth/login",
      new URLSearchParams({ username: phone, password }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    ),

  me: () => api.get<FarmerOut>("/auth/me"),

  updateName: (name: string) =>
    api.patch<FarmerOut>("/auth/me", { name }).then((r) => r.data),

  deleteMe: () => api.delete<void>("/auth/me"),

  // Revokes the refresh token SERVER-SIDE and clears the httpOnly cookie (the
  // cookie rides along automatically via withCredentials). Best-effort: the
  // caller still clears the in-memory access token even if the call fails
  // (offline logout must not leave the user stuck).
  logout: () => api.post<void>("/auth/logout"),
};

export const CropAPI = {
  simple: (latitude: number, longitude: number) =>
    api.post<CropOutput>("/predict/crop-simple", { latitude, longitude }).then((r) => r.data),

  manual: (input: ManualCropInput) =>
    api.post<CropOutput>("/predict/crop-manual", input).then((r) => r.data),
};

const imageForm = (file: File | Blob, field: string, name: string) => {
  const form = new FormData();
  form.append(field, file, name);
  return form;
};

export const PredictAPI = {
  disease: (file: File) =>
    api
      .post<DiseaseOutput>("/predict/disease", imageForm(file, "file", file.name), {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  weed: (file: File) =>
    api
      .post<WeedPestOutput>("/predict/deep-weed", imageForm(file, "file", file.name), {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),

  pest: (file: File) =>
    api
      .post<WeedPestOutput>("/predict/pest", imageForm(file, "file", file.name), {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data),
};

export const VoiceAPI = {
  query: async (input: VoiceInput) => {
    const form = new FormData();
    if (input.audio) {
      const ext = input.audio.type.includes("mp4") ? "m4a" : "webm";
      form.append("audio", input.audio, `recording.${ext}`);
    }
    if (input.image) form.append("image", input.image, input.image.name);
    if (input.latitude !== undefined) form.append("latitude", String(input.latitude));
    if (input.longitude !== undefined) form.append("longitude", String(input.longitude));
    form.append("lang", input.lang);
    return api
      .post<UnifiedVoiceResponse>("/voice/query", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};

export const HealthAPI = {
  get: () => api.get<Health>("/health").then((r) => r.data),
};

export type { AxiosResponse };
export { BASE_URL }; // eslint-disable-line no-unused-vars