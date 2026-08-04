import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, '..', 'public', 'icons');

const flatSvg = readFileSync(path.join(root, '..', 'src', 'assets', 'logo-mark.svg'));
const maskableSvg = readFileSync(path.join(root, '..', 'src', 'assets', 'logo-mark-maskable.svg'));

async function render(svgBuffer, size, outFile) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, outFile));
  // eslint-disable-next-line no-console
  console.log(`wrote ${outFile}`);
}

await render(flatSvg, 192, 'icon-192.png');
await render(flatSvg, 512, 'icon-512.png');
await render(flatSvg, 180, 'apple-touch-icon.png');
await render(maskableSvg, 512, 'maskable-512.png');
