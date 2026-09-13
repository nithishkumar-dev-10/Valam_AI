import { useState } from 'react'
import { useAuth } from '../auth.jsx'

const PHONE_RE = /^\+?[0-9]{10,15}$/

export default function Login({ onBack, onAuthed, onGoSignup, t, lang }) {
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  function validate() {
    const e = {}
    const digits = phone.replace(/[\s-]/g, '')
    if (!phone.trim()) e.phone = t('phoneRequired', lang)
    else if (!PHONE_RE.test(digits)) e.phone = t('phoneInvalid', lang)
    if (!password) e.password = t('pwdRequired', lang)
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setFormError('')
    if (!validate()) return
    setBusy(true)
    try {
      await login(phone, password)
      onAuthed()
    } catch (err) {
      // Backend returns: "Incorrect phone number or password" (401/400).
      setFormError(
        (err && /incorrect/i.test(String(err.message))) || (err && err.status === 401)
          ? t('authInvalid', lang)
          : (err && err.message) || t('authGenericError', lang),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="screen-top">
        <button type="button" className="btn-ghost back" onClick={onBack}>
          ← {t('back', lang)}
        </button>
        <span className="screen-title">{t('signIn', lang)}</span>
      </div>

      <div className="auth-card">
        <h2 className="auth-title">{t('loginTitle', lang)}</h2>
        <p className="auth-hint">{t('authHint', lang)}</p>

        {formError && <div className="form-error" role="alert">{formError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="login-phone">{t('phone', lang)}</label>
            <input
              id="login-phone"
              className="text-input"
              type="tel"
              inputMode="numeric"
              autoComplete="username"
              placeholder="98XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {errors.phone && <p className="field-hint error">{errors.phone}</p>}
          </div>

          <div className="field auth-field">
            <label className="field-label" htmlFor="login-password">{t('password', lang)}</label>
            <input
              id="login-password"
              className="text-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <p className="field-hint error">{errors.password}</p>}
          </div>

          <button type="submit" className={`btn-primary big auth-submit${busy ? ' disabled' : ''}`} disabled={busy}>
            {busy ? '…' : t('signIn', lang)}
          </button>
        </form>

        <p className="auth-switch-row">
          {t('noAccount', lang)}{' '}
          <button type="button" onClick={onGoSignup}>{t('signUp', lang)}</button>
        </p>
      </div>
    </div>
  )
}