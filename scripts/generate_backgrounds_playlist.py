#!/usr/bin/env python3
"""
Escanea la carpeta /backgrounds y actualiza backgrounds/playlist.json
con la lista de imagenes y videos encontrados (publicidades que van
rotando de fondo en la transmision).

Formatos validos:
  imagenes: jpg, jpeg, png, webp, gif
  videos:   mp4, webm, mov, m4v  (se reproducen mudos)

Uso:
    python3 scripts/generate_backgrounds_playlist.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG_DIR = os.path.join(ROOT, "backgrounds")
OUTPUT = os.path.join(BG_DIR, "playlist.json")
VALID_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov", ".m4v"}


def main():
    if not os.path.isdir(BG_DIR):
        print(f"No existe la carpeta {BG_DIR}")
        return

    files = sorted(
        f for f in os.listdir(BG_DIR)
        if os.path.splitext(f)[1].lower() in VALID_EXT
    )

    with open(OUTPUT, "w", encoding="utf-8") as fh:
        json.dump(files, fh, ensure_ascii=False, indent=2)

    print(f"{len(files)} archivos de fondo escritos en {OUTPUT}")


if __name__ == "__main__":
    main()
