#!/usr/bin/env python3
"""
Busca fotos libres en Wikimedia Commons segun un grupo de keywords y
las agrega a backgrounds/external.json para que roten como fondo de la
transmision, con credito de atribucion (autor + licencia).

Usa la API publica de Wikimedia Commons (commons.wikimedia.org/w/api.php),
que no requiere API key ni registro - solo hace falta un User-Agent
descriptivo (ver USER_AGENT), como pide la etiqueta de uso de la API.

Las entradas que agrega este script se marcan con "source":
"wikimedia-auto" para poder distinguirlas de fondos externos cargados
a mano (ej. un video de sponsor en GitHub Releases): en cada corrida
se conservan tal cual las entradas manuales, y solo se regenera el
grupo "wikimedia-auto".

Uso:
    python3 scripts/generate_backgrounds_from_keywords.py

Pensado para correr automaticamente via GitHub Action (ver
.github/workflows/update-backgrounds-keywords.yml), pero se puede
correr a mano para probarlo o forzar una actualizacion.
"""
import html
import json
import os
import re
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
IMAGE_WIDTH = 1920  # ancho pedido para el thumbnail (se recorta solo si el original es mas chico)
API_URL = "https://commons.wikimedia.org/w/api.php"
VALID_MIME_PREFIXES = ("image/jpeg", "image/png", "image/webp")

# Wikimedia pide un User-Agent descriptivo con forma de contactar al
# operador del bot (ver https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy).
USER_AGENT = "wowhd-news-bot/1.0 (https://github.com/RocoWayne/wowhd-news)"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "backgrounds", "external.json")


def strip_html(text):
    """Los campos de extmetadata (Artist, LicenseShortName) vienen como
    HTML (a veces con links) - nos quedamos solo con el texto plano."""
    if not text:
        return ""
    return html.unescape(re.sub(r"<[^>]+>", "", text)).strip()


def fetch_keyword(query):
    params = urllib.parse.urlencode({
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": 6,  # namespace "File"
        "gsrlimit": IMAGES_PER_KEYWORD,
        "prop": "imageinfo",
        "iiprop": "url|size|mime|extmetadata",
        "iiurlwidth": IMAGE_WIDTH,
        "format": "json",
    })
    req = urllib.request.Request(
        f"{API_URL}?{params}",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read())

    pages = (data.get("query") or {}).get("pages") or {}
    entries = []
    for page in pages.values():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        mime = info.get("mime", "")
        if not mime.startswith(VALID_MIME_PREFIXES):
            continue  # nos salteamos SVG, PDF, audio, etc.

        width = info.get("width") or 0
        height = info.get("height") or 0
        if width and height and width < height:
            continue  # preferimos horizontal para fondo de pantalla

        url = info.get("thumburl") or info.get("url")
        if not url:
            continue

        meta = info.get("extmetadata") or {}
        artist = strip_html((meta.get("Artist") or {}).get("value")) or "Autor desconocido"
        license_name = strip_html((meta.get("LicenseShortName") or {}).get("value"))
        credit = f"Foto: {artist}" + (f" ({license_name})" if license_name else "") + " / Wikimedia Commons"

        entries.append({
            "url": url,
            "type": "image",
            "credit": credit,
            "source": "wikimedia-auto",
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
    fetched = []
    seen_urls = set()
    any_success = False

    for keyword in KEYWORDS:
        try:
            entries = fetch_keyword(keyword)
            if entries:
                any_success = True
            for entry in entries:
                if entry["url"] in seen_urls:
                    continue
                seen_urls.add(entry["url"])
                fetched.append(entry)
        except Exception as err:  # noqa: BLE001 - una keyword que falla no debe frenar a las demas
            print(f"[{keyword}] no se pudo buscar en Wikimedia Commons ({err}); se la saltea.", file=sys.stderr)

    if not any_success:
        print("Wikimedia Commons no devolvio resultados para ninguna keyword; se deja external.json como estaba.", file=sys.stderr)
        return

    existing = load_existing()
    manual_entries = [
        e for e in existing
        if not (isinstance(e, dict) and e.get("source") == "wikimedia-auto")
    ]

    combined = manual_entries + fetched
    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(combined, fh, ensure_ascii=False, indent=2)

    print(f"{len(fetched)} fotos de Wikimedia Commons ({len(manual_entries)} entradas manuales conservadas) escritas en {OUTPUT}")


if __name__ == "__main__":
    main()
