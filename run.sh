#!/usr/bin/env bash
# Levanta el servidor HTTP local de MUNDO WOW 24/7 y abre un navegador
# ya listo para capturar en OBS (Fuentes -> Captura de ventana /
# Window Capture, NO Fuente de navegador) - pensado para correr todo
# en la misma PC que tiene OBS abierto, sin depender de ningún hosting
# externo. Funciona igual en cualquier rama del repo (main,
# foster-viajes, etc.) - no tiene nada específico de una rama.
#
# Uso:
#   ./run.sh              # puerto 8080 por defecto
#   PORT=9000 ./run.sh    # otro puerto
#
# Variables opcionales:
#   PORT      puerto del servidor local (default 8080)
#   BROWSER   binario a usar a la fuerza (ej. BROWSER=chromium ./run.sh)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8080}"
URL="http://localhost:${PORT}/index.html"
PROFILE_DIR="${TMPDIR:-/tmp}/wowhd-news-obs-profile"

SERVER_PID=""
STARTED_SERVER=0

cleanup() {
  if [[ "$STARTED_SERVER" == "1" && -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Si ya hay algo respondiendo en ese puerto (ej. una corrida anterior
# que quedó viva), lo reusamos en vez de fallar con "Address already
# in use" o levantar un segundo servidor innecesario.
server_is_up() {
  curl -s -o /dev/null --max-time 1 "$URL" 2>/dev/null
}

if server_is_up; then
  echo "Ya hay un servidor respondiendo en $URL - lo reuso (no arranco uno nuevo)."
else
  PYTHON_BIN="$(command -v python3 || command -v python || true)"
  if [[ -z "$PYTHON_BIN" ]]; then
    echo "No se encontró python3 ni python en el PATH. Instalalo e intentá de nuevo." >&2
    exit 1
  fi

  echo "Iniciando servidor local en $URL ..."
  "$PYTHON_BIN" -m http.server "$PORT" --directory "$DIR" >/tmp/wowhd-news-server.log 2>&1 &
  SERVER_PID=$!
  STARTED_SERVER=1

  # Esperar a que realmente responda antes de abrir el navegador (hasta ~6s).
  for _ in $(seq 1 20); do
    if server_is_up; then
      break
    fi
    sleep 0.3
  done

  if ! server_is_up; then
    echo "El servidor no llegó a responder. Revisá /tmp/wowhd-news-server.log" >&2
    exit 1
  fi
fi

# --app abre una ventana "pelada" (sin barra de direcciones ni
# pestañas) ideal para Captura de ventana en OBS. --autoplay-policy
# replica el mismo flag que usa internamente el Browser Source de OBS,
# para que la música arranque sola sin pedir ningún click (ver
# playWithAutoplayFallback en js/app.js, que de todos modos cubre el
# caso de que este flag no esté disponible). --user-data-dir usa un
# perfil aparte para no interferir con tu Chrome normal si ya lo
# tenés abierto con otras pestañas.
open_browser() {
  local bin="$1"
  "$bin" \
    --app="$URL" \
    --autoplay-policy=no-user-gesture-required \
    --user-data-dir="$PROFILE_DIR" \
    --window-size=1920,1080 \
    --new-window \
    >/dev/null 2>&1 &
  disown
}

pick_browser() {
  if [[ -n "${BROWSER:-}" ]] && command -v "$BROWSER" >/dev/null 2>&1; then
    echo "$BROWSER"
    return
  fi
  for candidate in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge; do
    if command -v "$candidate" >/dev/null 2>&1; then
      echo "$candidate"
      return
    fi
  done
  if [[ "$OSTYPE" == darwin* ]]; then
    for app in "Google Chrome" "Chromium" "Microsoft Edge"; do
      if [[ -d "/Applications/$app.app" ]]; then
        echo "/Applications/$app.app/Contents/MacOS/$app"
        return
      fi
    done
  fi
  echo ""
}

BROWSER_BIN="$(pick_browser)"

if [[ -n "$BROWSER_BIN" ]]; then
  echo "Abriendo $URL en modo app (Chrome/Chromium/Edge) ..."
  open_browser "$BROWSER_BIN"
else
  echo "No se encontró Chrome, Chromium ni Edge instalado."
  echo "Abrí manualmente esta URL en el navegador que prefieras: $URL"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif [[ "$OSTYPE" == darwin* ]]; then
    open "$URL"
  fi
fi

cat <<EOF

Listo.

En OBS: Fuentes -> botón "+" -> Captura de ventana (Window Capture)
-> elegí la ventana que se acaba de abrir.

(Si preferís seguir usando la Fuente de navegador normal de OBS en
vez de una ventana aparte, simplemente apuntala a $URL y no hace
falta este script - esto es para el caso de querer correrlo como una
ventana de navegador de verdad, capturada por OBS.)

Dejá esta terminal abierta: cerrarla también corta el servidor local.
Ctrl+C para cortar todo.
EOF

if [[ "$STARTED_SERVER" == "1" ]]; then
  wait "$SERVER_PID"
else
  echo "(servidor reusado de una corrida anterior - esta terminal no tiene nada más que esperar)"
fi
