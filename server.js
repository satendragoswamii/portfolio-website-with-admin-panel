const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BACKUPS = 30;

for (const dir of [DATA_DIR, BACKUP_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });

// ---------- storage helpers ----------
function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function backupContent() {
  if (!fs.existsSync(CONTENT_FILE)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(CONTENT_FILE, path.join(BACKUP_DIR, `content-${stamp}.json`));
  const backups = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
    fs.unlinkSync(path.join(BACKUP_DIR, old));
  }
}

// ---------- auth ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

function verifyPassword(password, stored) {
  if (!stored || !stored.salt || !stored.hash) return false;
  const candidate = crypto.scryptSync(password, stored.salt, 64);
  const expected = Buffer.from(stored.hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

const normEmail = (e) => String(e ?? '').trim().toLowerCase();
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const safeEqualStr = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Admin login = email + password, stored in data/auth.json. Set it with `npm run set-admin`
// (or ADMIN_EMAIL / ADMIN_PASSWORD env vars on first start).
{
  const auth = readJSON(AUTH_FILE, null);
  if (!auth && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    writeJSON(AUTH_FILE, { email: normEmail(process.env.ADMIN_EMAIL), ...hashPassword(process.env.ADMIN_PASSWORD) });
  } else if (auth && !auth.email && process.env.ADMIN_EMAIL) {
    writeJSON(AUTH_FILE, { ...auth, email: normEmail(process.env.ADMIN_EMAIL) });
  }
  const current = readJSON(AUTH_FILE, null);
  if (!current || !current.email) console.log('⚠  Admin login not set up. Run: npm run set-admin');
}

const sessions = new Map(); // token -> expiry timestamp
const loginAttempts = new Map(); // ip -> { count, resetAt }

function getToken(req) {
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  return match ? match[1] : null;
}

function isAuthed(req) {
  const token = getToken(req);
  const expiry = token && sessions.get(token);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'Not logged in' });
}

function setSessionCookie(res, token, maxAgeMs) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`
  );
}

// ---------- uploads ----------
const ALLOWED_UPLOADS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED_UPLOADS[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOADS[file.mimetype]) cb(null, true);
    else cb(new Error('Only JPG, PNG, GIF, WEBP images or PDF files are allowed'));
  },
});

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/api/content', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(readJSON(CONTENT_FILE, {}));
});

app.put('/api/content', requireAuth, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !body.profile || !Array.isArray(body.sections)) {
    return res.status(400).json({ error: 'Invalid content: expected an object with "profile" and "sections"' });
  }
  backupContent();
  writeJSON(CONTENT_FILE, body);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && record.resetAt > now && record.count >= 5) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }
  const auth = readJSON(AUTH_FILE, null);
  if (!auth || !auth.email) {
    return res.status(503).json({ error: 'Admin login is not set up yet. Run "npm run set-admin" in the project folder.' });
  }
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const passOk = verifyPassword(password, auth); // always hash, so timing doesn't reveal which field was wrong
  if (!(passOk && safeEqualStr(normEmail(email), auth.email))) {
    const next = record && record.resetAt > now ? record : { count: 0, resetAt: now + 10 * 60 * 1000 };
    next.count += 1;
    loginAttempts.set(ip, next);
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, now + SESSION_TTL_MS);
  setSessionCookie(res, token, SESSION_TTL_MS);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const token = getToken(req);
  if (token) sessions.delete(token);
  setSessionCookie(res, '', 0);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const authed = isAuthed(req);
  res.json({ authed, email: authed ? readJSON(AUTH_FILE, {}).email : undefined });
});

// Change login email and/or password. Always requires the current password.
app.post('/api/credentials', requireAuth, (req, res) => {
  const { current, email, next } = req.body || {};
  const auth = readJSON(AUTH_FILE, null);
  if (!verifyPassword(String(current || ''), auth)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const newEmail = normEmail(email);
  if (!looksLikeEmail(newEmail)) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (next && (typeof next !== 'string' || next.length < 10)) {
    return res.status(400).json({ error: 'New password must be at least 10 characters' });
  }
  writeJSON(AUTH_FILE, { ...(next ? hashPassword(next) : { salt: auth.salt, hash: auth.hash }), email: newEmail });
  const keep = getToken(req);
  for (const token of sessions.keys()) if (token !== keep) sessions.delete(token);
  res.json({ ok: true, email: newEmail });
});

app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// Home page with SEO / share-preview tags filled in from the content (same as the Cloudflare Worker)
const { renderHead } = require('./src/seo.mjs');
app.get(['/', '/index.html'], (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(renderHead(html, readJSON(CONTENT_FILE, {}), `${req.protocol}://${req.get('host')}`));
});

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Portfolio:   http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin/`);
});
