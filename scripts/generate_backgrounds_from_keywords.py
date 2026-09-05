#!/usr/bin/env python3
"""
Busca fotos gratuitas en Pexels segun un grupo de keywords y las agrega
a backgrounds/external.json para que roten como fondo de la
transmision, con credito de atribucion al fotografo.

Requiere una API key gratuita de Pexels (https://www.pexels.com/api/)
puesta en la variable de entorno PEXELS_API_KEY. Sin esa key, el
script no hace nada (no rompe ni vacia el archivo).

Las entradas que agrega este script se marcan con "source":
"pexels-auto" para poder distinguirlas de fondos externos cargados a
mano (ej. un video de sponsor en GitHub Releases): en cada corrida se
conservan tal cual las entradas manuales, y solo se regenera el grupo
"pexels-auto".

Uso:
    PEXELS_API_KEY=xxxx python3 scripts/generate_backgrounds_from_keywords.py

Pensado para correr automaticamente via GitHub Action (ver
.github/workflows/update-backgrounds-keywords.yml), pero se puede
correr a mano para probarlo o forzar una actualizacion.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

# Keywords genericas de noticias/entretenimiento, acorde al contenido
# de MUNDO WOW 24/7. Se pueden agregar/sacar libremente.
KEYWORDS = [
    "news studio",
    "television broadcast",
    "entertainment lights",
    "red carpet event",
    "concert crowd",
]

IMAGES_PER_KEYWORD = 3
API_URL = "https://api.pexels.com/v1/search"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "backgrounds", "external.json")


def fetch_keyword(api_key, query):
    params = f"query={urllib.parse.quote(query)}&per_page={IMAGES_PER_KEYWORD}&orientation=landscape"
    req = urllib.request.Request(
        f"{API_URL}?{params}",
        headers={"Authorization": api_key, "User-Agent": "wowhd-news-bot/1.0"},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read())

    entries = []
    for photo in data.get("photos", []):
        src = photo.get("src", {})
        url = src.get("large2x") or src.get("large") or src.get("original")
        photographer = photo.get("photographer") or "Autor desconocido"
        if not url:
            continue
        entries.append({
            "url": url,
            "type": "image",
            "credit": f"Foto: {photographer} / Pexels",
            "source": "pexels-auto",
        })
    return entries


def load_existing():
    if not os.path.exists(OUTPUT):
        return []
    try:
        with open(OUTPUT, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else data.get("items", [])


def main():
    api_key = os.environ.get("PEXELS_API_KEY", "").strip()
    if not api_key:
        print("PEXELS_API_KEY no esta configurada; no se busca nada nuevo.", file=sys.stderr)
        return

    fetched = []
    any_success = False
    for keyword in KEYWORDS:
        try:
            entries = fetch_keyword(api_key, keyword)
            if entries:
                any_success = True
            fetched.extend(entries)
        except Exception as err:  # noqa: BLE001 - una keyword que falla no debe frenar a las demas
            print(f"[{keyword}] no se pudo buscar en Pexels ({err}); se la saltea.", file=sys.stderr)

    if not any_success:
        print("Pexels no devolvio resultados para ninguna keyword; se deja external.json como estaba.", file=sys.stderr)
        return

    existing = load_existing()
    manual_entries = [
        e for e in existing
        if not (isinstance(e, dict) and e.get("source") == "pexels-auto")
    ]

    combined = manual_entries + fetched
    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(combined, fh, ensure_ascii=False, indent=2)

    print(f"{len(fetched)} fotos de Pexels ({len(manual_entries)} entradas manuales conservadas) escritas en {OUTPUT}")


if __name__ == "__main__":
    main()
