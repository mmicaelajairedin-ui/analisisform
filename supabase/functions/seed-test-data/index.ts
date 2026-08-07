// Supabase Edge Function: /functions/v1/seed-test-data
// Deploy: supabase functions deploy seed-test-data --no-verify-jwt
// Call: POST to this function to generate 6 test scenarios

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok");
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Scenario 1: Org sin coaches
    await supabase.from("organizaciones").insert({
      id: "sce-1-no-coaches",
      nombre: "Org Sin Coaches",
      owner_id: "owner-1",
    });

    await supabase.from("usuarios").insert({
      org_id: "sce-1-no-coaches",
      nombre: "Owner",
      email: "owner@sce1.test",
      rol: "owner",
      activo: true,
    });

    // Scenario 2: Un coach
    await supabase.from("organizaciones").insert({
      id: "sce-2-one-coach",
      nombre: "Org Un Coach",
      owner_id: "owner-2",
    });

    await supabase.from("usuarios").insert([
      {
        org_id: "sce-2-one-coach",
        nombre: "Owner",
        email: "owner@sce2.test",
        rol: "owner",
        activo: true,
        last_seen: new Date().toISOString(),
      },
      {
        org_id: "sce-2-one-coach",
        nombre: "Pedro",
        email: "pedro@sce2.test",
        rol: "coach",
        activo: true,
        last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ]);

    // Scenario 3: Varios coaches
    await supabase.from("organizaciones").insert({
      id: "sce-3-multi-coach",
      nombre: "Org Multi Coach",
      owner_id: "owner-3",
    });

    await supabase.from("usuarios").insert([
      {
        org_id: "sce-3-multi-coach",
        nombre: "Owner",
        email: "owner@sce3.test",
        rol: "owner",
        activo: true,
        last_seen: new Date().toISOString(),
      },
      {
        org_id: "sce-3-multi-coach",
        nombre: "Ana",
        email: "ana@sce3.test",
        rol: "coach",
        activo: true,
        last_seen: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      },
      {
        org_id: "sce-3-multi-coach",
        nombre: "Carlos",
        email: "carlos@sce3.test",
        rol: "coach",
        activo: true,
        last_seen: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      },
      {
        org_id: "sce-3-multi-coach",
        nombre: "María",
        email: "maria@sce3.test",
        rol: "coach",
        activo: true,
        last_seen: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
    ]);

    // Scenario 4: Clientes inactivos
    await supabase.from("organizaciones").insert({
      id: "sce-4-inactive-clients",
      nombre: "Org Clientes Inactivos",
      owner_id: "owner-4",
    });

    await supabase.from("usuarios").insert({
      org_id: "sce-4-inactive-clients",
      nombre: "Coach",
      email: "coach@sce4.test",
      rol: "coach",
      activo: true,
      last_seen: new Date().toISOString(),
    });

    await supabase.from("candidatos").insert([
      {
        org_id: "sce-4-inactive-clients",
        nombre: "Cliente Inactivo 1",
        email: "c1@sce4.test",
        activo: true,
        cliente_last_seen: new Date(
          Date.now() - 15 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
      {
        org_id: "sce-4-inactive-clients",
        nombre: "Cliente Inactivo 2",
        email: "c2@sce4.test",
        activo: true,
        cliente_last_seen: new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
      {
        org_id: "sce-4-inactive-clients",
        nombre: "Cliente Activo",
        email: "c3@sce4.test",
        activo: true,
        cliente_last_seen: new Date(
          Date.now() - 2 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    ]);

    // Scenario 5: Sin sesiones hoy
    await supabase.from("organizaciones").insert({
      id: "sce-5-no-sessions",
      nombre: "Org Sin Sesiones Hoy",
      owner_id: "owner-5",
    });

    await supabase.from("usuarios").insert({
      org_id: "sce-5-no-sessions",
      nombre: "Coach",
      email: "coach@sce5.test",
      rol: "coach",
      activo: true,
      last_seen: new Date().toISOString(),
    });

    await supabase.from("candidatos").insert({
      org_id: "sce-5-no-sessions",
      nombre: "Cliente",
      email: "client@sce5.test",
      activo: true,
    });

    // Scenario 6: Múltiples alertas
    await supabase.from("organizaciones").insert({
      id: "sce-6-multi-alerts",
      nombre: "Org Multi Alertas",
      owner_id: "owner-6",
    });

    await supabase.from("usuarios").insert([
      {
        org_id: "sce-6-multi-alerts",
        nombre: "Coach Inactivo 1",
        email: "c1@sce6.test",
        rol: "coach",
        activo: true,
        last_seen: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
      {
        org_id: "sce-6-multi-alerts",
        nombre: "Coach Inactivo 2",
        email: "c2@sce6.test",
        rol: "coach",
        activo: true,
        last_seen: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      },
      {
        org_id: "sce-6-multi-alerts",
        nombre: "Coach Activo",
        email: "c3@sce6.test",
        rol: "coach",
        activo: true,
        last_seen: new Date().toISOString(),
      },
    ]);

    await supabase.from("candidatos").insert([
      {
        org_id: "sce-6-multi-alerts",
        nombre: "Cliente Sin Sesión 1",
        email: "cl1@sce6.test",
        activo: true,
        cliente_last_seen: new Date(
          Date.now() - 20 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
      {
        org_id: "sce-6-multi-alerts",
        nombre: "Cliente Sin Sesión 2",
        email: "cl2@sce6.test",
        activo: true,
        cliente_last_seen: new Date(
          Date.now() - 25 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    ]);

    return new Response(
      JSON.stringify({
        status: "success",
        message: "6 test scenarios created successfully",
        scenarios: [
          "sce-1-no-coaches",
          "sce-2-one-coach",
          "sce-3-multi-coach",
          "sce-4-inactive-clients",
          "sce-5-no-sessions",
          "sce-6-multi-alerts",
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
