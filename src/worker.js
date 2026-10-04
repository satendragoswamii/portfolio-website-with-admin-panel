// Cloudflare Worker backend — same API as server.js, backed by Workers KV.
// Static files in /public are served by Workers Static Assets; this script only handles /api/* and /uploads/*.
//
import { renderHead } from './seo.mjs';
// Content shipped with the code: used until the first save in the admin (so no manual upload is needed after deploying)
import defaultContent from '../data/content.json';

// KV keys:
//   content            site content JSON
//   auth               { email, salt, hash, iterations } admin login (until first login: ADMIN_EMAIL + ADMIN_PASSWORD secrets)
//   session:<token>    admin session (expires automatically)
//   upload:<filename>  uploaded file bytes
//   backup:<iso date>  previous content versions (kept 30 days)
//   rl:<ip>            failed-login counter

const SESSION_TTL = 12 * 60 * 60;
const BACKUP_TTL = 30 * 24 * 60 * 60;
const PBKDF2_ITERATIONS = 100000; // Workers' maximum
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const UPLOAD_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};
const EXT_TYPES = Object.fromEntries(Object.entries(UPLOAD_TYPES).map(([type, ext]) => [ext, type]));

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (bytes) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(password, salt = randomHex(16), iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations },
    key,
    256
  );
  return { salt, hash: toHex(bits), iterations };
}

const normEmail = (e) => String(e ?? '').trim().toLowerCase();
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function getAuth(env) {
  const stored = await env.PORTFOLIO.get('auth', 'json');
  // Older records have no email: use the ADMIN_EMAIL secret
  if (stored) return { ...stored, email: stored.email || normEmail(env.ADMIN_EMAIL) };
  return null;
}

// Checks both email and password; always does the full hash so timing doesn't reveal which one was wrong.
async function verifyCredentials(env, email, password) {
  const stored = await getAuth(env);
  if (stored) {
    const { hash } = await hashPassword(password, stored.salt, stored.iterations);
    const emailOk = !!stored.email && safeEqual(normEmail(email), stored.email);
    return safeEqual(hash, stored.hash) && emailOk;
  }
  // First login: accept the ADMIN_EMAIL / ADMIN_PASSWORD secrets, then store them (password hashed).
  const emailOk = !!env.ADMIN_EMAIL && safeEqual(normEmail(email), normEmail(env.ADMIN_EMAIL));
  const passOk = !!env.ADMIN_PASSWORD && safeEqual(password, env.ADMIN_PASSWORD);
  if (emailOk && passOk) {
    await env.PORTFOLIO.put('auth', JSON.stringify({ email: normEmail(email), ...(await hashPassword(password)) }));
    return true;
  }
  return false;
}

async function verifyPassword(env, password) {
  const stored = await getAuth(env);
  if (stored) {
    const { hash } = await hashPassword(password, stored.salt, stored.iterations);
    return safeEqual(hash, stored.hash);
  }
  return !!env.ADMIN_PASSWORD && safeEqual(password, env.ADMIN_PASSWORD);
}

function getToken(request) {
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  return m ? m[1] : null;
}

async function isAuthed(request, env) {
  const token = getToken(request);
  return !!(token && (await env.PORTFOLIO.get(`session:${token}`)));
}

