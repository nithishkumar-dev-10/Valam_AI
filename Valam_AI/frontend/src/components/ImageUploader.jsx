import { useRef, useState, useCallback } from 'react'

export default function ImageUploader({ value, onChange, t, lang }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const preview = value ? URL.createObjectURL(value) : null

  const pick = useCallback(
    (file) => {
      if (file && file.type.startsWith('image/')) onChange(file)
    },
    [onChange],
  )

  return (
    <div className="field">
      <span className="field-label">{t('photo', lang)}</span>
      {!value ? (
        <div
          className={`upload-zone ${dragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            pick(e.dataTransfer.files?.[0])
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <span className="upload-icon" aria-hidden="true">
            📷
          </span>
          <span>{t('photoDrop', lang)}</span>
        </div>
      ) : (
        <div className="upload-preview">
          <img src={preview} alt="preview" />
          <div className="upload-preview-actions">
            <button type="button" className="btn-ghost" onClick={() => inputRef.current?.click()}>
              {t('photoChange', lang)}
            </button>
            <button type="button" className="btn-ghost" onClick={() => onChange(null)}>
              ✕
            </button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <p className="field-hint">{t('photoOptional', lang)}</p>
    </div>
  )
}