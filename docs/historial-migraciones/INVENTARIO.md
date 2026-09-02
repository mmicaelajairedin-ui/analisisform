# Inventario congelado — historial de migraciones

**Fecha:** 2026-09-02 · **Proyecto:** `ddxnrsnjdvtqhxunxnwj` · **main:** `1fc0ee97`
**Método:** solo lectura (catálogos + `ls`/`grep` + logs de CI). Cero escrituras.

## Resumen

| Magnitud | Valor |
|---|---|
| Ficheros en `supabase/migrations/` | 161 `.sql` + 1 `.md` |
| Visibles para la CLI (prefijo numérico) | 45 |
| Invisibles para la CLI (sin prefijo) | 116 |
| Entradas en `schema_migrations` | 43 |
| MATCH (versión remota con fichero local) | 4 |
| REMOTE-ONLY (bloquean `db push`) | 39 |
| LOCAL-ONLY visibles a la CLI | 41 |
| Versiones locales duplicadas | 9 (22 ficheros) |
| SQL total guardado en el remoto | 74.964 bytes |

## Procedencia (metadata de `schema_migrations`)

Columnas disponibles: `version, statements, name, created_by, idempotency_key, rollback`.

| created_by | n | idempotency_key | rollback |
|---|---|---|---|
| `mmicaela.jairedin@gmail.com` | 42 | 0 | 0 |
| `(null)` | 1 (`0099`) | 0 | 0 |

Las 42 se aplicaron desde una superficie autenticada de Supabase con esa cuenta,
no desde CI. Ninguna guarda rollback ni clave de idempotencia.

## Estado del export a Git

| | |
|---|---|
| Mecanismo | `encode(convert_to(array_to_string(statements,E'\n'),'UTF8'),'base64')` → `base64 -d` |
| Fidelidad | Verificada byte a byte: `0099` exportó 1.479 bytes = 1.479 en origen |
| Exportadas | **12 de 39** en `remote-only/` |
| Pendientes | **27** |

## C. Matriz REMOTE → LOCAL (43 entradas, sin inferencias por nombre)

