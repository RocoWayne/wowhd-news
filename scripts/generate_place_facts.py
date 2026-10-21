#!/usr/bin/env python3
"""
Busca un dato corto (resumen de Wikipedia en español) sobre cada lugar
distinto que aparezca en livecams/livecams.json ("place" de cada
cámara) y lo guarda en un JSON por lugar, dentro de facts/, para que
js/app.js lo muestre como "Sobre este lugar" debajo del nombre de la
cámara en pantalla.

El punto central pedido por el usuario: "a medida que sumemos cámaras
de diferentes lugares, que vaya buscando y guardando datos de ese
lugar para evitar consultas innecesarias" - por eso esto es un CACHE
que nunca vuelve a consultar un lugar que ya tiene su archivo
guardado. Dos cámaras del mismo lugar (ej. dos ángulos distintos del
Obelisco) comparten un solo archivo y una sola consulta.

Usa la API pública de Wikipedia en español (es.wikipedia.org/api/rest_v1),
que no requiere API key ni registro - solo un User-Agent descriptivo,
como pide la politica de uso de la API (igual que con Wikimedia
Commons en generate_backgrounds_from_keywords.py).

Solo se cachean consultas EXITOSAS: si un lugar no tiene artículo en
Wikipedia (o falla la consulta puntual), no se guarda nada para ese
lugar - así se reintenta solo en la próxima corrida, en vez de quedar
"cacheado como vacío" para siempre. Si el "place" de una cámara está
mal escrito, corregirlo en livecams.json alcanza para que se reintente.

Uso:
    python3 scripts/generate_place_facts.py

Pensado para correr automáticamente vía GitHub Action (ver
.github/workflows/update-place-facts.yml, disparado cuando cambia
livecams/livecams.json), pero se puede correr a mano para probarlo o
forzar una búsqueda.
"""
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

API_URL = "https://es.wikipedia.org/api/rest_v1/page/summary/"
USER_AGENT = "wowhd-news-bot/1.0 (https://github.com/RocoWayne/wowhd-news)"

# Tope de caracteres del resumen que se guarda - un parrafo entero de
# Wikipedia es demasiado para un cartel en pantalla; se corta en el
# punto final mas cercano a este largo (o directo en este largo si no
# hay ninguno antes).
MAX_EXTRACT_CHARS = 280

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVECAMS_PATH = os.path.join(ROOT, "livecams", "livecams.json")
FACTS_DIR = os.path.join(ROOT, "facts")


def slugify(place):
    """Mismo algoritmo que slugifyPlace() en js/app.js - tienen que
    coincidir para que el navegador encuentre el archivo que este
    script generó."""
    normalized = unicodedata.normalize("NFKD", place)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")
    return slug or "lugar"


def load_places():
    if not os.path.exists(LIVECAMS_PATH):
        return []
    with open(LIVECAMS_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    places = []
    seen = set()
    for entry in data:
        place = (entry.get("place") or "").strip()
        if place and place not in seen:
            seen.add(place)
            places.append(place)
    return places


def truncate_extract(text):
    text = " ".join(text.split())  # colapsa saltos de linea/espacios repetidos
    if len(text) <= MAX_EXTRACT_CHARS:
        return text
    cut = text[:MAX_EXTRACT_CHARS]
    last_period = cut.rfind(". ")
    if last_period > 40:  # evita cortes ridiculamente cortos
        return cut[: last_period + 1]
    return cut.rstrip() + "…"


def fetch_summary(place):
    url = API_URL + urllib.parse.quote(place.replace(" ", "_"))
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read())


def main():
    places = load_places()
    if not places:
        print("No hay cámaras con \"place\" en livecams.json; nada para buscar.", file=sys.stderr)
        return

    os.makedirs(FACTS_DIR, exist_ok=True)

    fetched = 0
    cached = 0
    failed = 0

    for place in places:
        path = os.path.join(FACTS_DIR, f"{slugify(place)}.json")
        if os.path.exists(path):
            cached += 1
            continue  # ya tenemos el dato de este lugar - no volver a consultar

        try:
            summary = fetch_summary(place)
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as err:
            print(f"[{place}] no se pudo obtener el resumen de Wikipedia ({err}); se reintenta en la próxima corrida.", file=sys.stderr)
            failed += 1
            continue

        extract = (summary.get("extract") or "").strip()
        if not extract or summary.get("type") == "disambiguation":
            print(f"[{place}] Wikipedia no devolvió un resumen utilizable; se reintenta en la próxima corrida.", file=sys.stderr)
            failed += 1
            continue

        page_url = ((summary.get("content_urls") or {}).get("desktop") or {}).get("page", "")
        data = {
            "place": place,
            "extract": truncate_extract(extract),
            "sourceTitle": summary.get("title") or place,
            "sourceUrl": page_url,
        }
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
        fetched += 1

    print(f"{fetched} lugares nuevos buscados, {cached} ya estaban cacheados, {failed} fallaron (se reintentan después).")


if __name__ == "__main__":
    main()
