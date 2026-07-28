# ⚠️ Las migraciones se aplican A MANO (no confíes en el workflow)

**Cómo aplicar una migración:** copiá el contenido del `.sql` y pegalo en
**Supabase → SQL Editor → Run**. Listo.

## Por qué a mano y no automático

El workflow `.github/workflows/supabase-migrations.yml` corre `supabase db push`,
pero **los archivos de esta carpeta NO tienen el prefijo de versión con fecha**
(`20260728120000_nombre.sql`) que la CLI de Supabase necesita para reconocerlos.
Resultado: `db push` **los ignora y sale "success" sin aplicar nada** — da un
falso OK. Por eso históricamente (ver CLAUDE.md) todo se aplicó a mano.

**No confíes en el check verde de ese workflow para dar una migración por
aplicada.** Verificá en la base (una consulta `SELECT` que compruebe la
tabla/columna/política) que de verdad quedó.

## Cómo verificar que una migración quedó aplicada

Ejemplos:
- Tabla nueva:  `SELECT to_regclass('public.mi_tabla');`  (no-null = existe)
- Vista nueva:  `SELECT to_regclass('public.mi_vista');`
- Política RLS: `SELECT policyname, qual FROM pg_policies WHERE tablename='mi_tabla';`

## Migraciones de seguridad recientes (julio 2026) — YA aplicadas a mano

- `rls_mensajes_admin_coach.sql` — cierra el chat admin↔coach (estaba abierto a public).
- `usuarios_publicos_view.sql` — vista pública del coach (sin secretos) para el directorio.
- `gcal_tokens_table.sql` — caja fuerte del token de Google (fuera de configuracion).

## Si algún día se quiere arreglar el workflow

Renombrar TODOS los `.sql` con prefijo `AAAAMMDDHHMMSS_` y correr una vez
`supabase migration repair --status applied <version>` para las ya aplicadas a
mano (si no, `db push` choca con "ya existe"). Es un trabajo aparte, con cuidado.
