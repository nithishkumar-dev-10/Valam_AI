// Backend contract shapes — mirror backend/app/schemas/*.py exactly.

export interface FarmerOut {
  id: string;
  name: string;
  phone_number: string;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Health {
  status: string;
  service?: string;
  version?: string;
  database?: string;
}

// ---- crop ----

export interface ManualCropInput {
  N: number;
  P: number;
  K: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
}

export interface CropOutput {
  predicted_crop: string;
  confidence: number;
  confidence_label: string;
  soil_source: string;
  weather_source: string;
  location: string;
  warning: string | null;
  data_resolution: string;
  input_confidence: string | null;
  data_quality_note: string | null;
}

export interface ModelResult extends CropOutput {
  model: string;
  predicted_class?: string | null;
}

// ---- detection ----

export interface DiseaseOutput {
  predicted_class: string;
  confidence: number;
  confidence_label?: string;
}

export interface WeedPestOutput extends DiseaseOutput {
  model?: string;
}

// ---- voice ----

export type VoiceLang = "ta" | "en";

export interface UnifiedVoiceResponse {
  intent: "crop" | "disease" | "pest" | "answer" | "unknown" | null;
  transcribed_text: string;
  detected_language: string;
  language_probability: number | null;
  text_response: string | null;
  response_text?: string | null;
  audio_url: string | null;
  audio_response_path?: string | null;
  results: ModelResult[];
  crop_result: CropOutput | null;
  disease_result: DiseaseOutput | null;
  pest_result: WeedPestOutput | null;
}

export type VoiceInput = {
  audio?: Blob;
  image?: File;
  latitude?: number;
  longitude?: number;
  lang: VoiceLang;
};