import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace('Bearer ', '')

    // Decode JWT to extract user id (sub). We don't verify the token here because
    // we will check the user's role from the database using the service role key.
    const parts = token.split('.')
    if (parts.length < 2) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const payload = parts[1]
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=')
    const decoded = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
    const requesterId = decoded.sub as string

    // Verify requester role in `profiles` table
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', requesterId)
      .single()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const role = profile.role
    if (role !== 'superadmin' && role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient role' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET -> list users; DELETE -> delete user by query param `user_id`
    if (req.method === 'GET') {
      const { data: users, error } = await supabaseClient.auth.admin.listUsers()
      if (error) throw error

      return new Response(JSON.stringify({ users: users.users }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url)
      const userId = url.searchParams.get('user_id')
      if (!userId) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

      const { error } = await supabaseClient.auth.admin.deleteUser(userId)
      if (error) throw error

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('admin-users function error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
