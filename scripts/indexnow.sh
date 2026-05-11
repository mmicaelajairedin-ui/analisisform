#!/usr/bin/env bash
# IndexNow — avisa a Bing + Yandex (+ otros que adopten el protocolo)
# cuando publicas o actualizas contenido. Re-crawl en minutos en vez de dias.
#
# Uso:
#   ./scripts/indexnow.sh https://pathwaycareercoach.com/articulo-nuevo.html
#   ./scripts/indexnow.sh url1 url2 url3 ...
#
# Limit: max 10000 URLs por request (no vamos a llegar nunca).

set -euo pipefail

KEY="2a9bd9412f59247286c1a65afa6640c7"
HOST="pathwaycareercoach.com"
KEY_LOCATION="https://${HOST}/${KEY}.txt"
ENDPOINT="https://api.indexnow.org/indexnow"

if [ "$#" -eq 0 ]; then
  echo "Uso: $0 <url1> [<url2> ...]"
  echo "Ejemplo: $0 https://${HOST}/articulo-nuevo.html"
  exit 1
fi

# Validar que todas las URLs apunten al host correcto
for url in "$@"; do
  case "$url" in
    "https://${HOST}/"*) ;;
    *)
      echo "Error: '$url' no pertenece a https://${HOST}/"
      exit 1
      ;;
  esac
done

# Armar JSON urlList
url_list=$(printf '"%s",' "$@" | sed 's/,$//')

payload=$(cat <<EOF
{
  "host": "${HOST}",
  "key": "${KEY}",
  "keyLocation": "${KEY_LOCATION}",
  "urlList": [${url_list}]
}
EOF
)

response=$(curl -sS -w "\n%{http_code}" -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "User-Agent: pathway-indexnow/1.0" \
  -d "${payload}")

status=$(echo "${response}" | tail -n1)
body=$(echo "${response}" | sed '$d')

case "${status}" in
  200|202)
    echo "OK - ${#} URL(s) enviadas a IndexNow (HTTP ${status})"
    ;;
  400)
    echo "Error 400 (bad request): ${body}"
    exit 1
    ;;
  403)
    echo "Error 403 (key no valida): verifica que ${KEY_LOCATION} sirva el archivo con el contenido '${KEY}'"
    exit 1
    ;;
  422)
    echo "Error 422 (urls invalidas o host no coincide): ${body}"
    exit 1
    ;;
  429)
    echo "Error 429 (rate limited): esperar unos minutos y reintentar"
    exit 1
    ;;
  *)
    echo "Error HTTP ${status}: ${body}"
    exit 1
    ;;
esac
