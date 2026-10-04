// Puts a snapshot from site-snapshots/<name>/ back into a Cloudflare KV namespace
// (content + uploads; add --with-history to also restore the backup:* history).
//
// Usage: node scripts/restore-snapshot.mjs <name> <kv-namespace-id> [--with-history] [--local]
// e.g.   node scripts/restore-snapshot.mjs my-site <kv-namespace-id>
//
// ⚠ This OVERWRITES the live content of that namespace. Take a fresh snapshot first if unsure.
// The admin login is not part of snapshots: set ADMIN_EMAIL / ADMIN_PASSWORD secrets on the Worker.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const [name, namespaceId] = args.filter((a) => !a.startsWith('--'));
const withHistory = args.includes('--with-history');
const target = args.includes('--local') ? '--local' : '--remote';
if (!name || !namespaceId) {
  console.error('Usage: node scripts/restore-snapshot.mjs <name> <kv-namespace-id> [--with-history] [--local]');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'site-snapshots', name);
if (!fs.existsSync(path.join(dir, 'content.json'))) {
  console.error(`No snapshot found at site-snapshots/${name}/content.json`);
  process.exit(1);
}

const put = (key, file) => {
  execFileSync('npx', ['wrangler', 'kv', 'key', 'put', key, '--path', file, '--namespace-id', namespaceId, target], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  console.log(`  ✓ ${key}`);
};

console.log(`Restoring site-snapshots/${name} → KV ${namespaceId} (${target.slice(2)})`);
put('content', path.join(dir, 'content.json'));
for (const file of fs.readdirSync(path.join(dir, 'assets'))) put(`upload:${file}`, path.join(dir, 'assets', file));
if (withHistory) {
  for (const file of fs.readdirSync(path.join(dir, 'history'))) {
    // history file names have ":" replaced by "-" (safe file names); keys are restored with that name
    put(`backup:${file.replace(/\.json$/, '')}`, path.join(dir, 'history', file));
  }
}
console.log('Done. Changes can take up to a minute to appear on the site.');
