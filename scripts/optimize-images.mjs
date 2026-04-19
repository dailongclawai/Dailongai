#!/usr/bin/env node
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, extname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DIR = join(ROOT, 'public/images');
const OUT_DIR = join(ROOT, 'public/images/_responsive');

const WIDTHS = [320, 640, 1024, 1920];
const FORMATS = [
  { ext: 'avif', options: { quality: 55, effort: 4 } },
  { ext: 'webp', options: { quality: 78 } },
];
const SOURCE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_responsive') continue;
      yield* walk(path);
    } else if (SOURCE_EXT.has(extname(entry.name).toLowerCase())) {
      yield path;
    }
  }
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function processFile(srcPath) {
  const rel = relative(SRC_DIR, srcPath);
  const stem = basename(rel, extname(rel));
  const subDir = join(OUT_DIR, rel.replace(basename(rel), '').replace(/\/$/, ''));
  await mkdir(subDir, { recursive: true });

  const meta = await sharp(srcPath).metadata();
  const sourceWidth = meta.width || 0;
  const generated = [];

  for (const targetWidth of WIDTHS) {
    if (sourceWidth && targetWidth > sourceWidth) continue;
    for (const fmt of FORMATS) {
      const outName = `${stem}-${targetWidth}.${fmt.ext}`;
      const outPath = join(subDir, outName);
      if (await exists(outPath)) {
        generated.push(outName);
        continue;
      }
      let pipe = sharp(srcPath).resize({ width: targetWidth, withoutEnlargement: true });
      if (fmt.ext === 'avif') pipe = pipe.avif(fmt.options);
      else pipe = pipe.webp(fmt.options);
      await pipe.toFile(outPath);
      generated.push(outName);
    }
  }
  return { src: rel, generated };
}

const results = [];
for await (const path of walk(SRC_DIR)) {
  const r = await processFile(path);
  results.push(r);
  console.log(`✓ ${r.src} → ${r.generated.length} variants`);
}

const total = results.reduce((s, r) => s + r.generated.length, 0);
console.log(`\nDone. ${results.length} sources, ${total} files in public/images/_responsive/`);
