// ===================================================================
// supabase-config.ts — Configuración centralizada de Supabase
// para arquitectura híbrida (Auth + Usuarios en proyecto antiguo,
// Datos en proyecto nuevo).
//
// CRÍTICO: Las 3 URLs DEBEN estar configuradas como Secrets en Supabase.
// No hay fallback silencioso — si faltan, la función falla visiblemente.
//
// Uso:
//   import { SB } from "./supabase-config.ts";
//   await fetch(`${SB.AUTH}/auth/v1/user`, { headers: { apikey: ANON } });
//   await fetch(`${SB.USERS}/rest/v1/usuarios`, { headers: svc });
//   await fetch(`${SB.DATA}/rest/v1/citas`, { headers: svc });
//
// Configuración requerida (Supabase → Edge Functions → Secrets):
//   SUPABASE_AUTH_URL = https://mxkljqhlwiqavbjfjfov.supabase.co (proyecto antiguo)
//   SUPABASE_USERS_URL = https://mxkljqhlwiqavbjfjfov.supabase.co (proyecto antiguo)
//   SUPABASE_DATA_URL = https://ddxnrsnjdvtqhxunxnwj.supabase.co (proyecto nuevo)
// ===================================================================

const AUTH = Deno.env.get("AUTH_URL");
const USERS = Deno.env.get("USERS_URL");
const DATA = Deno.env.get("DATA_URL");

// Validación obligatoria — sin fallback silencioso.
if (!AUTH) {
  throw new Error(
    "Missing required environment variable: AUTH_URL\n" +
    "This is the old Supabase project URL for authentication and users.\n" +
    "Configure it in Supabase → Edge Functions → Secrets as 'AUTH_URL'"
  );
}
if (!USERS) {
  throw new Error(
    "Missing required environment variable: USERS_URL\n" +
    "This is the old Supabase project URL for usuarios and candidatos tables.\n" +
    "Configure it in Supabase → Edge Functions → Secrets as 'USERS_URL'"
  );
}
if (!DATA) {
  throw new Error(
    "Missing required environment variable: DATA_URL\n" +
    "This is the new Supabase project URL for citas and other data.\n" +
    "Configure it in Supabase → Edge Functions → Secrets as 'DATA_URL'"
  );
}

export const SB = {
  AUTH: AUTH!,
  USERS: USERS!,
  DATA: DATA!,
};

export function validate(): boolean {
  return !!(SB.AUTH && SB.USERS && SB.DATA);
}