const sessionCookie = (token, maxAge) =>
  `sid=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const kv = env.PORTFOLIO;

  if (pathname === '/api/content' && method === 'GET') {
    const content = (await kv.get('content')) || JSON.stringify(defaultContent);
    return new Response(content, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }

  if (pathname === '/api/me' && method === 'GET') {
    const authed = await isAuthed(request, env);
    const email = authed ? (await getAuth(env))?.email || normEmail(env.ADMIN_EMAIL) : undefined;
    return json({ authed, email });
  }

  if (pathname === '/api/login' && method === 'POST') {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const failures = Number((await kv.get(`rl:${ip}`)) || 0);
    if (failures >= 5) return json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
    const stored = await getAuth(env);
    if (stored ? !stored.email : !(env.ADMIN_EMAIL && env.ADMIN_PASSWORD)) {
      return json({ error: 'Admin login is not configured yet. Set the ADMIN_EMAIL and ADMIN_PASSWORD secrets with: npx wrangler secret put …' }, 503);
    }
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!(await verifyCredentials(env, email, password))) {
      await kv.put(`rl:${ip}`, String(failures + 1), { expirationTtl: 600 });
      return json({ error: 'Incorrect email or password' }, 401);
    }
    const token = randomHex(32);
    await kv.put(`session:${token}`, '1', { expirationTtl: SESSION_TTL });
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_TTL) });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    const token = getToken(request);
    if (token) await kv.delete(`session:${token}`);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  // ---- everything below requires login ----
  if (!(await isAuthed(request, env))) return json({ error: 'Not logged in' }, 401);

  if (pathname === '/api/content' && method === 'PUT') {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body) || !body.profile || !Array.isArray(body.sections)) {
      return json({ error: 'Invalid content: expected an object with "profile" and "sections"' }, 400);
    }
    const previous = await kv.get('content');
    if (previous) await kv.put(`backup:${new Date().toISOString()}`, previous, { expirationTtl: BACKUP_TTL });
    await kv.put('content', JSON.stringify(body));
    return json({ ok: true, savedAt: new Date().toISOString() });
  }

  // Change login email and/or password. Always requires the current password.
  if (pathname === '/api/credentials' && method === 'POST') {
    const { current, email, next } = await request.json().catch(() => ({}));
    if (!(await verifyPassword(env, String(current || '')))) return json({ error: 'Current password is incorrect' }, 400);
    const newEmail = normEmail(email);
    if (!looksLikeEmail(newEmail)) return json({ error: 'Please enter a valid email address' }, 400);
    if (next && (typeof next !== 'string' || next.length < 10)) return json({ error: 'New password must be at least 10 characters' }, 400);
    const record = next ? await hashPassword(next) : (await getAuth(env)) || (await hashPassword(String(current)));
    await kv.put('auth', JSON.stringify({ ...record, email: newEmail }));
    // Sign out every other session
    const keep = getToken(request);
    const { keys } = await kv.list({ prefix: 'session:' });
    await Promise.all(keys.filter((k) => k.name !== `session:${keep}`).map((k) => kv.delete(k.name)));
    return json({ ok: true, email: newEmail });
  }

  if (pathname === '/api/upload' && method === 'POST') {
    const form = await request.formData().catch(() => null);
    const file = form && form.get('file');
    if (!file || typeof file === 'string') return json({ error: 'No file received' }, 400);
    const ext = UPLOAD_TYPES[file.type];
    if (!ext) return json({ error: 'Only JPG, PNG, GIF, WEBP images or PDF files are allowed' }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return json({ error: 'File too large (max 8 MB)' }, 400);
    const name = `${Date.now()}-${randomHex(6)}${ext}`;
    await kv.put(`upload:${name}`, await file.arrayBuffer());
    return json({ url: `/uploads/${name}` });
  }

  return json({ error: 'Not found' }, 404);
}

async function serveUpload(env, url) {
  const name = decodeURIComponent(url.pathname.slice('/uploads/'.length));
  if (!/^[\w.-]+$/.test(name)) return new Response('Not found', { status: 404 });
  const data = await env.PORTFOLIO.get(`upload:${name}`, 'arrayBuffer');
  if (!data) return new Response('Not found', { status: 404 });
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return new Response(data, {
    headers: {
      'Content-Type': EXT_TYPES[ext === '.jpeg' ? '.jpg' : ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// Home page with title / description / share-preview tags filled in from the content
async function serveHome(request, env, url) {
  const asset = await env.ASSETS.fetch(request);
  if (!asset.ok || !(asset.headers.get('Content-Type') || '').includes('text/html')) return asset;
  const content = (await env.PORTFOLIO.get('content', 'json')) || defaultContent;
  const html = renderHead(await asset.text(), content, url.origin);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response;
    if (url.pathname.startsWith('/api/')) response = await handleApi(request, env, url);
    else if (url.pathname.startsWith('/uploads/')) response = await serveUpload(env, url);
    else if (url.pathname === '/' && request.method === 'GET') response = await serveHome(request, env, url);
    else return env.ASSETS.fetch(request);

    response = new Response(response.body, response);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
  },
};
