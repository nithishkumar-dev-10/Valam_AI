import { useState } from 'react'
import { t } from './i18n.js'
import { submitCheck } from './api.js'
import Landing from './components/Landing.jsx'
import NewCheck from './components/NewCheck.jsx'
import Results from './components/Results.jsx'

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

  return (
    <div className="app">
      <div className="app-shell">
        {view === 'home' && <Landing onStart={() => setView('new')} t={t} lang={lang} />}
        {view === 'new' && (
          <NewCheck onBack={() => setView('home')} onNext={handleSubmit} t={t} lang={lang} />
        )}
        {view === 'results' && result && (
          <Results result={result} t={t} lang={lang} onNew={() => setView('new')} />
        )}
      </div>
    </div>
  )
}