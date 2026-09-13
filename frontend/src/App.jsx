import { useState } from 'react'
import { AuthProvider } from './auth.jsx'
import { t } from './i18n.js'
import { submitCheck } from './api.js'
import Landing from './components/Landing.jsx'
import NewCheck from './components/NewCheck.jsx'
import Results from './components/Results.jsx'
import Login from './components/Login.jsx'
import Signup from './components/Signup.jsx'
import AuthBar from './components/AuthBar.jsx'

export default function App() {
  const [view, setView] = useState('home')
  const [lang, setLang] = useState('auto')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(input) {
    setBusy(true)
    try {
      const r = await submitCheck(input)
      if (input.lang) setLang(input.lang) // last language used drives UI copy
      setResult(r)
      setView('results')
    } finally {
      setBusy(false)
    }
  }

  const showAuthBar = view === 'home' || view === 'new' || view === 'results'

  return (
    <AuthProvider>
      <div className="app">
        <div className="app-shell">
          {showAuthBar && (
            <AuthBar
              t={t}
              lang={lang}
              onSignIn={() => setView('login')}
              onSignUp={() => setView('signup')}
            />
          )}
          {view === 'home' && <Landing onStart={() => setView('new')} t={t} lang={lang} />}
          {view === 'new' && (
            <NewCheck onBack={() => setView('home')} onNext={handleSubmit} t={t} lang={lang} />
          )}
          {view === 'results' && result && (
            <Results result={result} t={t} lang={lang} onNew={() => setView('new')} />
          )}
          {view === 'login' && (
            <Login
              onBack={() => setView('home')}
              onAuthed={() => setView('home')}
              onGoSignup={() => setView('signup')}
              t={t}
              lang={lang}
            />
          )}
          {view === 'signup' && (
            <Signup
              onBack={() => setView('home')}
              onAuthed={() => setView('home')}
              onGoLogin={() => setView('login')}
              t={t}
              lang={lang}
            />
          )}
        </div>
      </div>
    </AuthProvider>
  )
}