import { useRef, useState, useEffect, useCallback } from 'react'

export default function VoiceRecorder({ value, onChange, t, lang }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [micErr, setMicErr] = useState('')
  const [playUrl, setPlayUrl] = useState('')
  const [pending, setPending] = useState(null) // just-recorded blob not yet confirmed
  const fileInputRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const startAtRef = useRef(0)

  useEffect(() => () => clearInterval(timerRef.current), [])

  const commitFile = useCallback((file) => {
    setPending(null)
    setPlayUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
    onChange(file)
  }, [onChange])

  function start() {
    setMicErr('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicErr('no mic')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const rec = new MediaRecorder(stream)
        recorderRef.current = rec
        chunksRef.current = []
        rec.ondataavailable = (e) => {
          if (e.data.size) chunksRef.current.push(e.data)
        }
        rec.onstop = () => {
          stream.getTracks().forEach((tr) => tr.stop())
          const type = rec.mimeType || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type })
          setPending(new File([blob], 'recording.webm', { type }))
        }
        rec.start()
        startAtRef.current = Date.now()
        setRecording(true)
        timerRef.current = setInterval(
          () => setSeconds(Math.round((Date.now() - startAtRef.current) / 1000)),
          200,
        )
      })
      .catch(() => setMicErr('denied'))
  }

  function stop() {
    recorderRef.current?.stop()
    setRecording(false)
    clearInterval(timerRef.current)
    setSeconds(0)
  }

  const showMic = !value || !value.name // real recording is source of truth

  return (
    <div className="field">
      <span className="field-label">{t('voice', lang)}</span>
      <div className="voice-box">
        {micErr && (
          <p className="field-hint error">⚠ {t('micErr', lang)}</p>
        )}

        {!recording ? (
          <div className="voice-actions">
            <button type="button" className="btn-primary mic-btn" onClick={start}>
              {recording ? t('micStop', lang) : t('micStart', lang)} 🎙
            </button>
            <button type="button" className="btn-ghost" onClick={() => fileInputRef.current?.click()}>
              {t('micUpload', lang)}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) commitFile(f)
                e.target.value = ''
              }}
            />
          </div>
        ) : (
          <div className="recording">
            <span className="rec-dot" aria-hidden="true" />
            <span>{t('micRecording', lang)} {seconds}s</span>
            <button type="button" className="btn-danger" onClick={stop}>
              {t('micStop', lang)}
            </button>
          </div>
        )}

        {pending && !recording && (
          <div className="pending-audio">
            <button type="button" className="btn-ghost" onClick={() => setPlayUrl((old) => { URL.revokeObjectURL(old); return URL.createObjectURL(pending) })}>
              ▶ {t('micPlayback', lang)}
            </button>
            <div className="pending-actions">
              <button type="button" className="btn-primary" onClick={() => commitFile(pending)}>
                {t('micUseThis', lang)}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setPending(null)}>
                {t('micRetry', lang)}
              </button>
            </div>
          </div>
        )}

        {playUrl && !pending && (
          <div className="audio-ready">
            <audio controls src={playUrl} />
            <button type="button" className="btn-ghost" onClick={() => { setPlayUrl((old) => { URL.revokeObjectURL(old); return '' }); onChange(null) }}>
              ✕ {t('micRetry', lang)}
            </button>
          </div>
        )}
      </div>
      <p className="field-hint">{t('micHint', lang)}</p>
    </div>
  )
}