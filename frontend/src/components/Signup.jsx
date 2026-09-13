import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import { authSignup } from '../api.js'

const PHONE_RE = /^\+?[0-9]{10,15}$/

export default function Signup({ onBack, onAuthed, onGoLogin, t, lang }) {
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  function validate() {
    const e = {}
    const digits = phone.replace(/[\s-]/g, '')
    if (!name.trim()) e.name = t('nameRequired', lang)
    if (!phone.trim()) e.phone = t('phoneRequired', lang)
    else if (!PHONE_RE.test(digits)) e.phone = t('phoneInvalid', lang)
    if (!password) e.password = t('pwdRequired', lang)
    else if (password.length < 6) e.password = t('pwdMin', lang)
    if (confirm !== password) e.confirm = t('pwdMismatch', lang)
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setFormError('')
    if (!validate()) return
    setBusy(true)
    try {
      await authSignup({ name: name.trim(), phone_number: phone, password })
      // Success: sign the new farmer straight in (fetch profile + JWT).
      await login(phone, password)
      onAuthed()
    } catch (err) {
      // Backend returns: "An account with this phone number already exists."
      // Nothing to fix on our side — send the farmer to the login screen.
      if (err && /already exists/i.test(String(err.message))) {
        onGoLogin()
      } else {
        setFormError((err && err.message) || t('authGenericError', lang))
      }
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
        <span className="screen-title">{t('signUp', lang)}</span>
      </div>

      <div className="auth-card">
        <h2 className="auth-title">{t('signupTitle', lang)}</h2>
        <p className="auth-hint">{t('authHint', lang)}</p>

        {formError && <div className="form-error" role="alert">{formError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="signup-name">{t('name', lang)}</label>
            <input
              id="signup-name"
              className="text-input"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="field-hint error">{errors.name}</p>}
          </div>

          <div className="field auth-field">
            <label className="field-label" htmlFor="signup-phone">{t('phone', lang)}</label>
            <input
              id="signup-phone"
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
            <label className="field-label" htmlFor="signup-password">{t('password', lang)}</label>
            <input
              id="signup-password"
              className="text-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <p className="field-hint error">{errors.password}</p>}
          </div>

          <div className="field auth-field">
            <label className="field-label" htmlFor="signup-confirm">{t('confirmPassword', lang)}</label>
            <input
              id="signup-confirm"
              className="text-input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && <p className="field-hint error">{errors.confirm}</p>}
          </div>

          <button type="submit" className={`btn-primary big auth-submit${busy ? ' disabled' : ''}`} disabled={busy}>
            {busy ? '…' : t('signUp', lang)}
          </button>
        </form>

        <p className="auth-switch-row">
          {t('haveAccount', lang)}{' '}
          <button type="button" onClick={onGoLogin}>{t('signIn', lang)}</button>
        </p>
      </div>
    </div>
  )
}