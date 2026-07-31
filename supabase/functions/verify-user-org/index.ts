// Phase 0 Week 1: Auth middleware - Verify JWT + org membership
// Edge Function: verify-user-org
// Purpose: Validate token and ensure user belongs to org_id

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors.headers });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const orgId = new URL(req.url).searchParams.get("org_id");

    if (!token || !orgId) {
      return new Response(
        JSON.stringify({ error: "Missing token or org_id" }),
        { status: 400, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify token & extract user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    // Check user belongs to org
    const { data: userData, error: queryError } = await supabase
      .from("usuarios")
      .select("id, org_id, rol")
      .eq("auth_id", user.id)
      .eq("org_id", orgId)
      .single();

    if (queryError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not in organization" }),
        { status: 403, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        verified: true,
        user_id: user.id,
        org_id: orgId,
        role: userData.rol,
      }),
      { status: 200, headers: { ...cors.headers, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-user-org error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...cors.headers, "Content-Type": "application/json" } }
    );
  }
});
