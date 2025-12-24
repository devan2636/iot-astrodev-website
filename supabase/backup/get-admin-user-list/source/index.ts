import { createClient } from 'npm:@supabase/supabase-js@2';
// Header CORS untuk mengizinkan panggilan dari frontend kamu
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};
console.log('Edge Function "get-admin-user-list" initializing.');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Received new request:', req.method);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase URL or Service Role Key is not configured in environment variables.');
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // --- Recommended: verify caller token and role ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.substring(7);

    // verify token -> get user
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = userData.user.id;
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (callerProfileError || !callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin')) {
      return new Response(JSON.stringify({ error: 'User not authorized to perform this action' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // ----------------------------------------------------------------

    console.log('Fetching users from auth.admin.listUsers...');
    const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
      console.error('Error listing auth users:', authError.message || authError);
      throw new Error(`Auth Error: ${authError.message || authError}`);
    }
    console.log(`Successfully fetched ${authUsersData.users.length} auth users.`);

    console.log('Fetching profiles from "profiles" table...');
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, email')
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError.message || profilesError);
      throw new Error(`Profiles Error: ${profilesError.message || profilesError}`);
    }
    console.log(`Successfully fetched ${profiles?.length || 0} profiles.`);

    const combinedUsers = authUsersData.users.map((authUser) => {
      const profile = profiles?.find((p) => p.id === authUser.id);
      return {
        id: authUser.id,
        email: authUser.email,
        email_confirmed_at: authUser.email_confirmed_at,
        created_at: authUser.created_at,
        profile: profile ? {
          username: profile.username,
          role: profile.role
        } : {
          username: null,
          role: null
        }
      };
    });

    console.log('Successfully combined user data.');
    // RETURN as object { users: [...] } so frontend matches expectation
    return new Response(JSON.stringify({ users: combinedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("Error in Edge Function (get-admin-user-list):", error?.message || error, error?.stack);
    return new Response(JSON.stringify({
      error: (error?.message) || String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});