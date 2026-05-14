// @ts-nocheck — Deno edge function; URL imports resolved by Supabase runtime

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM = `You are a helpful support assistant for Mise, a restaurant management SaaS platform.
You help restaurant owners and staff understand how to use the Mise platform.

Key features of Mise:
- **Menu**: Create categories and items with names, descriptions, prices, and images. Toggle items available/unavailable. Import from CSV.
- **Orders**: View real-time incoming orders. Manage stages: new → preparing → ready → served → completed. Filter by date. Export to CSV.
- **Kitchen display**: A full-screen board showing live orders — designed for kitchen staff.
- **Tables**: Create tables and generate QR codes. Guests scan to view the menu and order from their phone.
- **AI Guest Assistant**: A chatbot your guests can use to ask menu questions. Customize its tone, language, and restrictions from the Assistant page.
- **Plans**: Create meal plans or combo deals for guests to choose from.
- **Overview**: Dashboard with today's key metrics — orders, revenue, and activity.
- **Support**: Contact the Mise team via tickets. Topics: Billing, Technical issue, Menu help, Account & access, Other.
- **Settings**: Edit restaurant name, tagline, currency, and toggle accepting orders on/off.

Guidelines:
- Be concise, friendly, and practical — 2–4 sentences unless a step-by-step answer is needed.
- For billing questions or account suspension, advise the owner to open a support ticket with the Mise team.
- If you are not sure about something specific to their account, suggest opening a support ticket.
- Do not invent pricing, SLA times, or contractual terms.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let messages: { role: 'user' | 'assistant'; content: string }[]
  try {
    const body = await req.json()
    messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('invalid')
  } catch {
    return new Response(JSON.stringify({ error: 'messages array required' }), { status: 400, headers: corsHeaders })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: corsHeaders })
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM,
      messages,
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return new Response(JSON.stringify({ error: err }), { status: 502, headers: corsHeaders })
  }

  const data = await resp.json()
  const text: string = data.content?.[0]?.text ?? ''

  return new Response(JSON.stringify({ text }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
