#!/bin/bash
# fix-trial-paywall.sh
# Ejecuta este script desde la raiz del repo para terminar de aplicar el
# fix del paywall trial-sin-tarjeta y los Stripe URLs nuevos.
#
# Uso:
#   chmod +x fix-trial-paywall.sh
#   ./fix-trial-paywall.sh
#
# Despues:
#   git add -A && git commit -m "fix(panel): paywall trial-sin-tarjeta"
#   git push
#   (merge a main via PR o directo)

set -e

echo "→ Actualizando Stripe URLs (fZu6oH... y 14A28rfz... → 9B6eVd...) en archivos pendientes..."
for f in registro.html auth-callback.html login.html; do
  if [ -f "$f" ]; then
    sed -i.bak 's/fZu6oH86A4xG42U7HB8AE07/9B6eVddqUd4c2YQfa38AE0c/g; s/14A28rfz2fckarifa38AE08/9B6eVddqUd4c2YQfa38AE0c/g' "$f"
    rm -f "${f}.bak"
    echo "   ✓ $f"
  else
    echo "   ⚠ $f no existe, saltado"
  fi
done

echo "→ Aplicando patch de panel.html (paywall por fecha_fin_prueba + tracking primer_login_at)..."
if git apply panel-fix.patch; then
  echo "   ✓ panel.html actualizado"
  git rm panel-fix.patch
  echo "   ✓ panel-fix.patch eliminado"
else
  echo "   ✗ Error aplicando panel-fix.patch. Revisar manualmente."
  exit 1
fi

echo "→ Eliminando este script (ya cumplio su funcion)..."
git rm fix-trial-paywall.sh

echo ""
echo "✅ Todo aplicado. Verificando que no quedan links viejos:"
if grep -rln 'fZu6oH86A4xG42U7HB8AE07\|14A28rfz2fckarifa38AE08' --include='*.html' --include='*.js' . 2>/dev/null; then
  echo "⚠️  Quedan links viejos arriba. Revisalos a mano."
else
  echo "✓ Sin links viejos."
fi

echo ""
echo "Siguiente paso (a mano):"
echo "  git add -A"
echo "  git commit -m 'fix(panel): paywall trial-sin-tarjeta + Stripe links 9B6eVd'"
echo "  git push"
echo "  (merge a main)"
