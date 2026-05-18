import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function calcWaitMinutes(activeOrderCount: number, basePrepMinutes: number): number {
  const hour = new Date().getHours()
  const queueBonus = activeOrderCount * 2
  const isPeak = (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21)
  const isShoulder = (hour >= 7 && hour <= 9) || (hour >= 15 && hour <= 17)
  const multiplier = isPeak ? 1.3 : isShoulder ? 1.1 : 1.0
  return Math.round((basePrepMinutes + queueBonus) * multiplier)
}

export function useEstimatedWait(restaurantId: string | undefined, basePrepMinutes: number) {
  return useQuery({
    queryKey: ['estimated-wait', restaurantId, basePrepMinutes],
    queryFn: async () => {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId!)
        .in('stage', ['received', 'cooking'])
      return calcWaitMinutes(count ?? 0, basePrepMinutes)
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
