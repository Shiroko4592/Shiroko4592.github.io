const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USER_FILE = path.join(DATA_DIR, 'users.json');

let db = null;

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USER_FILE)) {
    db = { users: {}, pending: {}, sessions: {} };
    save();
  } else {
    try {
      db = JSON.parse(fs.readFileSync(USER_FILE, 'utf8'));
    } catch (err) {
      console.error('Failed to read users.json, starting fresh:', err);
      db = { users: {}, pending: {}, sessions: {} };
    }
    if (!db.users) db.users = {};
    if (!db.pending) db.pending = {};
    if (!db.sessions) db.sessions = {};
  }
}

function save() {
  fs.writeFileSync(USER_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Normalize a user-typed phone: keep leading + and digits only.
function normalizePhone(phone) {
  let p = String(phone || '').trim();
  // Allow common separators by stripping them first
  p = p.replace(/[\s\-().]/g, '');
  return p;
}

// E.164-ish: + followed by 8 to 15 digits, first digit non-zero (country code).
function isValidPhone(phone) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

function findUser(phone) {
  return db.users[phone] || null;
}

function listUsers() {
  return Object.values(db.users)
    .map((u) => ({ phone: u.phone, createdAt: u.createdAt }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// --- Pending signups (awaiting SMS confirmation) ---

function createPendingSignup(phone, password) {
  const token = crypto.randomBytes(24).toString('hex');
  db.pending[token] = {
    phone,
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  };
  save();
  return token;
}

function getPendingSignup(token) {
  if (!token) return null;
  const p = db.pending[token];
  if (!p) return null;
  if (p.expiresAt < Date.now()) {
    delete db.pending[token];
    save();
    return null;
  }
  return p;
}

function consumePendingSignup(token) {
  const p = getPendingSignup(token);
  if (!p) return null;
  delete db.pending[token];
  save();
  return p;
}

function createUser(phone, passwordHash) {
  db.users[phone] = {
    phone,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  save();
  return db.users[phone];
}

// --- Sessions (cookie-based) ---

function createSession(phone) {
  const sid = crypto.randomBytes(24).toString('hex');
  db.sessions[sid] = { phone, createdAt: Date.now() };
  save();
  return sid;
}

function getSession(sid) {
  if (!sid) return null;
  const s = db.sessions[sid];
  if (!s) return null;
  return s;
}

function deleteSession(sid) {
  if (!sid) return;
  delete db.sessions[sid];
  save();
}

// --- Password generator (used server-side; same alphabet as client JS) ---

function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const buf = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}

load();

module.exports = {
  hashPassword,
  verifyPassword,
  normalizePhone,
  isValidPhone,
  findUser,
  listUsers,
  createPendingSignup,
  getPendingSignup,
  consumePendingSignup,
  createUser,
  createSession,
  getSession,
  deleteSession,
  generatePassword,
};
