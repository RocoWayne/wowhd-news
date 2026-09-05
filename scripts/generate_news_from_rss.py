#!/usr/bin/env python3
"""
Lee el RSS de laubfal.com y genera news/rss.json con las noticias mas
recientes del sitio, para mostrarlas en la transmision sin tener que
cargarlas a mano. Se combina en la pagina con news/news.json (las
noticias cargadas a mano) sin pisarlo — son dos archivos separados.

Uso:
    python3 scripts/generate_news_from_rss.py

Pensado para correr automaticamente via GitHub Action (ver
.github/workflows/update-news-rss.yml), pero se puede correr a mano
para probarlo o forzar una actualizacion.
"""
import html
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import timezone
from email.utils import parsedate_to_datetime

RSS_URL = "https://laubfal.com/feed/"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "news", "rss.json")
MAX_ITEMS = 15

NS = {
    "content": "http://purl.org/rss/1.0/modules/content/",
    "media": "http://search.yahoo.com/mrss/",
}


def extract_image(item):
    """Busca la imagen destacada del item: media:content, enclosure, o
    la primera <img> dentro del contenido completo del post."""
    media = item.find("media:content", NS)
    if media is not None and media.get("url"):
        return html.unescape(media.get("url"))

    enclosure = item.find("enclosure")
    if enclosure is not None and (enclosure.get("type") or "").startswith("image") and enclosure.get("url"):
        return html.unescape(enclosure.get("url"))

    content_el = item.find("content:encoded", NS)
    if content_el is not None and content_el.text:
        # El contenido viene dentro de un CDATA: las entidades HTML
        # (ej. "&#038;" en vez de "&") quedan como texto literal, el
        # parser XML no las decodifica solo porque CDATA es justamente
        # para no interpretar nada de eso.
        match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content_el.text)
        if match:
            return html.unescape(match.group(1))

    return None


def extract_category(item):
    """Devuelve la primera categoria "de verdad" del item (WordPress
    mezcla categorias y tags en <category>, distinguibles por el
    atributo domain="category" vs domain="post_tag"). Si no encuentra
    ninguna con ese atributo, usa la primera <category> que haya."""
    categories = item.findall("category")
    for cat in categories:
        if cat.get("domain") == "category" and cat.text:
            return html.unescape(cat.text.strip())
    for cat in categories:
        if cat.text:
            return html.unescape(cat.text.strip())
    return None


def format_date(pub_date_text):
    """Convierte el pubDate del RSS (formato RFC 822) a AAAA-MM-DD."""
    if not pub_date_text:
        return None
    try:
        dt = parsedate_to_datetime(pub_date_text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return None


def fetch_feed(url):
    req = urllib.request.Request(url, headers={"User-Agent": "laulive-news-bot/1.0"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.read()


def main():
    try:
        raw = fetch_feed(RSS_URL)
    except Exception as err:  # noqa: BLE001 - cualquier fallo de red no debe romper el archivo existente
        print(f"No se pudo leer el RSS ({err}); se deja news/rss.json como estaba.", file=sys.stderr)
        return

    try:
        root = ET.fromstring(raw)
    except ET.ParseError as err:
        print(f"El RSS no se pudo parsear ({err}); se deja news/rss.json como estaba.", file=sys.stderr)
        return

    items = root.findall("./channel/item")[:MAX_ITEMS]

    news = []
    for item in items:
        title_el = item.find("title")
        link_el = item.find("link")
        pubdate_el = item.find("pubDate")

        title = html.unescape(title_el.text.strip()) if title_el is not None and title_el.text else None
        link = link_el.text.strip() if link_el is not None and link_el.text else None
        if not title or not link:
            continue

        news.append({
            "date": format_date(pubdate_el.text if pubdate_el is not None else None),
            "image": extract_image(item),
            "category": extract_category(item),
            "text": title,
            "link": link,
        })

    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(news, fh, ensure_ascii=False, indent=2)

    print(f"{len(news)} noticias del RSS escritas en {OUTPUT}")


if __name__ == "__main__":
    main()
