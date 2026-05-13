import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { supabasePlatform } from '@/lib/supabasePlatform'

function usePlatformSession() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    supabasePlatform.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabasePlatform.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  return { user, loading: user === undefined }
}

export function useSuperAdmin() {
  const { user, loading: sessionLoading } = usePlatformSession()

  const { data: role, isLoading: roleLoading } = useQuery<string | null>({
    queryKey: ['platform-user-role', user?.id],
    queryFn: async () => {
      const { data } = await supabasePlatform
        .from('users')
        .select('role')
        .eq('id', user!.id)
        .single()
      return (data as { role: string } | null)?.role ?? null
    },
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 10,
  })

  return {
    isSuperAdmin: role === 'super_admin',
    loading: sessionLoading || roleLoading,
    user,
  }
}
