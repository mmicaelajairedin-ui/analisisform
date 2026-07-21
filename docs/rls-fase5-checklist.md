# Checklist — Encender RLS estricto en `usuarios` (Fase 5)

Objetivo: cerrar el último gap de seguridad (con la anon key pública cualquiera
puede leer/escribir `usuarios` → account takeover / bajar todos los emails), sin
romper el registro, el login, el intake ni el guardado del panel.

**Estado:** el código del frontend ya quedó preparado en la rama. Falta el
deploy + correr el SQL en el orden de abajo. **La RLS todavía NO está prendida**
(nada roto hoy).

## Qué se preparó en el código (ya commiteado)

| Cambio | Archivo | Qué resuelve |
|---|---|---|
| Registro compatible con RLS | `supabase/functions/registrar-coach/index.ts` (nuevo) + `registro.html` / `registro-en.html` | El POST anon con `rol='coach'` queda bloqueado por policy. El registro cae a esta edge function (service role, sanitiza campos) **solo si recibe 401/403**. Sin RLS, no se usa. |
| Guardado de config verificado | `panel-v2.html` (`saveCfg`) + `pw-auth.js` | Bajo RLS, si el JWT vence el guardado caía a anon → 0 filas → "guardado ✓" falso. Ahora sube el JWT (`usuarios` en el interceptor) y verifica que afectó ≥1 fila. |
| Hueco de la migración cerrado | `supabase/migrations/usuarios_hardening.sql` (`usuarios_self_insert`) | Ahora un autenticado no puede auto-insertarse `rol='admin'`. |

## Orden de rollout (seguir EXACTO)

1. **Mergear la rama a `main`** → Cloudflare despliega el frontend (registro, panel, pw-auth).
2. **Deployar las edge functions:**
   ```
   supabase functions deploy registrar-coach --no-verify-jwt
   supabase functions deploy stripe-webhook  --no-verify-jwt   # (por los fixes de Stripe de esta tanda)
   ```
3. **Verificar TODO con la RLS todavía APAGADA** (las policies nuevas están dormidas):
   - Registrar un coach nuevo por email → entra al panel.
   - Login coach + login cliente.
   - Activar un coach invitado.
   - Guardar config en el panel (marca, servicios, disponibilidad) → refrescar → persiste.
   - Alta de cliente por formulario + crear acceso de cliente desde el panel.
   - Directorio público de coaches (`coaches.html`).
4. **Correr el SQL:** `supabase/migrations/usuarios_hardening.sql` (trae su propio ROLLBACK al final).
5. **RE-verificar los MISMOS flujos del paso 3** ahora con la RLS PRENDIDA. Prestar atención a:
   - Registro nuevo (debe pasar por `registrar-coach` → cuenta creada).
   - Guardar config en el panel (debe seguir persistiendo; si dice "no se pudo guardar / sesión vencida", cerrar sesión y volver a entrar).
6. **Si algo falla:** rollback inmediato →
   ```sql
   ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
   ```
   (las policies quedan dormidas, como antes) y avisar para diagnosticar.

## Notas
- Las edge functions usan **service role** → bypassean RLS, no se ven afectadas.
- El `stripe-webhook` y `coach-lifecycle` siguen funcionando igual (service role).
- Anti-abuso del registro: sin cambios — la cuenta nace `email_verificado=false` y
  el panel bloquea las features caras (IA) hasta verificar el email.