| # | REMOTE VERSION | nombre remoto | fichero local | estado | export |
|---|---|---|---|---|---|
| 1 | `0099` | citas_org_id | `0099_citas_org_id.sql` | **MATCH** | no aplica (ya en Git) |
| 2 | `20260824111800` | mc_novedades_capa_editorial | — | **REMOTE-ONLY** | PENDIENTE |
| 3 | `20260824112044` | mc_identidad_rol_resuelto | — | **REMOTE-ONLY** | PENDIENTE |
| 4 | `20260824112118` | mc_verificacion_rls | — | **REMOTE-ONLY** | PENDIENTE |
| 5 | `20260824112146` | mc_verificacion_cron | — | **REMOTE-ONLY** | PENDIENTE |
| 6 | `20260824112222` | mc_retirar_andamio_verificacion | — | **REMOTE-ONLY** | PENDIENTE |
| 7 | `20260824123847` | mc_novedades_privilegios_minimos | — | **REMOTE-ONLY** | PENDIENTE |
| 8 | `20260824123923` | mc_novedades_quitar_maintain | — | **REMOTE-ONLY** | PENDIENTE |
| 9 | `20260824123939` | mc_verificacion_acl | — | **REMOTE-ONLY** | PENDIENTE |
| 10 | `20260824124739` | mc_verificar_acl_bateria | — | **REMOTE-ONLY** | PENDIENTE |
| 11 | `20260824124819` | mc_verificar_cron_tras_acl | — | **REMOTE-ONLY** | PENDIENTE |
| 12 | `20260824125052` | mc_retirar_andamio_acl | — | **REMOTE-ONLY** | PENDIENTE |
| 13 | `20260824125120` | mc_retirar_andamio_verificacion_restos | — | **REMOTE-ONLY** | PENDIENTE |
| 14 | `20260827125447` | f1_1_citas_rls_pw_coach_id | — | **REMOTE-ONLY** | PENDIENTE |
| 15 | `20260827125554` | d4_pw_email_search_path | — | **REMOTE-ONLY** | PENDIENTE |
| 16 | `20260827125612` | f1_2_citas_cliente_select | — | **REMOTE-ONLY** | PENDIENTE |
| 17 | `20260827125634` | f1_3_busy_slots_dm_pw_helpers | — | **REMOTE-ONLY** | PENDIENTE |
| 18 | `20260827125757` | f2_1_org_publica_slug | — | **REMOTE-ONLY** | PENDIENTE |
| 19 | `20260827130248` | f2_3_cierre_sesiones_registro | — | **REMOTE-ONLY** | PENDIENTE |
| 20 | `20260827133253` | a1_org_marca_propia | — | **REMOTE-ONLY** | PENDIENTE |
| 21 | `20260827133406` | a1_org_marca_propia_revoke_anon | — | **REMOTE-ONLY** | PENDIENTE |
| 22 | `20260827134858` | f2_3_cierre_organizaciones | — | **REMOTE-ONLY** | PENDIENTE |
| 23 | `20260827135025` | f2_3b_owner_policies_solo_authenticated | — | **REMOTE-ONLY** | PENDIENTE |
| 24 | `20260828082604` | fase1_crear_cita_campos_y_coach_activo | — | **REMOTE-ONLY** | PENDIENTE |
| 25 | `20260830104747` | fase1b_crear_cita_meet_link_derivado | — | **REMOTE-ONLY** | PENDIENTE |
| 26 | `20260830105143` | fase1c_crear_cita_zoom_debe_ser_sala | — | **REMOTE-ONLY** | PENDIENTE |
| 27 | `20260831103005` | g2_pw_franjas_ocupadas | `20260831103005_g2_pw_franjas_ocupadas.sql` | **MATCH** | no aplica (ya en Git) |
| 28 | `20260831110641` | g2a_pw_sala_coach | `20260831110641_g2a_pw_sala_coach.sql` | **MATCH** | no aplica (ya en Git) |
| 29 | `20260831110653` | g2c_pw_cita_meet_link | `20260831110653_g2c_pw_cita_meet_link.sql` | **MATCH** | no aplica (ya en Git) |
| 30 | `20260831110723` | g2c_pw_cita_meet_link_revoke_anon | — | **REMOTE-ONLY** | PENDIENTE |
| 31 | `20260831113814` | p0_c2c_prospectos_cierra_lectura_anon | — | **REMOTE-ONLY** | PENDIENTE |
| 32 | `20260831113830` | p0_c3a_ranking_mensual_rls_y_revoke_escrituras_anon | — | **REMOTE-ONLY** | PENDIENTE |
| 33 | `20260831113841` | p0_c3b_pw_add_month_pts_search_path | — | **REMOTE-ONLY** | PENDIENTE |
| 34 | `20260831114709` | fase3_reprogramar_cita_contrato_completo | — | **REMOTE-ONLY** | PENDIENTE |
| 35 | `20260901085316` | p0_c3b2_search_path_get_coach_dms | — | **REMOTE-ONLY** | PENDIENTE |
| 36 | `20260901085335` | p0_c3b3_search_path_notify_nuevo_contacto | — | **REMOTE-ONLY** | PENDIENTE |
| 37 | `20260901085341` | p0_c3b4_search_path_pw_notify_new_client | — | **REMOTE-ONLY** | PENDIENTE |
| 38 | `20260901095604` | inc_a_pw_sala_contexto | — | **REMOTE-ONLY** | PENDIENTE |
| 39 | `20260901095922` | n2_get_proxima_cita_exige_identidad | — | **REMOTE-ONLY** | PENDIENTE |
| 40 | `20260901100122` | c1_cierre_citas_anon_y_vista | — | **REMOTE-ONLY** | PENDIENTE |
| 41 | `20260901102020` | c4bis_pw_cita_fijar_video | — | **REMOTE-ONLY** | PENDIENTE |
| 42 | `20260901102805` | c4_revocar_update_delete_anon_citas | — | **REMOTE-ONLY** | PENDIENTE |
| 43 | `20260901104533` | incb_sesiones_registro_rls_lectura_minima | — | **REMOTE-ONLY** | PENDIENTE |

