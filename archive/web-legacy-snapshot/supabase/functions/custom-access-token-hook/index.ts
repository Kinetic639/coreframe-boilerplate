import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, claims } = await req.json();

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user roles
    const { data: roleData, error } = await supabase
      .from("user_role_assignments")
      .select(
        `
        role_id,
        scope,
        scope_id,
        roles!inner (
          id,
          name
        )
      `
      )
      .eq("user_id", user_id)
      .is("deleted_at", null)
      .is("roles.deleted_at", null);

    if (error) {
      console.error("Error fetching roles:", error);
      // Return original claims if error occurs
      return new Response(JSON.stringify({ claims }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Format roles for JWT
    const roles =
      roleData?.map((assignment) => ({
        role_id: assignment.role_id,
        role: assignment.roles.name,
        scope: assignment.scope,
        org_id: assignment.scope === "org" ? assignment.scope_id : null,
        branch_id: assignment.scope === "branch" ? assignment.scope_id : null,
      })) || [];

    // Add roles to claims
    const updatedClaims = {
      ...claims,
      roles: roles,
    };

    return new Response(JSON.stringify({ claims: updatedClaims }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Hook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
