# Pathway Error Report — 30 Jul 2026

**Total:** 90 errores nuevos reportados. **Estado:** 1 fijo, 1-2 críticos pendientes resolución en Supabase.

## Fixed Issues ✅

### 25× SyntaxError en multicoach.html (~1535)
- **Root cause:** `mcLoadReal(u)` devolvía Promise sin ser await/manejada en `mcBoot()`
- **Síntoma:** Cuando mi-red fallaba con error 500, `r.json()` lanzaba SyntaxError "Unexpected token '<'"
- **Fix:** Agregado `.catch()` en llamada a `mcLoadReal()`
- **Commit:** `d21fa0f`
- **Status:** ✅ RESUELTO

## Critical Issues (Pending Supabase Actions) 🔴

### 44× http_500 en PATCH /rest/v1/usuarios (coachBeat heartbeat)
### 12× http_500 en GET /rest/v1/informes (fit-cliente)
### 2× http_500 en GET /rest/v1/usuarios

**Root cause:** Migraciones SQL no reaplicadas en Supabase:
- `usuarios_gamif_grant.sql` — GRANT de UPDATE (last_seen, game_pts, game_medal) y SELECT a anon/authenticated
- `notificaciones.sql` — Políticas RLS para anon y authenticated

**Action required (Micaela o admin con acceso Supabase):**

1. **Open Supabase Console**
   - Go to Project → SQL Editor

2. **Execute both migrations (idempotent, safe to re-run):**
   ```
   FROM: supabase/migrations/usuarios_gamif_grant.sql
   FROM: supabase/migrations/notificaciones.sql
   ```

3. **Verify execution:**
   - No errors in Supabase logs
   - Check console.log in browser network tab

4. **Monitor recovery:**
   ```sql
   SELECT ts, kind, email, page, detail 
   FROM client_errors 
   WHERE kind='http_500' AND ts > now() - interval '30 min'
   ORDER BY ts DESC;
   ```
   Should show 0 new http_500 errors after ~2 min

**Coaches affected:** 
- hi@pathwaycareercoach.com
- talento@axonimpact.com
- gonzaloalcalde97@gmail.com

---

## Minor Issues

### 3× Promise "not implemented" (login.html)
- Unknown edge function not deployed
- Check if `generar-informe` or `migrate-user-to-auth` functions exist in Supabase

### 1× neterror in POST /functions/v1/mi-red
- Transient network error, not actionable
- Re-runs will self-heal

### 1× http_401 in panel-v2.html PATCH usuarios
- Auth token expired for one coach
- Self-heals with token refresh

---

## Architecture Notes

**Why these errors happen:**
- Multi-coach migration (0101-0103) added new RLS policies
- New migrations may not auto-apply to existing Supabase projects
- `usuarios_gamif_grant.sql` and `notificaciones.sql` must be manually executed in SQL Editor

**Why they're caught:**
- `pw-observe.js` intercepts fetch errors and logs to `client_errors` table
- `check-guardrails.js` verifies these migrations exist (but not that they're applied)

**Future prevention:**
- Automate Supabase migrations (via CI/CD or manual checklist)
- Add health check endpoint that tests GRANT permissions
- Document post-deploy Supabase actions in DEPLOYMENT.md

---

## Files Changed This Session

```
multicoach.html — +1 line: .catch() on mcLoadReal promise
```

**Branch:** `claude/multicoach-pathway-errors-jwfkks`  
**Commit:** `d21fa0f` (fix: agregar .catch() a mcLoadReal)
