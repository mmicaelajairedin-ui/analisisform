#!/bin/bash
set -e

echo "🧪 TEST: Comparar Proxy vs Directo en Supabase"
echo "=============================================="
echo ""

# ── Paso 1: Deployar la function ──
echo "📦 Paso 1: Desplegando test-supabase-url..."
supabase functions deploy test-supabase-url --no-verify-jwt
echo "✅ Deployed"
echo ""

# ── Paso 2: Esperar 5s para que esté lista ──
echo "⏳ Esperando 5s a que la función esté lista..."
sleep 5
echo ""

# ── Paso 3: Ejecutar el test ──
echo "🚀 Paso 2: Ejecutando test..."
echo ""
echo "URL: https://api.pathwaycareercoach.com/functions/v1/test-supabase-url"
echo ""

RESPONSE=$(curl -s "https://api.pathwaycareercoach.com/functions/v1/test-supabase-url")

echo "📋 RESPUESTA COMPLETA DEL TEST:"
echo "================================"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""
echo "================================"
echo ""

# ── Paso 4: Analizar resultados ──
echo "📊 ANÁLISIS:"
echo ""

PROXY_STATUS=$(echo "$RESPONSE" | jq -r '.proxy.status' 2>/dev/null || echo "error")
DIRECT_STATUS=$(echo "$RESPONSE" | jq -r '.direct.status' 2>/dev/null || echo "error")

echo "Proxy (api.pathwaycareercoach.com):"
if [ "$PROXY_STATUS" == "200" ]; then
  echo "  ✅ Status: 200 OK"
  echo "  Response: $(echo "$RESPONSE" | jq -r '.proxy.response' 2>/dev/null | head -c 100)..."
elif [ "$PROXY_STATUS" == "403" ]; then
  echo "  ❌ Status: 403 Forbidden"
  echo "  Error: $(echo "$RESPONSE" | jq -r '.proxy.error' 2>/dev/null)"
else
  echo "  ⚠️ Status: $PROXY_STATUS"
  echo "  Error: $(echo "$RESPONSE" | jq -r '.proxy.error' 2>/dev/null)"
fi
echo ""

echo "Direct (ddxnrsnjdvtqhxunxbwj.supabase.co):"
if [ "$DIRECT_STATUS" == "200" ]; then
  echo "  ✅ Status: 200 OK"
  echo "  Response: $(echo "$RESPONSE" | jq -r '.direct.response' 2>/dev/null | head -c 100)..."
elif [ "$DIRECT_STATUS" == "403" ]; then
  echo "  ❌ Status: 403 Forbidden"
  echo "  Error: $(echo "$RESPONSE" | jq -r '.direct.error' 2>/dev/null)"
else
  echo "  ⚠️ Status: $DIRECT_STATUS"
  echo "  Error: $(echo "$RESPONSE" | jq -r '.direct.error' 2>/dev/null)"
fi
echo ""

# ── Paso 5: Conclusión ──
echo "🎯 CONCLUSIÓN:"
echo ""

if [ "$PROXY_STATUS" == "403" ] && [ "$DIRECT_STATUS" == "200" ]; then
  echo "✅ CONFIRMADO: El proxy devuelve 403, el directo funciona (200)"
  echo "   → Cambiar SUPABASE_URL es la solución correcta"
  echo ""
  echo "SIGUIENTE PASO: Aprueba el cambio del secret y ejecuta smoke tests"
elif [ "$PROXY_STATUS" == "200" ] && [ "$DIRECT_STATUS" == "200" ]; then
  echo "⚠️ AMBOS FUNCIONAN: Proxy y directo devuelven 200"
  echo "   → El problema NO es el proxy (revisar RLS o permisos)"
elif [ "$PROXY_STATUS" == "403" ] && [ "$DIRECT_STATUS" == "403" ]; then
  echo "❌ AMBOS FALLAN: Proxy y directo devuelven 403"
  echo "   → El problema es RLS, permisos o API key (no el proxy)"
else
  echo "❓ INCONCLUSO: Ver respuesta completa arriba"
fi
echo ""

# ── Paso 6: Guardar respuesta para referencia ──
echo "📁 Guardando respuesta en: test-supabase-url-result.json"
echo "$RESPONSE" | jq . > test-supabase-url-result.json 2>/dev/null || echo "$RESPONSE" > test-supabase-url-result.json
echo "✅ Guardado"
echo ""

echo "✨ Test completado"
