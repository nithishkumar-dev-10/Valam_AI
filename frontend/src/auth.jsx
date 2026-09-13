import { createContext, useContext, useState } from 'react'
import { authLogin, authMe } from './api.js'

// Key MUST match api.js's realSubmitCheck (it reads valam_token to attach
// the Authorization header on authenticated calls).
const TOKEN_KEY = 'valam_token'
const USER_KEY = 'valam_user'

const AuthContext = createContext(null)

const normalizePhone = (raw) => String(raw || '').replace(/[\s-]/g, '')

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(readUser)

  function signIn(nextToken, nextUser) {
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  // Exchanges phone+password for a JWT and fetches the profile. Used by
  // both Login.jsx and (after signup) Signup.jsx.
  async function login(phone_number, password) {
    const res = await authLogin({ phone_number, password })
    const me = await authMe(res.access_token).catch(() => ({
      phone_number: normalizePhone(phone_number),
      name: '',
    }))
    signIn(res.access_token, me)
    return me
  }

  return (
    <AuthContext.Provider
      value={{ token, user, isAuthed: Boolean(token), signIn, signOut, login }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}