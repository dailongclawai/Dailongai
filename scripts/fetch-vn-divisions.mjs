#!/usr/bin/env node
// Fetch post-merger Vietnam administrative divisions (34 provinces, flat ward structure)
// Source: https://provinces.open-api.vn/api/v2 (community-maintained, post Resolution 202/2025/QH15)
// Output: public/data/vn-provinces.json + public/data/vn-wards/{code}.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_PROVINCES = path.join(ROOT, 'public/data/vn-provinces.json');
const OUT_WARDS_DIR = path.join(ROOT, 'public/data/vn-wards');

const API = 'https://provinces.open-api.vn/api/v2';

const pad2 = (n) => String(n).padStart(2, '0');

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function main() {
  console.log('Fetching province list…');
  const provinces = await fetchJson(`${API}/?depth=1`);
  console.log(`  ${provinces.length} provinces`);

  if (provinces.length !== 34) {
    console.warn(`  ⚠️  Expected 34 post-merger provinces, got ${provinces.length}`);
  }

  // Sort by code asc; build provinces list
  provinces.sort((a, b) => a.code - b.code);
  const provincesOut = provinces.map((p) => ({
    code: pad2(p.code),
    name: p.name,
  }));

  fs.mkdirSync(path.dirname(OUT_PROVINCES), { recursive: true });
  fs.writeFileSync(OUT_PROVINCES, JSON.stringify(provincesOut));
  console.log(`  ✓ wrote ${OUT_PROVINCES}`);

  // Clear stale ward files before writing fresh set
  if (fs.existsSync(OUT_WARDS_DIR)) {
    for (const f of fs.readdirSync(OUT_WARDS_DIR)) {
      if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT_WARDS_DIR, f));
    }
  } else {
    fs.mkdirSync(OUT_WARDS_DIR, { recursive: true });
  }

  console.log('Fetching wards per province…');
  let totalWards = 0;
  for (const p of provinces) {
    const data = await fetchJson(`${API}/p/${p.code}?depth=2`);
    const wards = (data.wards || []).map((w) => ({
      code: String(w.code),
      name: w.name,
      district: '', // post-merger: no district layer; kept for backwards compat
    }));
    wards.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const outFile = path.join(OUT_WARDS_DIR, `${pad2(p.code)}.json`);
    fs.writeFileSync(outFile, JSON.stringify(wards));
    totalWards += wards.length;
    console.log(`  ${pad2(p.code)} ${p.name}: ${wards.length} wards`);
    // small throttle to be polite
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(`\nDone. ${provinces.length} provinces, ${totalWards} wards.`);
}

main().catch((e) => {
  console.error('Fetch failed:', e);
  process.exit(1);
});
