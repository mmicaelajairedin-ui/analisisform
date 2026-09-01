#!/usr/bin/env bash
# Fidelidad del volcado de las migraciones que estaban aplicadas en produccion
# y no existian como fichero en ningun repositorio.
#
# De las 30 aplicadas desde el 2026-08-27, TRES ya estaban versionadas por el
# frente G2 —20260831103005, 20260831110641 y 20260831110653— y NO se tocan.
# Sus ficheros son un superconjunto deliberado de lo aplicado: llevan la nota
# «Aplicada en produccion» y el de `pw_cita_meet_link` ademas consolida el
# REVOKE de seguimiento (20260831110723). Por eso su md5 NO coincide con el de
# `schema_migrations`, y esa diferencia es intencionada, no deriva.
#
# Este script comprueba las 27 restantes, que son las recuperadas aqui.
#
# Cada linea es <version> <md5> <nombre>, tal y como los devolvio
# supabase_migrations.schema_migrations del proyecto de Pathway el 2026-09-01.
# El md5 es el de statements[1] EXACTO, sin salto de linea final — por eso los
# ficheros tampoco lo llevan: asi el md5 del fichero es comparable directamente.
#
#   bash scripts/verificar-migraciones-volcadas.sh
set -uo pipefail
cd "$(dirname "$0")/../supabase/migrations" || exit 1

ESPERADO=$(cat <<'LISTA'
20260827125447 d665976c1b45d382eb252545a8ae3c2c f1_1_citas_rls_pw_coach_id
20260827125554 d00e9b7a4e0dfd435602592c0542c746 d4_pw_email_search_path
20260827125612 7c9edf7a6f078bcc6f01df334e93769f f1_2_citas_cliente_select
20260827125634 df6f68459c07b22250370171e7265106 f1_3_busy_slots_dm_pw_helpers
20260827125757 660c045e57340e365288c683e6663a60 f2_1_org_publica_slug
20260827130248 299f1fbaa191625d60b596b59f6cb815 f2_3_cierre_sesiones_registro
20260827133253 deef8866e895150851a3af0f3824a367 a1_org_marca_propia
20260827133406 405b6ea326f47628f59fc4e8a8bcc332 a1_org_marca_propia_revoke_anon
20260827134858 9a9cad457934f198de5f0d8642dfe197 f2_3_cierre_organizaciones
20260827135025 04f2b5e082dcd06c5978297b5e712e9c f2_3b_owner_policies_solo_authenticated
20260828082604 349a41af9bb667a8feff805191ce116f fase1_crear_cita_campos_y_coach_activo
20260830104747 c616688d24efa79300a229284890ad0f fase1b_crear_cita_meet_link_derivado
20260830105143 c25ff8a6fb112079836699701825027e fase1c_crear_cita_zoom_debe_ser_sala
20260831110723 2b592d75c08a36c0e1e6b6afc21ccb52 g2c_pw_cita_meet_link_revoke_anon
20260831113814 675d9b298793220fd0cb0f869b639fc1 p0_c2c_prospectos_cierra_lectura_anon
20260831113830 e4ff50bcd89528c3f6fe13ed7a4b0483 p0_c3a_ranking_mensual_rls_y_revoke_escrituras_anon
20260831113841 dec1392f0e6b283b2013764b1990e0bf p0_c3b_pw_add_month_pts_search_path
20260831114709 f091d5b1cf97821d8ba9a6d336cfce25 fase3_reprogramar_cita_contrato_completo
20260901085316 612f2e4400d7ca79d1149bac9f948b24 p0_c3b2_search_path_get_coach_dms
20260901085335 bab9cb40d6a950ec665e6a0952ad303c p0_c3b3_search_path_notify_nuevo_contacto
20260901085341 b7693beea0b7cbce99fa10ef890c1cdd p0_c3b4_search_path_pw_notify_new_client
20260901095604 6f41247fa118b3b13cbe41d7734e9343 inc_a_pw_sala_contexto
20260901095922 af546079721ed338908922c4b28dcee9 n2_get_proxima_cita_exige_identidad
20260901100122 987abf28e84896648b3a7cf95c5e247c c1_cierre_citas_anon_y_vista
20260901102020 1c35c9c6d301134a40180fc818425472 c4bis_pw_cita_fijar_video
20260901102805 39a91965e5708973cc34c245b5e27476 c4_revocar_update_delete_anon_citas
20260901104533 c793d8bb2fcedc615ae49b8fdd2bc607 incb_sesiones_registro_rls_lectura_minima
LISTA
)

ok=0; fallos=0; n=0
while read -r version md5 nombre; do
  [ -z "$version" ] && continue
  n=$((n+1))
  f="${version}_${nombre}.sql"
  if [ ! -f "$f" ]; then
    echo "  FALTA   $f"; fallos=$((fallos+1)); continue
  fi
  g=$(md5sum "$f" | cut -d' ' -f1)
  if [ "$g" = "$md5" ]; then
    ok=$((ok+1))
  else
    echo "  DIFIERE $f"; echo "          base=$md5  fichero=$g"; fallos=$((fallos+1))
  fi
done <<< "$ESPERADO"

echo
echo "  esperadas: $n   fieles: $ok   fallos: $fallos"

# Las tres de G2 solo se comprueban por EXISTENCIA: su contenido es un
# superconjunto a proposito y compararlo por md5 daria un rojo enganoso.
faltag2=0
for g2 in 20260831103005_g2_pw_franjas_ocupadas \
          20260831110641_g2a_pw_sala_coach \
          20260831110653_g2c_pw_cita_meet_link; do
  [ -f "$g2.sql" ] || { echo "  FALTA (G2) $g2.sql"; faltag2=$((faltag2+1)); }
done
echo "  ya versionadas por G2, presentes: $((3-faltag2))/3"

[ "$fallos" -eq 0 ] && [ "$ok" -eq 27 ] && [ "$faltag2" -eq 0 ] \
  && { echo "  27/27 byte a byte contra schema_migrations · 30/30 versiones cubiertas"; exit 0; }
exit 1
