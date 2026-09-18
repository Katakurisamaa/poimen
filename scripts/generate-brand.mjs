import fs from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import sharp from 'sharp';

const source = await fs.readFile(new URL('../lib/brand.ts', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports });
const { POIMEN_P_MARK, POIMEN_P_VIEWBOX } = module.exports;

const pPath = (color, width = 3.6) => `<path d="${POIMEN_P_MARK}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const svg = (box, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" fill="none"><title>Poimén</title>${body}</svg>`;

const icon = svg('0 0 64 64', `<rect width="64" height="64" rx="16" fill="#1e1b18"/><g transform="translate(18, 14)">${pPath('#d4af37', 3.8)}</g>`);
const root = new URL('../', import.meta.url);
await fs.mkdir(new URL('public/brand/', root), { recursive: true });

for (const [name, ink, accent] of [
  ['light', '#1e1b18', '#9a7432'],
  ['dark', '#f4eee3', '#d4af37'],
  ['mono', 'currentColor', 'currentColor']
]) {
  const content = `<g>${pPath(accent)}<text x="24.5" y="32" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-weight="700" font-size="28" fill="${ink}" letter-spacing="-0.6px">oimén</text></g>`;
  await fs.writeFile(new URL(`public/brand/poimen-${name}.svg`, root), svg('0 0 130 36', content));
}

await fs.writeFile(new URL('public/brand/poimen-symbol.svg', root), svg(POIMEN_P_VIEWBOX, pPath('currentColor')));
await fs.writeFile(new URL('app/icon.svg', root), icon);

for (const size of [192, 512]) {
  const filePath = fileURLToPath(new URL(`public/brand/icon-${size}.png`, root));
  await sharp(Buffer.from(icon)).resize(size, size).png().toFile(filePath);
}

const apple = svg('0 0 64 64', `<rect width="64" height="64" fill="#1e1b18"/><g transform="translate(18, 14)">${pPath('#d4af37', 3.8)}</g>`);
await fs.writeFile(new URL('app/apple-icon.png', root), await sharp(Buffer.from(apple)).resize(180, 180).png().toBuffer());

const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(Buffer.from(icon)).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((data, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index]; header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(data.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += data.length;
});
await fs.writeFile(new URL('app/favicon.ico', root), Buffer.concat([header, ...images]));
console.log('Poimén: [P stylisé] + oimén wordmark & icons regenerated.');
