// Genera los íconos (PNG y SVG) desde un solo diseño vectorial neutro: un cuaderno con renglones y un lápiz.
// Uso: npm run icons
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

function svg({ rounded }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1D2A1A"/>
      <stop offset="1" stop-color="#0D1412"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="116"' : ''} fill="url(#bg)"/>
  <rect x="138" y="96" width="236" height="320" rx="26" fill="#FBF6E8"/>
  <path d="M138 122 a26 26 0 0 1 26 -26 H190 V416 H164 a26 26 0 0 1 -26 -26 Z" fill="#3BBFA7"/>
  <path d="M214 176 H344 M214 224 H344 M214 272 H344 M214 320 H304" stroke="#BCD0E8" stroke-width="10" stroke-linecap="round"/>
  <path d="M232 300 q22 -38 44 -6 t44 -10" fill="none" stroke="#1F4FB5" stroke-width="10" stroke-linecap="round"/>
  <path d="M346 352 L404 294 L424 314 L366 372 L338 380 Z" fill="#FFC247"/>
</svg>`;
}

writeFileSync(new URL('favicon.svg', out), svg({ rounded: true }));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(file, size, rounded) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg({ rounded }).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`,
  );
  await page.screenshot({ path: new URL(file, out).pathname, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await png('icon-192.png', 192, true);
await png('icon-512.png', 512, true);
await png('icon-maskable-512.png', 512, false);
await png('apple-touch-icon.png', 180, false);
await browser.close();
console.log('Íconos generados en public/icons/');
