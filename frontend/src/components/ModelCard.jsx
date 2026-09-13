import { t as _t } from '../i18n.js'

// What data_resolution means, in human words. Backend sends
// "district" | "state" | "fallback" | "manual" — we add the note sidecar.
const RESOLUTION_META = {
  district: { key: 'resDistrict' },
  state: { key: 'resState' },
  fallback: { key: 'resFallback' },
  manual: { key: 'resManual' },
}

export default function ModelCard({ result, t, lang }) {
  const isCrop = result.model === 'crop'

  return (
    <div className={`model-card ${isCrop ? 'crop' : ''}`}>
      <div className="model-head">
        <span className="model-name">{t(result.modelKey, lang)}</span>
        <span className={`conf-badge ${result.confidence_label?.toLowerCase() || ''}`}>
          {t('confidenceLabel', lang)} · {result.confidence_label || Math.round(result.confidence * 100) + '%'}
        </span>
      </div>

      <div className="model-body">
        <span className="predicted-class">
          <strong>{result.predicted_class}</strong>
        </span>
        <span className="model-pct">{Math.round((result.confidence || 0) * 100)}%</span>
      </div>

      {isCrop && (
        <div className="resolution-row">
          {/* SURFACED PROMINENTLY: never hide where the recommendation came from */}
          <span className={`res-badge ${result.data_resolution || ''}`}>
            {t((RESOLUTION_META[result.data_resolution] || RESOLUTION_META.fallback).key, lang)}
          </span>
          {result.location && <span className="res-loc">{result.location}</span>}
        </div>
      )}

      {isCrop && result.data_quality_note && (
        <p className="quality-note">{result.data_quality_note}</p>
      )}
    </div>
  )
}