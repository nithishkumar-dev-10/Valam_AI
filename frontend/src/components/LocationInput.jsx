import { useState } from 'react'

// Location: manual place-name text is the DEFAULT path (works on every device
// with zero permissions), GPS is the fallback button. Both are captured so the
// backend can use lat/lon when present and fall back to reverse-geocoding the
// text only if GPS was unavailable.
export default function LocationInput({ value, onChange, t, lang }) {
  const [locState, setLocState] = useState({ text: value?.text || '', gps: value?.gps || null, err: '' })

  const push = (next) => {
    setLocState((s) => {
      const merged = { ...s, ...next }
      onChange({ text: merged.text, gps: merged.gps })
      return merged
    })
  }

  function useGps() {
    if (!navigator.geolocation) {
      push({ err: 'unavailable' })
      return
    }
    push({ err: '', locating: true })
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        push({
          gps: { lat: +pos.coords.latitude.toFixed(5), lon: +pos.coords.longitude.toFixed(5) },
          err: '',
          locating: false,
        }),
      () => push({ err: 'denied', locating: false }),
      { timeout: 8000 },
    )
  }

  return (
    <div className="field">
      <span className="field-label">{t('location', lang)}</span>
      <div className="loc-inputs">
        <input
          type="text"
          value={locState.text}
          placeholder={t('locTypeHere', lang)}
          onChange={(e) => push({ text: e.target.value })}
          className="loc-text"
        />
        <button type="button" className="btn-ghost loc-gps" onClick={useGps}>
          {locState.locating ? '…' : '📍'}
        </button>
      </div>
      {locState.gps && (
        <p className="field-hint ok">
          {t('locGeoOk', lang)} ({locState.gps.lat}, {locState.gps.lon})
        </p>
      )}
      {locState.err && <p className="field-hint error">{t('locGeoErr', lang)}</p>}
      <p className="field-hint">{t('locHint', lang)}</p>
    </div>
  )
}