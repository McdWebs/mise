import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/features/auth/hooks/useSession'

export function useSuperAdmin() {
  const { user, loading: sessionLoading } = useSession()

  const { data: role, isLoading: roleLoading } = useQuery<string | null>({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      const { data } = await supabase
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
