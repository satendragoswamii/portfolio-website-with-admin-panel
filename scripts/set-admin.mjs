// Sets the admin login (email + password) for the local server (data/auth.json).
// Usage: npm run set-admin
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const AUTH_FILE = path.resolve(import.meta.dirname, '..', 'data', 'auth.json');

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : s.replace(/[^\r\n]/g, '•'));
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const email = (await ask('Admin email: ')).trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('That does not look like a valid email.');
  process.exit(1);
}
const password = await ask('New password (min 10 characters): ', { hidden: true });
if (password.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}
if ((await ask('Repeat password: ', { hidden: true })) !== password) {
  console.error('Passwords do not match.');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
fs.writeFileSync(AUTH_FILE, JSON.stringify({ email, salt, hash }, null, 2));
console.log('✓ Admin login saved. Restart the server (npm start) to sign out existing sessions.');
