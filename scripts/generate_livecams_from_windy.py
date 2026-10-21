#!/usr/bin/env python3
"""
Busca camaras publicas de todo el mundo en la API de Windy Webcams
(api.windy.com/webcams) y las agrega a livecams/livecams.json para
que roten como fondo principal de la transmision (ver js/app.js ->
runLiveCamLoop), junto con las cargadas a mano (YouTube).

A diferencia de Wikimedia Commons (fotos libres, URL estable para
siempre), las imagenes de Windy vienen con un token firmado en la URL
que VENCE a los pocos minutos en el plan gratuito (Windy documenta
~10-15 min) - por eso esto NO se resuelve del lado del navegador (ahi
haria falta exponer la API key en el JS publico del sitio, visible
para cualquiera) sino aca, server-side, con la key guardada como
secret de GitHub. Para que la URL vigente le llegue al navegador antes
de que venza, este workflow tiene que correr seguido (cada 10 min,
igual que CONFIG.liveCamsRefreshMs en js/app.js). Si de todas formas
le toca el turno a una camara con el token ya vencido, el navegador la
saltea sola y prueba la siguiente de la lista (mismo mecanismo que
usa para una camara de YouTube caida) - no rompe nada, en el peor caso
esa camara puntual no se llega a ver esa vuelta.

Requiere la variable de entorno WINDY_API_KEY (se genera gratis en
https://api.windy.com/webcams/manage, pestaña "API Keys"). Sin ella,
el script no hace nada - no es un error, solo no hay key cargada
todavia.

Las entradas que agrega se marcan con "source": "windy-auto" y
"kind": "image", para distinguirlas de las entradas de YouTube
cargadas a mano (que no tienen "kind"): en cada corrida se conservan
tal cual las demas entradas, y solo se regenera el grupo
"windy-auto". Tambien se les agrega "place" (la ciudad de la webcam,
si la API la trae) para que scripts/generate_place_facts.py pueda
buscarles y cachearles un dato corto de Wikipedia, igual que con las
camaras de YouTube cargadas a mano.

ADVERTENCIA: la forma exacta de la respuesta de la API v3 de Windy
(nombres de campo dentro de "images"/"location") esta tomada de la
documentacion publica, pero no se pudo probar en vivo contra la API
real desde este entorno (sin acceso de red a windy.com). Si despues
de cargar una WINDY_API_KEY real el script no trae resultados o tira
un error de parseo, revisar la forma actual de la respuesta en
https://api.windy.com/webcams/docs y ajustar WEBCAM_INCLUDE /
_extract_image_url / _extract_location de este archivo.

Uso:
    WINDY_API_KEY=... python3 scripts/generate_livecams_from_windy.py

Pensado para correr automaticamente via GitHub Action (ver
.github/workflows/update-livecams-windy.yml), pero se puede correr a
mano para probarlo o forzar una actualizacion.
"""
import json
import os
import random
import sys
import urllib.error
import urllib.parse
import urllib.request

API_URL = "https://api.windy.com/webcams/api/v3/webcams"

# Que partes de cada webcam devuelve la API (ademas de los campos
# siempre presentes como title/webcamId) - ver advertencia arriba.
WEBCAM_INCLUDE = "images,location"

# Cuantas camaras traer por corrida. Windy limita el maximo por
# pagina en el plan gratuito; 50 es un numero conservador.
LIMIT = 50

# Igual que con Wikimedia Commons (ver generate_backgrounds_from_keywords.py):
# si la API devuelve siempre el mismo orden para los mismos parametros,
# arrancar en un offset al azar (en vez de siempre en 0) hace que
# corridas sucesivas traigan tandas distintas de camaras con el tiempo.
OFFSET_WINDOW = 200

USER_AGENT = "wowhd-news-bot/1.0 (https://github.com/RocoWayne/wowhd-news)"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "livecams", "livecams.json")


def fetch_webcams(api_key):
    params = urllib.parse.urlencode({
        "limit": LIMIT,
        "offset": random.randint(0, OFFSET_WINDOW),
        "include": WEBCAM_INCLUDE,
    })
    req = urllib.request.Request(
        f"{API_URL}?{params}",
        headers={"User-Agent": USER_AGENT, "x-windy-api-key": api_key},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read())


def extract_image_url(webcam):
    """La imagen "actual" de la webcam, en la mejor resolucion
    disponible. La forma exacta de "images" no esta 100% confirmada
    (ver advertencia al principio del archivo) - se prueban varias
    rutas conocidas de la documentacion antes de descartar la webcam."""
    images = webcam.get("images") or {}
    current = images.get("current") or {}
    for key in ("preview", "thumbnail", "icon"):
        url = current.get(key)
        if url:
            return url
    sizes = images.get("sizes") or {}
    for key in ("preview", "thumbnail", "icon"):
        url = sizes.get(key)
        if url:
            return url
    return None


def extract_title(webcam):
    title = (webcam.get("title") or "").strip()
    location = webcam.get("location") or {}
    city = (location.get("city") or "").strip()
    country = (location.get("country") or "").strip()
    place = ", ".join(p for p in (city, country) if p)
    if title and place:
        return f"{title} ({place})"
    return title or place or "Cámara pública (Windy)"


def extract_place(webcam):
    """Nombre de lugar a usar como clave para el cache de datos
    (ver scripts/generate_place_facts.py) - la ciudad si esta
    disponible (mas probable que tenga articulo propio en Wikipedia
    que el titulo puntual de la webcam), si no el titulo tal cual."""
    location = webcam.get("location") or {}
    city = (location.get("city") or "").strip()
    if city:
        return city
    return (webcam.get("title") or "").strip() or None


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
    api_key = os.environ.get("WINDY_API_KEY")
    if not api_key:
        print("WINDY_API_KEY no esta configurada; se saltea esta corrida (no es un error).", file=sys.stderr)
        return

    try:
        data = fetch_webcams(api_key)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as err:
        print(f"No se pudo consultar la API de Windy ({err}); se deja livecams.json como estaba.", file=sys.stderr)
        return
    except json.JSONDecodeError as err:
        print(f"La API de Windy devolvio algo que no es JSON valido ({err}); se deja livecams.json como estaba.", file=sys.stderr)
        return

    webcams = data.get("webcams") or []
    fetched = []
    for webcam in webcams:
        url = extract_image_url(webcam)
        if not url:
            continue  # sin ninguna imagen utilizable: se saltea esta webcam puntual
        entry = {
            "title": extract_title(webcam),
            "url": url,
            "kind": "image",
            "source": "windy-auto",
        }
        place = extract_place(webcam)
        if place:
            entry["place"] = place
        fetched.append(entry)

    if not fetched:
        print("Windy no devolvio ninguna webcam utilizable en esta corrida; se deja livecams.json como estaba.", file=sys.stderr)
        return

    existing = load_existing()
    manual_entries = [
        e for e in existing
        if not (isinstance(e, dict) and e.get("source") == "windy-auto")
    ]

    combined = manual_entries + fetched
    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(combined, fh, ensure_ascii=False, indent=2)

    print(f"{len(fetched)} camaras de Windy ({len(manual_entries)} entradas manuales/YouTube conservadas) escritas en {OUTPUT}")


if __name__ == "__main__":
    main()
