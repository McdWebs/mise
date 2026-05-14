import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      const msg = authError.message?.trim()
      setError(
        msg && !/invalid login credentials/i.test(msg)
          ? msg
          : 'Incorrect email or password.'
      )
      setLoading(false)
      return
    }

    // If redirected from a specific admin URL, go back there
    if (from && from !== '/admin' && from.startsWith('/admin/')) {
      navigate(from, { replace: true })
      return
    }

    // Otherwise look up the owner's restaurant slug and navigate to it
    const userId = authData.user?.id
    if (userId) {
      const { data: membership } = await supabase
        .from('restaurant_members')
        .select('restaurants(slug)')
        .eq('user_id', userId)
        .limit(1)
        .single()
      const slug = (membership as unknown as { restaurants: { slug: string } } | null)?.restaurants?.slug
      if (slug) {
        navigate(`/admin/${slug}/overview`, { replace: true })
        return
      }
    }

    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-ink flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-10">
          <img
            src="/assets/logo-mark-inverse.svg"
            alt=""
            width={32}
            height={32}
            className="rounded-2"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <span className="font-display text-[20px] font-[500] tracking-[-0.01em] text-paper font-optical">
            Mise
          </span>
        </div>

        <h1 className="font-display text-h1 text-paper font-optical mb-1.5">Sign in</h1>
        <p className="text-body-sm text-ink-7 mb-8">Owner and staff access.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-label text-ink-8 font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@bistro.co"
              className="w-full h-10 rounded-2 bg-ink-2 border border-[1.5px] border-ink-3 text-paper placeholder:text-ink-6 px-3 text-body focus-visible:outline-none focus-visible:border-saffron focus-visible:border-2 transition-[border-color] duration-standard"
            />
          </div>

          <div>
            <label className="block text-label text-ink-8 font-medium mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full h-10 rounded-2 bg-ink-2 border border-[1.5px] border-ink-3 text-paper placeholder:text-ink-6 px-3 text-body focus-visible:outline-none focus-visible:border-saffron focus-visible:border-2 transition-[border-color] duration-standard"
            />
          </div>

          {error && (
            <p className="text-body-sm text-ember">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2 bg-saffron text-paper text-body font-semibold transition-colors duration-hover hover:bg-saffron-2 active:scale-[0.98] active:duration-press disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
            )}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
