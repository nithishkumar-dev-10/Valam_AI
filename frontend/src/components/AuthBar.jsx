import { useAuth } from '../auth.jsx'

// Optional, non-blocking auth strip. The core feature stays open: this bar
// only shows Sign in/Sign up when logged out, or the farmer's name + Sign
// out when logged in. A future "my saved checks" page can be gated by
// wrapping it with a guard that checks useAuth().isAuthed.
export default function AuthBar({ t, lang, onSignIn, onSignUp }) {
  const { user, isAuthed, signOut } = useAuth()

  if (isAuthed) {
    return (
      <div className="auth-bar">
        <span className="auth-user">{user?.name || user?.phone_number || ''}</span>
        <button type="button" className="btn-ghost slim" onClick={signOut}>
          {t('signOut', lang)}
        </button>
      </div>
    )
  }
  return (
    <div className="auth-bar">
      <button type="button" className="btn-ghost slim" onClick={onSignIn}>
        {t('signIn', lang)}
      </button>
      <button type="button" className="btn-ghost slim" onClick={onSignUp}>
        {t('signUp', lang)}
      </button>
    </div>
  )
}