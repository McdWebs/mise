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

  const { data: callerRow } = await adminClient
    .from('users')
    .select('role')
    .eq('id', caller.id)
    .single()

  if ((callerRow as { role: string } | null)?.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden: super_admin role required' }), { status: 403, headers: corsHeaders })
  }

  let body: { restaurant_id: string; redirect_to?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders })
  }

  const { restaurant_id, redirect_to = '/admin' } = body
  if (!restaurant_id) {
    return new Response(JSON.stringify({ error: 'restaurant_id is required' }), { status: 400, headers: corsHeaders })
  }

  // Find the restaurant owner via restaurant_members
  const { data: member, error: memberErr } = await adminClient
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', restaurant_id)
    .eq('role', 'owner')
    .single()

  if (memberErr || !member) {
    return new Response(JSON.stringify({ error: 'No owner found for this restaurant' }), { status: 404, headers: corsHeaders })
  }

  // Get owner email from auth.users
  const { data: { user: ownerUser }, error: userErr } = await adminClient.auth.admin.getUserById(
    (member as { user_id: string }).user_id
  )

  if (userErr || !ownerUser?.email) {
    return new Response(JSON.stringify({ error: 'Could not look up owner account' }), { status: 500, headers: corsHeaders })
  }

  // Build the full redirect URL
  const origin = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'http://localhost:5173'
  const redirectTo = `${origin}${redirect_to}`

  // Generate a one-time magic link for the owner's account
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: ownerUser.email,
    options: { redirectTo },
  })

  if (linkErr || !(linkData as any)?.properties?.action_link) {
    return new Response(
      JSON.stringify({ error: linkErr?.message || 'Could not generate impersonation link' }),
      { status: 500, headers: corsHeaders }
    )
  }

  return new Response(
    JSON.stringify({ url: (linkData as any).properties.action_link }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
