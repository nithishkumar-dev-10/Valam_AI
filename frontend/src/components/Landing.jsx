export default function Landing({ onStart, t, lang }) {
  return (
    <div className="screen home">
      <header className="hero">
        <span className="brand-mark">வ</span>
        <h1>{t('brand', lang)}</h1>
        <p className="tagline">{t('tagline', lang)}</p>
      </header>

      <section className="feature-grid">
        <div className="feature-card">
          <span className="feature-icon" aria-hidden="true">🌾</span>
          <p>{t('featCrop', lang)}</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon" aria-hidden="true">🍃</span>
          <p>{t('featDisease', lang)}</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon" aria-hidden="true">🐛</span>
          <p>{t('featPest', lang)}</p>
        </div>
      </section>

      <button type="button" className="btn-primary big" onClick={onStart}>
        {t('startCheck', lang)}
      </button>
    </div>
  )
}