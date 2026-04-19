#!/usr/bin/env node
/**
 * Embed blog content to Cloudflare Vectorize for RAG.
 *
 * Setup once:
 *   wrangler vectorize create dailongai-blog --dimensions=1024 --metric=cosine
 *
 * Run:
 *   CF_ACCOUNT_ID=xxx CF_API_TOKEN=xxx node scripts/embed-blog.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BLOG_DIR = join(ROOT, "content/blog");
const INDEX_NAME = "dailongai-blog";
const EMBED_MODEL = "@cf/baai/bge-m3";
const CHUNK_TOKENS = 400;
const CHUNK_OVERLAP = 60;

const accountId = process.env.CF_ACCOUNT_ID;
const apiToken = process.env.CF_API_TOKEN;
if (!accountId || !apiToken) {
  console.error("CF_ACCOUNT_ID and CF_API_TOKEN env vars required.");
  process.exit(1);
}

function chunkText(text, size, overlap) {
  const words = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ");
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + size).join(" "));
    i += size - overlap;
  }
  return chunks;
}

async function embed(texts) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${EMBED_MODEL}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texts }),
  });
  if (!res.ok) throw new Error(`embed failed ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result.data;
}

async function upsert(vectors) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${INDEX_NAME}/upsert`;
  const ndjson = vectors.map((v) => JSON.stringify(v)).join("\n");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/x-ndjson" },
    body: ndjson,
  });
  if (!res.ok) throw new Error(`upsert failed ${res.status}: ${await res.text()}`);
  return res.json();
}

const files = (await readdir(BLOG_DIR)).filter((f) => f.endsWith(".json"));
console.log(`Found ${files.length} blog files`);

let total = 0;
for (const file of files) {
  const article = JSON.parse(await readFile(join(BLOG_DIR, file), "utf8"));
  const chunks = chunkText(article.content || "", CHUNK_TOKENS, CHUNK_OVERLAP);
  if (chunks.length === 0) continue;

  const embeddings = await embed(chunks);
  const vectors = embeddings.map((values, i) => ({
    id: `${article.slug}#${i}`,
    values,
    metadata: {
      slug: article.slug,
      title: article.title,
      url: `/blog/${article.slug}`,
      chunk: i,
      text: chunks[i].slice(0, 800),
    },
  }));
  await upsert(vectors);
  total += vectors.length;
  console.log(`✓ ${article.slug} → ${vectors.length} chunks`);
}
console.log(`\nDone. ${total} chunks embedded into ${INDEX_NAME}.`);
