import { useState } from 'react'
import LanguageToggle from './LanguageToggle.jsx'
import ImageUploader from './ImageUploader.jsx'
import VoiceRecorder from './VoiceRecorder.jsx'
import LocationInput from './LocationInput.jsx'

export default function NewCheck({ onBack, onNext, t, lang }) {
  const [image, setImage] = useState(null)
  const [audio, setAudio] = useState(null)
  const [location, setLocation] = useState({ text: '', gps: null })
  const [langSel, setLangSel] = useState('auto')
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    setRunning(true)
    try {
      await onNext({
        image,
        audio,
        location,
        lang: langSel,
      })
    } catch (e) {
      setErr(e?.message || 'Unexpected error')
      setRunning(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen-top">
        <button type="button" className="btn-ghost back" onClick={onBack}>
          ← {t('back', lang)}
        </button>
        <span className="screen-title">{t('newCheck', lang)}</span>
      </div>

      <div className="check-form">
        <ImageUploader value={image} onChange={setImage} t={t} lang={lang} />
        <VoiceRecorder value={audio} onChange={setAudio} t={t} lang={lang} />
        <LocationInput value={location} onChange={setLocation} t={t} lang={lang} />
        <LanguageToggle value={langSel} onChange={setLangSel} lang={lang} />
      </div>

      {err && <p className="field-hint error">{err}</p>}

      <button
        type="button"
        className={`btn-primary big submit-btn ${running ? 'disabled' : ''}`}
        onClick={submit}
        disabled={running}
      >
        {running ? t('running', lang) + '…' : t('submit', lang)}
      </button>
    </div>
  )
}