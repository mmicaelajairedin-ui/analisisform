// Phase 0 Week 1: Lookup org_id from JWT
// Edge Function: get-user-org
// Purpose: Extract user's org_id from token without requiring org_id in request

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors.headers });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid token");

    // Get user's org_id
    const { data: userData, error: queryError } = await supabase
      .from("usuarios")
      .select("org_id, rol")
      .eq("auth_id", user.id)
      .single();

    if (queryError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...cors.headers, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        org_id: userData.org_id,
        role: userData.rol
      }),
      { status: 200, headers: { ...cors.headers, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("get-user-org error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...cors.headers, "Content-Type": "application/json" } }
    );
  }
});
