import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, claims } = await req.json();

    if (!user_id || !claims) {
      return new Response(JSON.stringify({ claims }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to query database directly
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Query roles directly using SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_user_roles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ target_user_id: user_id }),
    });

    let roles = [];
    if (response.ok) {
      roles = await response.json();
    } else {
      console.error("Error fetching roles:", response.statusText);
    }

    // Add roles to claims
    const updatedClaims = {
      ...claims,
      roles: roles || [],
    };

    return new Response(JSON.stringify({ claims: updatedClaims }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Hook error:", error);
    // Return original claims on error to not block login
    return new Response(JSON.stringify({ claims: {} }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
