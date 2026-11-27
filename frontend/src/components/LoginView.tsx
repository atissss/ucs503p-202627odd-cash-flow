import { useRef, useState, type FormEvent, type PointerEvent } from 'react'

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string) => Promise<void>
}

/** Full-screen glassy sign-in / registration gate with a cursor-following glow. */
export function LoginView({ onLogin, onRegister }: LoginViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  function trackPointer(e: PointerEvent<HTMLDivElement>) {
    const el = rootRef.current
    if (!el) return
    el.style.setProperty('--mx', `${e.clientX}px`)
    el.style.setProperty('--my', `${e.clientY}px`)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await onLogin(email, password)
      else await onRegister(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gd-app login-shell" ref={rootRef} onPointerMove={trackPointer}>
      <div className="login-glow" aria-hidden="true" />
      <div className="login-wrap">
        <div className="login-head">
          <div className="login-title">Intrinsic</div>
          <div className="login-sub">DCF Valuation &amp; Scenario Analysis</div>
        </div>

        <form onSubmit={submit} className="gd-panel login-card">
          <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>

          <label>
            <span className="lbl">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label>
            <span className="lbl">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="login-help">At least 8 characters.</span>
          </label>

          {error && <p className="login-err">{error}</p>}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <button
            type="button"
            className="login-link"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError(null)
            }}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
