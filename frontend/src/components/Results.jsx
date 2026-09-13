import ModelCard from './ModelCard.jsx'

export default function Results({ result, t, lang, onNew }) {
  const { summary, models_ran, audio } = result

  return (
    <div className="screen">
      <div className="screen-top">
        <span className="screen-title">{t('results', lang)}</span>
      </div>

      <div className="summary-card">
        <span className="summary-label">{t('summaryLabel', lang)}</span>
        <p className="summary-text">{summary}</p>
      </div>

      {audio && (
        <div className="audio-answer">
          <button
            type="button"
            className="btn-primary play-btn"
            onClick={() => {
              const el = document.getElementById('tts-audio')
              el?.play()
            }}
          >
            ▶ {t('playAudio', lang)}
          </button>
          <audio id="tts-audio" src={audio.url} />
        </div>
      )}

      <section className="models-section">
        <h3 className="section-label">{t('modelsRan', lang)}</h3>
        {(models_ran || []).map((m, i) => (
          <ModelCard key={i} result={m} t={t} lang={lang} />
        ))}
        {!models_ran?.length && <p className="field-hint">No model results returned.</p>}
      </section>

      <button type="button" className="btn-primary big" onClick={onNew}>
        {t('newCheckAgain', lang)}
      </button>
    </div>
  )
}