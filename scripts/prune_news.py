#!/usr/bin/env python3
"""
Limpia news/news.json (las noticias cargadas a mano) sacando las que
ya son viejas, para que el archivo no crezca sin limite con el tiempo.

La pagina ya deja de MOSTRAR una noticia a los 7 dias (ver
CONFIG.newsMaxAgeDays en js/app.js) — esto es aparte: borra fisicamente
del archivo las que superen PRUNE_AFTER_DAYS, bastante mas alla de esos
7 dias, para no tocar por error nada que todavia pudiera importar.

Una noticia sin "date" (o con una fecha invalida) nunca se borra, igual
que en la pagina nunca deja de mostrarse.

Uso:
    python3 scripts/prune_news.py

Pensado para correr automaticamente via GitHub Action (ver
.github/workflows/prune-news.yml, semanal), pero se puede correr a
mano en cualquier momento.
"""
import json
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS_FILE = os.path.join(ROOT, "news", "news.json")
PRUNE_AFTER_DAYS = 30


def is_old(item):
    date_text = item.get("date") if isinstance(item, dict) else None
    if not date_text:
        return False
    try:
        published = datetime.strptime(date_text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    age_days = (datetime.now(timezone.utc) - published).days
    return age_days > PRUNE_AFTER_DAYS


def main():
    if not os.path.exists(NEWS_FILE):
        print(f"No existe {NEWS_FILE}, nada que limpiar.")
        return

    with open(NEWS_FILE, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    items = data if isinstance(data, list) else data.get("news", [])
    kept = [item for item in items if not is_old(item)]
    removed = len(items) - len(kept)

    if removed == 0:
        print("Sin noticias viejas para sacar de news.json.")
        return

    with open(NEWS_FILE, "w", encoding="utf-8") as fh:
        json.dump(kept, fh, ensure_ascii=False, indent=2)

    print(f"Se sacaron {removed} noticias de mas de {PRUNE_AFTER_DAYS} dias. Quedan {len(kept)}.")


if __name__ == "__main__":
    main()
