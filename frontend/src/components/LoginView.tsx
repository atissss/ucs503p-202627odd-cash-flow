import { useState, type FormEvent } from 'react'

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string) => Promise<void>
}

/** Full-screen sign-in / registration gate shown until the user is authenticated. */
export function LoginView({ onLogin, onRegister }: LoginViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-lg font-semibold tracking-tight text-ink-200">Intrinsic</div>
          <div className="text-sm text-ink-400">DCF Valuation &amp; Scenario Analysis</div>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-col gap-4 rounded-xl border border-ink-800 bg-ink-900/60 p-6"
        >
          <h1 className="text-sm font-medium tracking-wide text-ink-400 uppercase">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h1>

          <label className="block">
            <span className="text-xs text-ink-400">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-700 bg-ink-950/60 px-2.5 py-1.5 text-sm text-ink-200 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-xs text-ink-400">Password</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-700 bg-ink-950/60 px-2.5 py-1.5 text-sm text-ink-200 outline-none focus:border-brand-500"
            />
            <span className="mt-1 block text-xs text-ink-400">At least 8 characters.</span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-40"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError(null)
            }}
            className="text-xs text-brand-400 hover:underline"
          >
            {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
