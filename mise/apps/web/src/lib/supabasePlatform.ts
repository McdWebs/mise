import { createClient } from '@supabase/supabase-js'
import type { Database } from '@mise/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.')
}

// Separate client for the platform dashboard.
// Uses a distinct storageKey so the platform session and the owner session
// live in different localStorage slots and never overwrite each other.
export const supabasePlatform = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'mise-platform-session',
    persistSession: true,
    autoRefreshToken: true,
  },
})
