#!/usr/bin/env python3
"""
Escanea la carpeta /music y actualiza music/playlist.json.

Nombra los archivos nuevos como "Artista - Titulo.mp3" para que el
título y artista se detecten solos (si no, se usa el nombre del
archivo completo como título). Muchos bancos de música libre nombran
al revés ("Titulo - Artista"): en ese caso corregí el título/artista
a mano en playlist.json una vez generado.

Este script NUNCA pisa una entrada que ya exista en playlist.json
(así no se pierden las correcciones manuales al volver a correrlo):
solo agrega los archivos nuevos que encuentra en /music y saca del
listado los que ya no están.

Uso:
    python3 scripts/generate_playlist.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSIC_DIR = os.path.join(ROOT, "music")
OUTPUT = os.path.join(MUSIC_DIR, "playlist.json")
VALID_EXT = {".mp3", ".m4a", ".ogg", ".wav", ".flac"}


def parse_title(filename):
    base, _ = os.path.splitext(filename)
    if " - " in base:
        artist, title = base.split(" - ", 1)
        return artist.strip(), title.strip()
    return "", base.strip()


def load_existing():
    if not os.path.exists(OUTPUT):
        return {}
    try:
        with open(OUTPUT, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (json.JSONDecodeError, OSError):
        return {}
    tracks = data if isinstance(data, list) else data.get("tracks", [])
    return {t["file"]: t for t in tracks if isinstance(t, dict) and t.get("file")}


def main():
    if not os.path.isdir(MUSIC_DIR):
        print(f"No existe la carpeta {MUSIC_DIR}")
        return

    files = sorted(
        f for f in os.listdir(MUSIC_DIR)
        if os.path.splitext(f)[1].lower() in VALID_EXT
    )

    existing = load_existing()
    added, kept = 0, 0
    tracks = []
    for f in files:
        if f in existing:
            tracks.append(existing[f])
            kept += 1
        else:
            artist, title = parse_title(f)
            tracks.append({"file": f, "title": title, "artist": artist})
            added += 1

    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(tracks, fh, ensure_ascii=False, indent=2)

    removed = len(existing) - kept
    print(f"{len(tracks)} canciones en {OUTPUT}  (+{added} nuevas, {kept} sin tocar, {removed} sacadas)")


if __name__ == "__main__":
    main()
