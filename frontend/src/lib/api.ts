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

const ACCESS_KEY = "valam.access";
const REFRESH_KEY = "valam.refresh";

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
export const isAuthed = () => Boolean(getAccessToken());

export function setTokens(pair: { access_token: string; refresh_token: string }) {
  localStorage.setItem(ACCESS_KEY, pair.access_token);
  localStorage.setItem(REFRESH_KEY, pair.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
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
});

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

// Single-flight refresh so concurrent 401s share one network call.
let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = axios
    .post<TokenPair>(`${BASE_URL}/api/v1/auth/refresh`, {
      refresh_token: getRefreshToken(),
    })
    .then(({ data }) => {
      setTokens(data);
    })
    .catch((error: unknown) => {
      clearTokens();
      onUnauthorized();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

// On 401: refresh once, retry the original request; otherwise bounce to auth.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequestConfig | undefined;
    const isAuthRoute = original?.url?.includes("/auth/");
    const canRetry =
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !isAuthRoute &&
      Boolean(getRefreshToken());

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