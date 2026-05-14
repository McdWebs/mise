import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { supabasePlatform } from '@/lib/supabasePlatform'

export function AdminEnterPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const asParam = searchParams.get('as')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!asParam) {
      navigate('/admin', { replace: true })
      return
    }

    supabasePlatform.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate('/login', { replace: true })
        return
      }

      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })

      if (setErr) {
        setError('Could not establish admin session — try signing in again.')
        return
      }

      // Fetch the restaurant slug so we can build the slug-based URL
      const { data: restaurant } = await supabasePlatform
        .from('restaurants')
        .select('slug')
        .eq('id', asParam)
        .single()

      const slug = (restaurant as { slug: string } | null)?.slug
      if (!slug) {
        setError('Restaurant not found.')
        return
      }

      navigate(`/admin/${slug}/overview?platform=1`, { replace: true })
    })
  }, [])

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <p className="text-body text-ember">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <div className="w-5 h-5 border-2 border-paper-3 border-t-saffron rounded-full animate-spin" />
    </div>
  )
}
