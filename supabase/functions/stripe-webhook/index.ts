// Webhook de Stripe: actualiza plan_tipo cuando se completa un pago
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Solo POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    const event = JSON.parse(body);

    console.log(`Webhook recibido: ${event.type}`);

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const items = subscription.items.data || [];

      if (items.length === 0) {
        return new Response("No items in subscription", { status: 400 });
      }

      // Determinar qué plan es (por el product ID)
      let planTipo = null;
      const productId = items[0].price.product;

      // Mapeo de Stripe product IDs a planes
      const productToPlans: Record<string, string> = {
        "prod_studio": "studio",
        "prod_pro": "pro",
      };

      planTipo = productToPlans[productId];

      if (!planTipo) {
        console.log(`Producto desconocido: ${productId}`);
        return new Response("Unknown product", { status: 400 });
      }

      // Buscar usuario por customer ID
      const client = createClient(supabaseUrl, supabaseKey);

      let usuario = await client
        .from("usuarios")
        .select("id, email")
        .eq("stripe_customer_id", customerId)
        .single()
        .catch(() => null);

      // Si no, intentar por email
      if (!usuario && subscription.customer_email) {
        usuario = await client
          .from("usuarios")
          .select("id, email")
          .eq("email", subscription.customer_email)
          .single()
          .catch(() => null);
      }

      if (!usuario || !usuario.data) {
        console.log(`Usuario no encontrado para customer ${customerId}`);
        return new Response("User not found", { status: 404 });
      }

      const userId = usuario.data.id;

      // Actualizar plan_tipo
      const { error } = await client
        .from("usuarios")
        .update({
          plan_tipo: planTipo,
          plan_changed_at: new Date().toISOString(),
          stripe_customer_id: customerId,
        })
        .eq("id", userId);

      if (error) {
        console.error("Error updating user:", error);
        return new Response(`Error updating user: ${error.message}`, {
          status: 500,
        });
      }

      console.log(`Usuario ${userId} actualizado a plan ${planTipo}`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Otros eventos se ignoran
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
