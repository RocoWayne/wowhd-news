#!/usr/bin/env python3
"""
Lee un grupo de RSS de noticias internacionales en castellano y genera
news/rss.json con las mas recientes de todos ellos combinadas, para
mostrarlas en la transmision sin tener que cargarlas a mano. Se
combina en la pagina con news/news.json (las noticias cargadas a
mano) sin pisarlo - son dos archivos separados.

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

# Grupo de RSS a combinar. Si alguno falla (caido, bloqueado, cambio de
# URL) se lo saltea sin afectar a los demas ni al archivo ya generado -
# ver main().
RSS_FEEDS = [
    "https://rss.dw.com/xml/rss-es-all",                # DW en Español
    "https://www.france24.com/es/rss",                  # France 24 en Español
    "https://feeds.bbci.co.uk/mundo/rss.xml",            # BBC Mundo
    "https://www.infobae.com/america/rss.xml",           # Infobae (America)
    "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada",  # El Pais Internacional
    "https://actualidad.rt.com/rss",                     # RT en Español
    "https://cnnespanol.cnn.com/feed/",                  # CNN en Español
    "https://es.euronews.com/rss?level=theme&name=news", # Euronews en Español
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "news", "rss.json")
MAX_ITEMS_PER_FEED = 12   # limite por feed, para que uno solo no acapare todo el archivo
MAX_TOTAL_ITEMS = 60      # limite total combinado

NS = {
    "content": "http://purl.org/rss/1.0/modules/content/",
    "media": "http://search.yahoo.com/mrss/",
    "atom": "http://www.w3.org/2005/Atom",
}

USER_AGENT = "Mozilla/5.0 (compatible; wowhd-news-bot/1.0; +https://github.com/)"


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
    """Convierte una fecha de RSS (RFC 822) o Atom (ISO 8601) a AAAA-MM-DD."""
    if not pub_date_text:
        return None
    try:
        dt = parsedate_to_datetime(pub_date_text)
    except (TypeError, ValueError):
        try:
            dt = ET_iso_to_datetime(pub_date_text)
        except (TypeError, ValueError):
            return None
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def ET_iso_to_datetime(text):
    # Atom suele usar ISO 8601 (ej. 2026-09-05T12:00:00Z)
    from datetime import datetime
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def parse_rss_items(root):
    return root.findall("./channel/item")


def parse_atom_entries(root):
    return root.findall("atom:entry", NS)


def item_fields(item, is_atom):
    """Normaliza un <item> RSS o <entry> Atom a (title, link, date, image, category)."""
    if is_atom:
        title_el = item.find("atom:title", NS)
        link_el = item.find("atom:link[@rel='alternate']", NS)
        if link_el is None:
            link_el = item.find("atom:link", NS)
        date_el = item.find("atom:published", NS)
        if date_el is None:
            date_el = item.find("atom:updated", NS)

        title = html.unescape(title_el.text.strip()) if title_el is not None and title_el.text else None
        link = link_el.get("href").strip() if link_el is not None and link_el.get("href") else None
        date_text = date_el.text.strip() if date_el is not None and date_el.text else None
        image = extract_image(item)
        category_el = item.find("atom:category", NS)
        category = html.unescape(category_el.get("term")) if category_el is not None and category_el.get("term") else None
        return title, link, date_text, image, category

    title_el = item.find("title")
    link_el = item.find("link")
    pubdate_el = item.find("pubDate")

    title = html.unescape(title_el.text.strip()) if title_el is not None and title_el.text else None
    link = link_el.text.strip() if link_el is not None and link_el.text else None
    date_text = pubdate_el.text if pubdate_el is not None else None
    image = extract_image(item)
    category = extract_category(item)
    return title, link, date_text, image, category


def fetch_feed(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.read()


def fetch_feed_items(url):
    """Descarga y parsea un feed (RSS 2.0 o Atom). Devuelve una lista de
    noticias ya normalizadas, o [] si el feed fallo por cualquier motivo
    (red, HTTP, XML invalido) - un feed roto no debe tirar abajo a los
    demas ni al archivo ya generado."""
    try:
        raw = fetch_feed(url)
        root = ET.fromstring(raw)
    except Exception as err:  # noqa: BLE001 - cualquier fallo de un feed puntual no debe frenar al resto
        print(f"[{url}] no se pudo leer/parsear ({err}); se lo saltea.", file=sys.stderr)
        return []

    items = parse_rss_items(root)
    is_atom = False
    if not items:
        items = parse_atom_entries(root)
        is_atom = True

    news = []
    for item in items[:MAX_ITEMS_PER_FEED]:
        title, link, date_text, image, category = item_fields(item, is_atom)
        if not title or not link:
            continue
        news.append({
            "date": format_date(date_text),
            "image": image,
            "category": category,
            "text": title,
            "link": link,
        })
    return news


def main():
    combined = []
    seen_links = set()
    any_success = False

    for url in RSS_FEEDS:
        items = fetch_feed_items(url)
        if items:
            any_success = True
        for item in items:
            if item["link"] in seen_links:
                continue
            seen_links.add(item["link"])
            combined.append(item)

    if not any_success:
        print("Ningun feed del grupo respondio; se deja news/rss.json como estaba.", file=sys.stderr)
        return

    # Mas recientes primero; las sin fecha (rara vez) quedan al final.
    combined.sort(key=lambda item: item["date"] or "", reverse=True)
    combined = combined[:MAX_TOTAL_ITEMS]

    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(combined, fh, ensure_ascii=False, indent=2)

    print(f"{len(combined)} noticias combinadas de {len(RSS_FEEDS)} feeds escritas en {OUTPUT}")


if __name__ == "__main__":
    main()
