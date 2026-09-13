import { LANGS } from '../i18n.js'

export default function LanguageToggle({ value, onChange, lang }) {
  return (
    <div className="field">
      <span className="field-label">Language</span>
      <div className="lang-toggle" role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button
            key={l.value}
            type="button"
            className={`lang-toggle-btn ${value === l.value ? 'active' : ''}`}
            onClick={() => onChange(l.value)}
          >
            {lang === 'ta' ? l.labelTa : l.labelEn}
          </button>
        ))}
      </div>
    </div>
  )
}