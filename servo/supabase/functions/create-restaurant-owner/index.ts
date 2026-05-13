// @ts-nocheck — Deno edge function; URL imports are resolved by Supabase's runtime, not the local TS compiler
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify caller is a super_admin
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }

  const { data: { user: caller }, error: jwtErr } = await adminClient.auth.getUser(jwt)
  if (jwtErr || !caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }

  const { data: callerRow } = await adminClient.from('users').select('role').eq('id', caller.id).single()
  if ((callerRow as { role: string } | null)?.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden: super_admin role required' }), { status: 403, headers: corsHeaders })
  }

  let body: { name: string; slug: string; tagline?: string; currency: string; ownerEmail: string; ownerPassword: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders })
  }

  const { name, slug, tagline, currency, ownerEmail, ownerPassword } = body
  if (!name || !slug || !ownerEmail || !ownerPassword) {
    return new Response(JSON.stringify({ error: 'name, slug, ownerEmail and ownerPassword are required' }), { status: 400, headers: corsHeaders })
  }

  // 1 — Create restaurant
  const { data: restaurant, error: rErr } = await adminClient
    .from('restaurants')
    .insert({ name, slug, tagline: tagline || null, currency, accepting_orders: true })
    .select('id')
    .single()

  if (rErr) {
    return new Response(
      JSON.stringify({ error: rErr.message, code: rErr.code }),
      { status: 400, headers: corsHeaders }
    )
  }

  const restaurantId = (restaurant as { id: string }).id

  // 2 — Create auth user
  const { data: authData, error: uErr } = await adminClient.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
  })

  if (uErr) {
    await adminClient.from('restaurants').delete().eq('id', restaurantId)
    return new Response(JSON.stringify({ error: uErr.message }), { status: 400, headers: corsHeaders })
  }

  const newUserId = authData.user.id

  // 3 — Insert public.users row (extends auth.users)
  const { error: pubErr } = await adminClient
    .from('users')
    .insert({ id: newUserId, email: ownerEmail, role: 'owner' })

  if (pubErr) {
    await adminClient.auth.admin.deleteUser(newUserId)
    await adminClient.from('restaurants').delete().eq('id', restaurantId)
    return new Response(JSON.stringify({ error: pubErr.message }), { status: 400, headers: corsHeaders })
  }

  // 4 — Link user to restaurant
  const { error: mErr } = await adminClient
    .from('restaurant_members')
    .insert({ user_id: newUserId, restaurant_id: restaurantId, role: 'owner' })

  if (mErr) {
    await adminClient.auth.admin.deleteUser(newUserId)
    await adminClient.from('restaurants').delete().eq('id', restaurantId)
    return new Response(JSON.stringify({ error: mErr.message }), { status: 400, headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({ restaurantId, userId: newUserId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
