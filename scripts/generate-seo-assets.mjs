// Generates SEO/brand assets derived from the Inside Invoice logo:
//   public/favicon.ico        (16/32/48 multi-size ICO, built by Pillow)
//   public/favicon-48.png     (48x48 PNG — Google's preferred favicon size)
//   public/favicon.svg        (square SVG icon)
//   public/apple-touch-icon.png (180x180)
//   public/og-image.png       (1200x630 social preview)
//
// Run: node scripts/generate-seo-assets.mjs
// Then: python3 scripts/build-favicon-ico.py

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const { Resvg, initWasm } = await import("@resvg/resvg-wasm");
const wasmPath = join(__dirname, "..", "node_modules/@resvg/resvg-wasm/index_bg.wasm");
await initWasm(readFileSync(wasmPath));

// Square icon mark — same brand geometry as src/assets/inside-invoice-logo.svg
// and scripts/generate-icons.mjs (512 canvas, rx=112 rounded square).
const faviconSvg = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="url(#grad1)"/>
  <circle cx="440" cy="72" r="96" fill="white" opacity="0.05"/>
  <circle cx="72" cy="440" r="128" fill="white" opacity="0.05"/>
  <circle cx="192" cy="160" r="40" fill="white"/>
  <rect x="152" y="224" width="80" height="192" rx="40" fill="white"/>
  <circle cx="352" cy="208" r="28.8" fill="white" opacity="0.95"/>
  <rect x="323.2" y="272" width="57.6" height="144" rx="14.4" fill="white" opacity="0.95"/>
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#334155;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#475569;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
    </linearGradient>
  </defs>
</svg>`;

// 1200x630 social preview: brand gradient, logo mark, wordmark + tagline.
// Uses Arial (present on macOS); if fonts fail to load resvg renders no text.
const ogSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e293b;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1"/>
    </linearGradient>
    <linearGradient id="mark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#64748b;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#334155;stop-opacity:1"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" style="stop-color:#475569;stop-opacity:0.55"/>
      <stop offset="100%" style="stop-color:#1e293b;stop-opacity:0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1080" cy="60" r="300" fill="url(#glow)"/>
  <circle cx="120" cy="570" r="160" fill="url(#glow)"/>

  <!-- Logo mark (rounded square with iI monogram) -->
  <g transform="translate(447,150) scale(0.95)">
    <rect width="306" height="306" rx="70" fill="url(#mark)"/>
    <circle cx="230" cy="40" r="55" fill="white" opacity="0.06"/>
    <circle cx="40" cy="266" r="72" fill="white" opacity="0.05"/>
    <circle cx="112" cy="96" r="24" fill="white"/>
    <rect x="88" y="130" width="48" height="116" rx="24" fill="white"/>
    <circle cx="204" cy="124" r="17" fill="white" opacity="0.95"/>
    <rect x="186" y="158" width="36" height="88" rx="17" fill="white" opacity="0.95"/>
    <defs>
      <linearGradient id="mark" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#475569;stop-opacity:1"/>
        <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1"/>
      </linearGradient>
    </defs>
  </g>

  <!-- Wordmark -->
  <text x="600" y="460" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="bold" fill="#ffffff">Inside<span font-weight="bold" fill="#94a3b8">Invoice</span></text>
  <text x="600" y="530" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" fill="#94a3b8">GST Invoice &amp; Billing Software for Indian Businesses</text>
</svg>`;

function render(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "Arial",
    },
  });
  return Buffer.from(resvg.render().asPng());
}

writeFileSync(join(publicDir, "favicon.svg"), faviconSvg);
console.log("Created public/favicon.svg");

for (const size of [16, 32, 48, 180]) {
  const png = render(faviconSvg, size);
  const name = size === 180 ? "apple-touch-icon.png" : `favicon-${size}.png`;
  writeFileSync(join(publicDir, name), png);
  console.log(`Created public/${name} (${size}x${size})`);
}

// Full logo mark (rounded square) inside og-image with padding
const ogPng = render(ogSvg, 1200);
writeFileSync(join(publicDir, "og-image.png"), ogPng);
console.log("Created public/og-image.png (1200x630)");
