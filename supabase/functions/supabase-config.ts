// ===================================================================
// supabase-config.ts — Configuración centralizada de Supabase
// para arquitectura híbrida (Auth + Usuarios en proyecto antiguo,
// Datos en proyecto nuevo).
//
// Uso:
//   import { SB } from "./supabase-config.ts";
//   await fetch(`${SB.AUTH}/auth/v1/user`, { headers: { apikey: ANON } });
//   await fetch(`${SB.USERS}/rest/v1/usuarios`, { headers: svc });
//   await fetch(`${SB.DATA}/rest/v1/citas`, { headers: svc });
// ===================================================================

export const SB = {
  // Proyecto ANTIGUO: autenticación + usuarios
  AUTH: Deno.env.get("SUPABASE_AUTH_URL") || Deno.env.get("SUPABASE_URL") || "",
  USERS: Deno.env.get("SUPABASE_USERS_URL") || Deno.env.get("SUPABASE_URL") || "",

  // Proyecto NUEVO: datos (citas, sesiones, etc.)
  DATA: Deno.env.get("SUPABASE_DATA_URL") || Deno.env.get("SUPABASE_URL") || "",
};

// Fallback: si no está configurado, todas apuntan a SUPABASE_URL (compatibilidad hacia atrás).
export function validate(): boolean {
  return !!(SB.AUTH && SB.USERS && SB.DATA);
}
