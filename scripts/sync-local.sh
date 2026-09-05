#!/usr/bin/env bash
# Sincroniza la copia local del repo con GitHub (git pull) para que la
# PC que corre OBS reciba solo los cambios que se suben por GitHub
# (musica, fondos, noticias, y los playlist.json que regenera el
# Action). Pensado para correr cada 2-3 minutos via cron.
#
# Uso (una vez, para probarlo a mano):
#   bash scripts/sync-local.sh
#
# Para automatizarlo con cron (Mac/Linux), editar el crontab:
#   crontab -e
# y agregar una linea (ajustar la ruta a donde clonaste el repo):
#   */2 * * * * /usr/bin/bash /ruta/a/laulive/scripts/sync-local.sh

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

LOG_FILE="sync-local.log"

{
  echo "--- $(date) ---"
  git pull --ff-only
} >> "$LOG_FILE" 2>&1
