#!/usr/bin/env python3
"""Builds public/favicon.ico (multi-size ICO) from the generated PNG favicons.

Requires Pillow (python3 -m pip install pillow). Run after
scripts/generate-seo-assets.mjs has produced favicon-16/32/48.png.
"""

from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public"

images = []
for size in (16, 32, 48):
    path = PUBLIC / f"favicon-{size}.png"
    img = Image.open(path).convert("RGBA")
    if img.size != (size, size):
        img = img.resize((size, size), Image.LANCZOS)
    images.append(img)

# Pillow creates each requested ICO entry from the largest source image. Using
# the 48px source avoids an ICO that contains only the first 16px frame.
images[-1].save(
    PUBLIC / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
    append_images=images[1:],
)
print("Created public/favicon.ico (16/32/48)")
