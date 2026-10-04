// Downloads everything a live site has saved in Cloudflare KV into site-snapshots/<name>/
// so it is kept in Git and can be restored later (see scripts/restore-snapshot.mjs).
//
// Usage: node scripts/snapshot-site.mjs <name> <kv-namespace-id> [site-url]
// e.g.   node scripts/snapshot-site.mjs my-site <kv-namespace-id> https://my-portfolio.example.workers.dev
//
// Saved: content (all text/settings), uploads (photos, PDFs) and content history (backup:* keys).
// Never saved: the admin login (auth), sessions and rate-limit counters.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [name, namespaceId, siteUrl = ''] = process.argv.slice(2);
if (!name || !namespaceId) {
  console.error('Usage: node scripts/snapshot-site.mjs <name> <kv-namespace-id> [site-url]');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'site-snapshots', name);
const wrangler = (args, opts = {}) =>
  execFileSync('npx', ['wrangler', ...args, '--namespace-id', namespaceId, '--remote'], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
    ...opts,
  });

const keys = JSON.parse(wrangler(['kv', 'key', 'list']).toString()).map((k) => k.name);
const skip = (k) => k === 'auth' || k.startsWith('session:') || k.startsWith('rl:');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'history'), { recursive: true });

const saved = { content: false, assets: [], history: [] };
for (const key of keys) {
  if (skip(key)) continue;
  const data = wrangler(['kv', 'key', 'get', key]);
  if (key === 'content') {
    fs.writeFileSync(path.join(outDir, 'content.json'), JSON.stringify(JSON.parse(data.toString()), null, 2));
    saved.content = true;
  } else if (key.startsWith('upload:')) {
    const file = key.slice('upload:'.length);
    fs.writeFileSync(path.join(outDir, 'assets', file), data);
    saved.assets.push(file);
  } else if (key.startsWith('backup:')) {
    const file = `${key.slice('backup:'.length).replace(/[:]/g, '-')}.json`;
    fs.writeFileSync(path.join(outDir, 'history', file), JSON.stringify(JSON.parse(data.toString()), null, 2));
    saved.history.push(file);
  }
  console.log(`  ✓ ${key}`);
}

const meta = {
  name,
  siteUrl,
  kvNamespaceId: namespaceId,
  takenAt: new Date().toISOString(),
  files: { content: saved.content ? 'content.json' : null, assets: saved.assets, history: saved.history },
};
fs.writeFileSync(path.join(outDir, 'snapshot.json'), JSON.stringify(meta, null, 2));
console.log(`\nSaved to site-snapshots/${name}/ (${saved.assets.length} uploads, ${saved.history.length} history versions)`);