## D. LOCAL-ONLY visibles para la CLI (41) — replay pendiente si se repara el historial

| versión | fichero | riesgo |
|---|---|---|
| `001` | `001_organizations.sql` | esquema abandonado (`organizations` NO existe en produccion) |
| `002` | `002_usuarios_extend.sql` | esquema abandonado (`organizations` NO existe en produccion) |
| `003` | `003_coach_client_assignments.sql` | esquema abandonado (`organizations` NO existe en produccion) |
| `004` | `004_candidatos_files.sql` | esquema abandonado (`organizations` NO existe en produccion) · **version duplicada (x2)** |
| `004` | `004_organizations_billing.sql` | esquema abandonado (`organizations` NO existe en produccion) · **version duplicada (x2)** |
| `005` | `005_organization_branding.sql` | esquema abandonado (`organizations` NO existe en produccion) |
| `006` | `006_audit_logs.sql` | esquema abandonado (`organizations` NO existe en produccion) |
| `007` | `007_rls_policies.sql` | esquema abandonado (`organizations` NO existe en produccion) |
| `008` | `008_seed_test_data.sql` | **SEED PELIGROSO — nunca debe ejecutarse en produccion** |
| `0100` | `0100_citas_rls_network.sql` | revisar |
| `0101` | `0101_citas_owner_rls.sql` | revisar · **version duplicada (x2)** |
| `0101` | `0101_usuarios_rol_en_org.sql` | revisar · **version duplicada (x2)** |
| `0102` | `0102_citas_anon_select.sql` | revisar · **version duplicada (x3)** |
| `0102` | `0102_coach_client_assignments.sql` | revisar · **version duplicada (x3)** |
| `0102` | `0102_programs_table.sql` | revisar · **version duplicada (x3)** |
| `0103` | `0103_citas_anon_read.sql` | revisar · **version duplicada (x5)** |
| `0103` | `0103_citas_grant_anon.sql` | revisar · **version duplicada (x5)** |
| `0103` | `0103_multicoach_policy_enforce.sql` | revisar · **version duplicada (x5)** |
| `0103` | `0103_rls_organizations.sql` | revisar · **version duplicada (x5)** |
| `0103` | `0103_seed_test_coach.sql` | **SEED PELIGROSO — nunca debe ejecutarse en produccion** · **version duplicada (x5)** |
| `0104` | `0104_reviews_sequence_grant.sql` | revisar · **version duplicada (x2)** |
| `0104` | `0104_rls_usuarios_org.sql` | revisar · **version duplicada (x2)** |
| `0105` | `0105_coaches_linkedin.sql` | revisar · **version duplicada (x2)** |
| `0105` | `0105_rls_candidatos_org.sql` | revisar · **version duplicada (x2)** |
| `0106` | `0106_coaches_remove_linkedin.sql` | revisar · **version duplicada (x2)** |
| `0106` | `0106_rls_assignments.sql` | revisar · **version duplicada (x2)** |
| `0107` | `0107_organizaciones_owner_id.sql` | revisar |
| `0108` | `0108_candidatos_review_fields.sql` | revisar · **version duplicada (x2)** |
| `0108` | `0108_rls_candidatos_owner_update.sql` | revisar · **version duplicada (x2)** |
| `0109` | `0109_colaborador_permisos.sql` | revisar |
| `0110` | `0110_programs_grant_perms.sql` | revisar · **version duplicada (x2)** |
| `0110` | `0110_semana_activa.sql` | revisar · **version duplicada (x2)** |
| `0111` | `0111_candidatos_write_policies.sql` | revisar |
| `0112` | `0112_candidatos_foto_perfil.sql` | revisar |
| `0113` | `0113_unify_foto_url.sql` | **UPDATE masivo sobre `usuarios`** |
| `0120` | `0120_reviews_table.sql` | revisar |
| `0200` | `0200_organization_branding_update.sql` | revisar |
| `0201` | `0201_organization_branding_rls_fix.sql` | revisar |
| `20260803` | `20260803_identity_platform_core.sql` | revisar |
| `20260901154255` | `20260901154255_c2a_cv_express_borrado_solo_admin.sql` | C-2a — en main, NO en historial remoto |
| `20260902104446` | `20260902104446_p0_usuarios_publicos_solo_lectura.sql` | P0 usuarios_publicos — en main, NO aplicada |

## E. Versiones locales duplicadas (9 versiones, 22 ficheros)

| versión | ficheros |
|---|---|
| `004` | `004_candidatos_files.sql` `004_organizations_billing.sql` |
| `0101` | `0101_citas_owner_rls.sql` `0101_usuarios_rol_en_org.sql` |
| `0102` | `0102_citas_anon_select.sql` `0102_coach_client_assignments.sql` · `0102_programs_table.sql` |
| `0103` | `0103_citas_anon_read.sql` `0103_citas_grant_anon.sql` · `0103_multicoach_policy_enforce.sql`·`0103_rls_organizations.sql` `0103_seed_test_coach.sql` |
| `0104` | `0104_reviews_sequence_grant.sql` `0104_rls_usuarios_org.sql` |
| `0105` | `0105_coaches_linkedin.sql` `0105_rls_candidatos_org.sql` |
| `0106` | `0106_coaches_remove_linkedin.sql` `0106_rls_assignments.sql` |
| `0108` | `0108_candidatos_review_fields.sql` `0108_rls_candidatos_owner_update.sql` |
| `0110` | `0110_programs_grant_perms.sql` `0110_semana_activa.sql` |

## F. LOCAL-ONLY invisibles para la CLI (116, sin prefijo numerico)

La CLI nunca las ha visto ni las vera con su nombre actual. Incluyen toda la capa
de seguridad de `usuarios` auditada en el P0 de `usuarios_publicos`:

- `usuarios_hardening.sql`
- `usuarios_rls_insert.sql`
- `usuarios_publicos_view.sql`
- `rls_strict.sql`
- `usuarios_protect_password.sql`
- `usuarios_gamif_grant.sql`
- `rls_cleanup_open_policies.sql`
- `auth_id_on_usuarios.sql`

(listado completo: `ls supabase/migrations/*.sql | grep -v "^[0-9]"`)

---

## G. Cierre del P0 `usuarios_publicos` (2026-09-02)

La remediación `20260902104446_p0_usuarios_publicos_solo_lectura.sql` **se aplicó
manualmente por la propietaria del proyecto mediante el SQL Editor de Supabase**,
por la vía excepcional documentada en `supabase/migrations/_LEEME-IMPORTANTE.md`,
porque `supabase db push` está bloqueado (ver §B de este inventario).

Verificado después por catálogo, solo lectura:

- `anon` y `authenticated`: conservan SELECT; sin INSERT/UPDATE/DELETE/TRUNCATE/
  REFERENCES/TRIGGER sobre `public.usuarios_publicos`.
- `pg_default_acl` de `postgres` sobre `public`: `anon=r`, `authenticated=r`.
  `postgres` y `service_role` intactos. La entrada de `supabase_admin` queda como
  limitación conocida, fuera del alcance de E1.
- Definición de la vista sin cambios (13 columnas, `is_updatable=YES` — el cierre
  es por privilegio, no por cambiar la forma de la vista).
- RLS y las 11 policies de `usuarios` sin cambios. INC-075 e INC-076 siguen abiertos.
- Los 5 consumidores SELECT intactos. Guardrail en verde.

**VEREDICTO: P0 usuarios_publicos = MITIGADO EN PRODUCCION.**

`20260902104446` **NO figura en `supabase_migrations.schema_migrations`**, que es
la consecuencia esperada de una aplicación manual. **NO debe corregirse con
`migration repair`**: el historial se reconcilia como unidad independiente.

Mitigado en produccion NO es lo mismo que historial reconciliado.
