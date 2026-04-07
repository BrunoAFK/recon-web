# User Authentication System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bearer-token auth with a full user account system (registration, login, password recovery, roles, scan limits, demo scan).

**Architecture:** Pluggable auth provider (`local` or `firebase`) behind a shared `AuthProvider` interface. Local provider uses bcrypt + JWT + SQLite. All user data stored in `user_profiles` table (shared by both providers). Scan limits enforced at API level before each scan. Frontend uses React context for auth state with route guards.

**Tech Stack:** Fastify 5, better-sqlite3, bcrypt, jsonwebtoken, Firebase Admin SDK (optional), React 18, React Router v6, TailwindCSS v4

---

## File Structure

### Backend (packages/api)

| File | Action | Responsibility |
|------|--------|----------------|
| `src/auth/types.ts` | Create | AuthProvider interface, AuthResult, TokenPayload types |
| `src/auth/local-provider.ts` | Create | Local auth: bcrypt + JWT + refresh tokens |
| `src/auth/firebase-provider.ts` | Create | Firebase auth: token verification via Admin SDK |
| `src/auth/index.ts` | Rewrite | Provider factory + Fastify auth plugin using provider |
| `src/auth/auth-routes.ts` | Create | All `/api/auth/*` route handlers |
| `src/auth/admin-routes.ts` | Create | All `/api/admin/*` route handlers |
| `src/auth/scan-limits.ts` | Create | Scan limit checking + response helpers |
| `src/db/index.ts` | Modify | Add users, user_profiles tables + CRUD |
| `src/config.ts` | Modify | Add auth, limit, demo, superadmin env vars |
| `src/routes.ts` | Modify | Add user_id to scans, filter history by user, add demo endpoint |
| `src/scan.ts` | Modify | Accept userId, return scan_limits in results |
| `src/server.ts` | Modify | Register auth routes, admin routes |
| `src/scheduler/index.ts` | Modify | Add demo scan job |

### Frontend (packages/web)

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/api.ts` | Modify | Add auth API calls, scan_limits types |
| `src/hooks/use-auth.ts` | Rewrite | JWT-based auth context with user profile |
| `src/components/layout/Nav.tsx` | Rewrite | Gear icon dropdown replacing Settings link |
| `src/components/auth/RouteGuard.tsx` | Create | Redirect to login if not authenticated |
| `src/pages/Login.tsx` | Rewrite | Email + password login form |
| `src/pages/Signup.tsx` | Create | Registration form |
| `src/pages/ForgotPassword.tsx` | Create | Email input for password reset |
| `src/pages/ResetPassword.tsx` | Create | New password form (from email link) |
| `src/pages/AccountSettings.tsx` | Create | Change email, change password |
| `src/pages/AdminPanel.tsx` | Create | User list table with stats |
| `src/pages/Demo.tsx` | Create | Read-only demo scan results |
| `src/pages/Home.tsx` | Modify | Conditional: scan input vs sign-up/demo CTA |
| `src/pages/Settings.tsx` | Modify | Remove old auth config, connect to user profile |
| `src/App.tsx` | Modify | Add new routes + route guards |

### CLI (packages/cli)

| File | Action | Responsibility |
|------|--------|----------------|
| `src/index.ts` | Modify | Add `create-admin` command |
| `src/admin.ts` | Create | Admin CLI logic (create superadmin in DB) |

---

## Task 1: Install Backend Dependencies

**Files:**
- Modify: `packages/api/package.json`

- [ ] **Step 1: Install bcrypt, jsonwebtoken, and firebase-admin**

```bash
cd packages/api && npm install bcryptjs jsonwebtoken && npm install -D @types/bcryptjs @types/jsonwebtoken
```

We use `bcryptjs` (pure JS, no native compilation needed) and `jsonwebtoken` for JWT. Firebase Admin SDK is an optional peer dependency — installed only when `AUTH_PROVIDER=firebase`.

- [ ] **Step 2: Commit**

```bash
git add packages/api/package.json packages/api/package-lock.json
git commit -m "feat(api): add bcryptjs and jsonwebtoken dependencies"
```

---

## Task 2: Auth Types

**Files:**
- Create: `packages/api/src/auth/types.ts`

- [ ] **Step 1: Create the AuthProvider interface and shared types**

```typescript
// packages/api/src/auth/types.ts

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'superadmin';
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'user' | 'superadmin';
}

export interface AuthProvider {
  register(email: string, password: string): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  logout(userId: string): Promise<void>;
  verifyToken(token: string): Promise<TokenPayload>;
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}

export interface ScanLimits {
  user_daily?: { used: number; limit: number; remaining: number };
  global_daily?: { used: number; limit: number; remaining: number };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/auth/types.ts
git commit -m "feat(api): add auth provider interface and types"
```

---

## Task 3: Update Config

**Files:**
- Modify: `packages/api/src/config.ts`

- [ ] **Step 1: Add all new env vars to config**

Replace the entire `config.ts` with:

```typescript
// packages/api/src/config.ts
import { existsSync } from 'node:fs';
import 'dotenv/config';

function detectChromePath(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  return candidates.find((p) => existsSync(p));
}

function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === 'true';
}

function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export const config = {
  port: envInt('PORT', 3000),
  host: process.env.HOST || '0.0.0.0',
  timeoutLimit: envInt('API_TIMEOUT_LIMIT', 30000),
  corsOrigin: process.env.API_CORS_ORIGIN || '*',
  chromePath: detectChromePath(),
  staticDir: process.env.STATIC_DIR || undefined,
  maxConcurrency: envInt('MAX_CONCURRENCY', 8),
  dbPath: process.env.DB_PATH || './data/recon-web.db',

  // Auth
  authProvider: (process.env.AUTH_PROVIDER || '') as '' | 'local' | 'firebase',
  registrationOpen: envBool('REGISTRATION_OPEN', true),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresInDays: envInt('REFRESH_TOKEN_EXPIRES_DAYS', 30),

  // Firebase (only when AUTH_PROVIDER=firebase)
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseApiKey: process.env.FIREBASE_API_KEY || '',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',

  // Scan limits (0 = unlimited)
  dailyScanLimitGlobal: envInt('DAILY_SCAN_LIMIT_GLOBAL', 0),
  dailyScanLimitUser: envInt('DAILY_SCAN_LIMIT_USER', 0),

  // Superadmin panel visibility
  superadminViewEmail: envBool('SUPERADMIN_VIEW_EMAIL', true),
  superadminViewLastLogin: envBool('SUPERADMIN_VIEW_LAST_LOGIN', true),
  superadminViewDailyScans: envBool('SUPERADMIN_VIEW_DAILY_SCANS', true),
  superadminViewScannedPages: envBool('SUPERADMIN_VIEW_SCANNED_PAGES', true),

  // Demo
  demoScanUrl: process.env.DEMO_SCAN_URL || 'https://example.com',

  apiKeys: {
    GOOGLE_CLOUD_API_KEY: process.env.GOOGLE_CLOUD_API_KEY || '',
    CLOUDMERSIVE_API_KEY: process.env.CLOUDMERSIVE_API_KEY || '',
    BUILT_WITH_API_KEY: process.env.BUILT_WITH_API_KEY || '',
    TRANCO_API_KEY: process.env.TRANCO_API_KEY || '',
    TRANCO_USERNAME: process.env.TRANCO_USERNAME || '',
    VIRUSTOTAL_API_KEY: process.env.VIRUSTOTAL_API_KEY || '',
    ABUSEIPDB_API_KEY: process.env.ABUSEIPDB_API_KEY || '',
  },
} as const;

/** Return only the API keys that have non-empty values. */
export function getPopulatedApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.apiKeys)) {
    if (v) keys[k] = v;
  }
  return keys;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/config.ts
git commit -m "feat(api): add auth, scan limit, and demo config vars"
```

---

## Task 4: Database Schema — Users & Profiles

**Files:**
- Modify: `packages/api/src/db/index.ts`

- [ ] **Step 1: Add users and user_profiles tables, user_id to scans, and CRUD functions**

Add after the existing `CREATE TABLE` statements inside `initDb`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  reset_token TEXT,
  reset_token_expires_at TEXT,
  refresh_token TEXT
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  settings JSON NOT NULL DEFAULT '{}',
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
```

Add migration for existing `scans` table — add `user_id` column if it doesn't exist:

```typescript
// Inside initDb, after CREATE TABLE statements:
const hasUserId = db.prepare(
  "SELECT COUNT(*) as cnt FROM pragma_table_info('scans') WHERE name = 'user_id'"
).get() as { cnt: number };

if (hasUserId.cnt === 0) {
  db.exec('ALTER TABLE scans ADD COLUMN user_id TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id)');
}
```

Add new CRUD functions for users and profiles:

```typescript
// ── User CRUD ──────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
  reset_token: string | null;
  reset_token_expires_at: string | null;
  refresh_token: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  settings: string;
  last_login_at: string | null;
  created_at: string;
}

export function createUser(
  db: BetterSqlite3.Database,
  opts: { id: string; email: string; passwordHash: string; role?: string },
): void {
  db.prepare(
    'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
  ).run(opts.id, opts.email, opts.passwordHash, opts.role ?? 'user');
}

export function getUserByEmail(
  db: BetterSqlite3.Database,
  email: string,
): User | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

export function getUserById(
  db: BetterSqlite3.Database,
  id: string,
): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function updateUserLastLogin(db: BetterSqlite3.Database, id: string): void {
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
}

export function updateUserRefreshToken(db: BetterSqlite3.Database, id: string, token: string | null): void {
  db.prepare('UPDATE users SET refresh_token = ? WHERE id = ?').run(token, id);
}

export function updateUserResetToken(
  db: BetterSqlite3.Database,
  id: string,
  token: string | null,
  expiresAt: string | null,
): void {
  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?').run(token, expiresAt, id);
}

export function updateUserPassword(db: BetterSqlite3.Database, id: string, passwordHash: string): void {
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?').run(passwordHash, id);
}

export function updateUserRole(db: BetterSqlite3.Database, id: string, role: string): void {
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  db.prepare('UPDATE user_profiles SET role = ? WHERE id = ?').run(role, id);
}

export function deleteUser(db: BetterSqlite3.Database, id: string): boolean {
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  db.prepare('DELETE FROM user_profiles WHERE id = ?').run(id);
  return info.changes > 0;
}

// ── Profile CRUD ───────────────────────────────────────────────────────
export function createProfile(
  db: BetterSqlite3.Database,
  opts: { id: string; email: string; role?: string },
): void {
  db.prepare(
    'INSERT OR IGNORE INTO user_profiles (id, email, role) VALUES (?, ?, ?)',
  ).run(opts.id, opts.email, opts.role ?? 'user');
}

export function getProfile(db: BetterSqlite3.Database, id: string): UserProfile | undefined {
  return db.prepare('SELECT * FROM user_profiles WHERE id = ?').get(id) as UserProfile | undefined;
}

export function updateProfileSettings(db: BetterSqlite3.Database, id: string, settings: unknown): void {
  db.prepare('UPDATE user_profiles SET settings = ? WHERE id = ?').run(JSON.stringify(settings), id);
}

export function updateProfileLastLogin(db: BetterSqlite3.Database, id: string): void {
  db.prepare("UPDATE user_profiles SET last_login_at = datetime('now') WHERE id = ?").run(id);
}

export function getAllProfiles(db: BetterSqlite3.Database): UserProfile[] {
  return db.prepare('SELECT * FROM user_profiles ORDER BY created_at DESC').all() as UserProfile[];
}

// ── Scan count helpers ─────────────────────────────────────────────────
export function getDailyScanCountForUser(db: BetterSqlite3.Database, userId: string): number {
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM scans WHERE user_id = ? AND created_at >= datetime('now', 'start of day')",
  ).get(userId) as { cnt: number };
  return row.cnt;
}

export function getDailyScanCountGlobal(db: BetterSqlite3.Database): number {
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM scans WHERE created_at >= datetime('now', 'start of day')",
  ).get() as { cnt: number };
  return row.cnt;
}

export function getUserScannedPages(db: BetterSqlite3.Database, userId: string): string[] {
  const rows = db.prepare(
    "SELECT DISTINCT url FROM scans WHERE user_id = ? AND created_at >= datetime('now', 'start of day') ORDER BY created_at DESC",
  ).all(userId) as Array<{ url: string }>;
  return rows.map((r) => r.url);
}
```

- [ ] **Step 2: Update `createScan` to accept optional `userId`**

Modify the `createScan` function:

```typescript
export function createScan(
  db: BetterSqlite3.Database,
  opts: { id?: string; url: string; handlerCount: number; userId?: string },
): string {
  const id = opts.id ?? randomUUID();
  db.prepare(
    'INSERT INTO scans (id, url, handler_count, status, user_id) VALUES (?, ?, ?, ?, ?)',
  ).run(id, opts.url, opts.handlerCount, 'running', opts.userId ?? null);
  return id;
}
```

Also update `getScans` to support user filtering:

```typescript
export function getScans(
  db: BetterSqlite3.Database,
  opts: { limit?: number; offset?: number; userId?: string; all?: boolean } = {},
): Scan[] {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  if (opts.userId && !opts.all) {
    return db
      .prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(opts.userId, limit, offset) as Scan[];
  }

  return db
    .prepare('SELECT * FROM scans ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as Scan[];
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/db/index.ts
git commit -m "feat(api): add users, profiles tables and scan user_id column"
```

---

## Task 5: Scan Limits Module

**Files:**
- Create: `packages/api/src/auth/scan-limits.ts`

- [ ] **Step 1: Create scan limits checker**

```typescript
// packages/api/src/auth/scan-limits.ts
import type BetterSqlite3 from 'better-sqlite3';
import { config } from '../config.js';
import { getDailyScanCountForUser, getDailyScanCountGlobal } from '../db/index.js';
import type { ScanLimits } from './types.js';

export function checkScanLimits(db: BetterSqlite3.Database, userId: string): {
  allowed: boolean;
  limits: ScanLimits;
  reason?: string;
} {
  const limits: ScanLimits = {};

  // Per-user limit
  if (config.dailyScanLimitUser > 0) {
    const used = getDailyScanCountForUser(db, userId);
    const remaining = Math.max(0, config.dailyScanLimitUser - used);
    limits.user_daily = { used, limit: config.dailyScanLimitUser, remaining };
    if (remaining === 0) {
      return { allowed: false, limits, reason: 'Daily scan limit reached for your account' };
    }
  }

  // Global limit
  if (config.dailyScanLimitGlobal > 0) {
    const used = getDailyScanCountGlobal(db);
    const remaining = Math.max(0, config.dailyScanLimitGlobal - used);
    limits.global_daily = { used, limit: config.dailyScanLimitGlobal, remaining };
    if (remaining === 0) {
      return { allowed: false, limits, reason: 'Global daily scan limit reached' };
    }
  }

  return { allowed: true, limits };
}

export function getScanLimits(db: BetterSqlite3.Database, userId: string): ScanLimits {
  return checkScanLimits(db, userId).limits;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/auth/scan-limits.ts
git commit -m "feat(api): add scan limit checking module"
```

---

## Task 6: Local Auth Provider

**Files:**
- Create: `packages/api/src/auth/local-provider.ts`

- [ ] **Step 1: Implement local auth provider**

```typescript
// packages/api/src/auth/local-provider.ts
import { randomUUID, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type BetterSqlite3 from 'better-sqlite3';
import { config } from '../config.js';
import {
  createUser, getUserByEmail, getUserById, updateUserLastLogin,
  updateUserRefreshToken, updateUserResetToken, updateUserPassword,
  createProfile, updateProfileLastLogin,
} from '../db/index.js';
import type { AuthProvider, AuthResult, TokenPayload } from './types.js';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

export function createLocalProvider(db: BetterSqlite3.Database): AuthProvider {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters when using local auth');
  }

  return {
    async register(email: string, password: string): Promise<AuthResult> {
      if (!config.registrationOpen) {
        throw Object.assign(new Error('Registration is closed'), { statusCode: 403 });
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        throw Object.assign(
          new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
          { statusCode: 400 },
        );
      }

      const existing = getUserByEmail(db, email.toLowerCase());
      if (existing) {
        throw Object.assign(new Error('Email already registered'), { statusCode: 409 });
      }

      const id = randomUUID();
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const normalizedEmail = email.toLowerCase();

      createUser(db, { id, email: normalizedEmail, passwordHash });
      createProfile(db, { id, email: normalizedEmail });

      const refreshToken = generateRefreshToken();
      updateUserRefreshToken(db, id, refreshToken);
      updateUserLastLogin(db, id);
      updateProfileLastLogin(db, id);

      const user = { id, email: normalizedEmail, role: 'user' as const };
      const accessToken = generateAccessToken({ userId: id, email: normalizedEmail, role: 'user' });

      return { accessToken, refreshToken, user };
    },

    async login(email: string, password: string): Promise<AuthResult> {
      const user = getUserByEmail(db, email.toLowerCase());
      if (!user) {
        throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
      }

      const refreshToken = generateRefreshToken();
      updateUserRefreshToken(db, user.id, refreshToken);
      updateUserLastLogin(db, user.id);
      updateProfileLastLogin(db, user.id);

      const role = user.role as 'user' | 'superadmin';
      const accessToken = generateAccessToken({ userId: user.id, email: user.email, role });

      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, role },
      };
    },

    async logout(userId: string): Promise<void> {
      updateUserRefreshToken(db, userId, null);
    },

    async verifyToken(token: string): Promise<TokenPayload> {
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
        return decoded;
      } catch {
        throw Object.assign(new Error('Invalid or expired token'), { statusCode: 401 });
      }
    },

    async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
      // Find user by refresh token
      const user = db.prepare('SELECT * FROM users WHERE refresh_token = ?').get(refreshToken) as
        | { id: string; email: string; role: string }
        | undefined;

      if (!user) {
        throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
      }

      const role = user.role as 'user' | 'superadmin';
      const newAccessToken = generateAccessToken({ userId: user.id, email: user.email, role });
      const newRefreshToken = generateRefreshToken();
      updateUserRefreshToken(db, user.id, newRefreshToken);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    },

    async forgotPassword(email: string): Promise<void> {
      const user = getUserByEmail(db, email.toLowerCase());
      if (!user) return; // Don't reveal whether email exists

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      updateUserResetToken(db, user.id, token, expiresAt);

      // Send email via existing nodemailer infrastructure
      try {
        const { sendPasswordResetEmail } = await import('../notifications/email.js');
        await sendPasswordResetEmail(user.email, token);
      } catch (err) {
        console.error('Failed to send password reset email:', err);
        // Don't throw — we don't want to reveal email existence
      }
    },

    async resetPassword(token: string, newPassword: string): Promise<void> {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw Object.assign(
          new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
          { statusCode: 400 },
        );
      }

      const user = db.prepare(
        "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires_at > datetime('now')",
      ).get(token) as { id: string } | undefined;

      if (!user) {
        throw Object.assign(new Error('Invalid or expired reset token'), { statusCode: 400 });
      }

      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      updateUserPassword(db, user.id, passwordHash);
      updateUserRefreshToken(db, user.id, null); // Invalidate sessions
    },

    async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw Object.assign(
          new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
          { statusCode: 400 },
        );
      }

      const user = getUserById(db, userId);
      if (!user) {
        throw Object.assign(new Error('User not found'), { statusCode: 404 });
      }

      const valid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!valid) {
        throw Object.assign(new Error('Current password is incorrect'), { statusCode: 401 });
      }

      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      updateUserPassword(db, user.id, passwordHash);
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/auth/local-provider.ts
git commit -m "feat(api): implement local auth provider with bcrypt + JWT"
```

---

## Task 7: Firebase Auth Provider

**Files:**
- Create: `packages/api/src/auth/firebase-provider.ts`

- [ ] **Step 1: Implement Firebase auth provider**

```typescript
// packages/api/src/auth/firebase-provider.ts
import type BetterSqlite3 from 'better-sqlite3';
import { config } from '../config.js';
import { createProfile, getProfile, updateProfileLastLogin } from '../db/index.js';
import type { AuthProvider, AuthResult, TokenPayload } from './types.js';

export function createFirebaseProvider(db: BetterSqlite3.Database): AuthProvider {
  // Lazy-load firebase-admin — it's an optional dependency
  let adminApp: any = null;

  async function getFirebaseAdmin() {
    if (adminApp) return adminApp;
    try {
      const admin = await import('firebase-admin');
      if (!admin.default.apps.length) {
        const initOptions: any = { projectId: config.firebaseProjectId };
        if (config.firebaseServiceAccountPath) {
          const { readFileSync } = await import('node:fs');
          const serviceAccount = JSON.parse(readFileSync(config.firebaseServiceAccountPath, 'utf-8'));
          initOptions.credential = admin.default.credential.cert(serviceAccount);
        }
        admin.default.initializeApp(initOptions);
      }
      adminApp = admin.default;
      return adminApp;
    } catch {
      throw Object.assign(
        new Error('firebase-admin is not installed. Run: npm install firebase-admin'),
        { statusCode: 500 },
      );
    }
  }

  // Firebase handles register/login/password on the client side.
  // These server methods are stubs that throw — the frontend talks to Firebase directly.
  const clientSideOnly = (method: string) => {
    throw Object.assign(
      new Error(`${method} is handled client-side by Firebase SDK`),
      { statusCode: 400 },
    );
  };

  return {
    async register(): Promise<AuthResult> {
      return clientSideOnly('register') as never;
    },

    async login(): Promise<AuthResult> {
      return clientSideOnly('login') as never;
    },

    async logout(): Promise<void> {
      // Firebase manages sessions client-side; nothing to do server-side
    },

    async verifyToken(idToken: string): Promise<TokenPayload> {
      const admin = await getFirebaseAdmin();
      const decoded = await admin.auth().verifyIdToken(idToken);

      // Ensure user_profiles row exists
      let profile = getProfile(db, decoded.uid);
      if (!profile) {
        createProfile(db, { id: decoded.uid, email: decoded.email ?? '' });
        profile = getProfile(db, decoded.uid)!;
      }
      updateProfileLastLogin(db, decoded.uid);

      return {
        userId: decoded.uid,
        email: decoded.email ?? '',
        role: (profile.role as 'user' | 'superadmin') ?? 'user',
      };
    },

    async refreshAccessToken(): Promise<{ accessToken: string; refreshToken: string }> {
      return clientSideOnly('refreshAccessToken') as never;
    },

    async forgotPassword(): Promise<void> {
      return clientSideOnly('forgotPassword') as never;
    },

    async resetPassword(): Promise<void> {
      return clientSideOnly('resetPassword') as never;
    },

    async changePassword(): Promise<void> {
      return clientSideOnly('changePassword') as never;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/auth/firebase-provider.ts
git commit -m "feat(api): implement Firebase auth provider"
```

---

## Task 8: Password Reset Email

**Files:**
- Modify: `packages/api/src/notifications/email.ts`

- [ ] **Step 1: Read the existing email module to understand the pattern**

Read `packages/api/src/notifications/email.ts` and add a `sendPasswordResetEmail` export that uses the same nodemailer transport.

- [ ] **Step 2: Add sendPasswordResetEmail function**

Add to the end of `packages/api/src/notifications/email.ts`:

```typescript
export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP not configured — cannot send password reset email');
  }

  const nodemailer = await import('nodemailer');
  const transport = nodemailer.default.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

  await transport.sendMail({
    from: user,
    to,
    subject: 'recon-web — Password Reset',
    text: `You requested a password reset.\n\nClick this link to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset for your recon-web account.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;">Reset Password</a></p>
      <p style="color:#888;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/notifications/email.ts
git commit -m "feat(api): add password reset email sender"
```

---

## Task 9: Rewrite Auth Plugin

**Files:**
- Rewrite: `packages/api/src/auth/index.ts`

- [ ] **Step 1: Rewrite the auth plugin as provider factory + Fastify hook**

```typescript
// packages/api/src/auth/index.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config.js';
import type { AuthProvider, TokenPayload } from './types.js';

declare module 'fastify' {
  interface FastifyInstance {
    authProvider: AuthProvider | null;
  }
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

const PUBLIC_PATHS = new Set(['/health', '/api/handlers', '/api/demo', '/docs']);
const AUTH_PATHS_PREFIX = '/api/auth/';
const PUBLIC_AUTH_ACTIONS = new Set(['login', 'register', 'forgot-password', 'reset-password', 'refresh', 'config']);

async function authPluginImpl(app: FastifyInstance): Promise<void> {
  const providerType = config.authProvider;

  if (!providerType) {
    app.decorate('authProvider', null);
    app.log.info('Auth disabled — no AUTH_PROVIDER set');
    return;
  }

  let provider: AuthProvider;

  if (providerType === 'local') {
    const { createLocalProvider } = await import('./local-provider.js');
    provider = createLocalProvider(app.db);
    app.log.info('Auth enabled: local provider (bcrypt + JWT)');
  } else if (providerType === 'firebase') {
    const { createFirebaseProvider } = await import('./firebase-provider.js');
    provider = createFirebaseProvider(app.db);
    app.log.info('Auth enabled: Firebase provider');
  } else {
    throw new Error(`Unknown AUTH_PROVIDER: ${providerType}. Use "local" or "firebase".`);
  }

  app.decorate('authProvider', provider);

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0];

    // Skip non-API paths (static files, SPA)
    if (!path.startsWith('/api')) return;

    // Allow public endpoints
    if (PUBLIC_PATHS.has(path)) return;

    // Allow public auth actions (login, register, etc.)
    if (path.startsWith(AUTH_PATHS_PREFIX)) {
      const action = path.slice(AUTH_PATHS_PREFIX.length);
      if (PUBLIC_AUTH_ACTIONS.has(action)) return;
    }

    // Require auth
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or malformed Authorization header' });
    }

    const token = header.slice(7);
    try {
      request.user = await provider.verifyToken(token);
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });
}

export const authPlugin = fp(authPluginImpl, {
  name: 'auth-plugin',
  fastify: '5.x',
});

export type { AuthProvider, TokenPayload } from './types.js';
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/auth/index.ts
git commit -m "feat(api): rewrite auth plugin with provider factory"
```

---

## Task 10: Auth Routes

**Files:**
- Create: `packages/api/src/auth/auth-routes.ts`

- [ ] **Step 1: Create auth route handlers**

```typescript
// packages/api/src/auth/auth-routes.ts
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { getProfile, updateProfileSettings } from '../db/index.js';
import { getScanLimits } from './scan-limits.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const provider = app.authProvider;
  if (!provider) return;

  // ── Public auth config (tells frontend what's available) ──────
  app.get('/api/auth/config', {
    schema: { description: 'Auth configuration for frontend', tags: ['auth'] },
  }, async () => {
    return {
      provider: config.authProvider,
      registrationOpen: config.registrationOpen,
    };
  });

  // ── Register ──────────────────────────────────────────────────
  app.post('/api/auth/register', {
    schema: {
      description: 'Create a new account',
      tags: ['auth'],
      body: {
        type: 'object' as const,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' as const, format: 'email' },
          password: { type: 'string' as const, minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    try {
      const result = await provider.register(email, password);
      return result;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // ── Login ─────────────────────────────────────────────────────
  app.post('/api/auth/login', {
    schema: {
      description: 'Log in with email and password',
      tags: ['auth'],
      body: {
        type: 'object' as const,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' as const },
          password: { type: 'string' as const },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    try {
      const result = await provider.login(email, password);
      return result;
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // ── Refresh ───────────────────────────────────────────────────
  app.post('/api/auth/refresh', {
    schema: {
      description: 'Refresh access token',
      tags: ['auth'],
      body: {
        type: 'object' as const,
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' as const },
        },
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    try {
      return await provider.refreshAccessToken(refreshToken);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // ── Forgot password ──────────────────────────────────────────
  app.post('/api/auth/forgot-password', {
    schema: {
      description: 'Send password reset email',
      tags: ['auth'],
      body: {
        type: 'object' as const,
        required: ['email'],
        properties: {
          email: { type: 'string' as const },
        },
      },
    },
  }, async (request) => {
    const { email } = request.body as { email: string };
    await provider.forgotPassword(email);
    return { message: 'If that email is registered, a reset link has been sent.' };
  });

  // ── Reset password ───────────────────────────────────────────
  app.post('/api/auth/reset-password', {
    schema: {
      description: 'Reset password using token from email',
      tags: ['auth'],
      body: {
        type: 'object' as const,
        required: ['token', 'password'],
        properties: {
          token: { type: 'string' as const },
          password: { type: 'string' as const, minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    const { token, password } = request.body as { token: string; password: string };
    try {
      await provider.resetPassword(token, password);
      return { message: 'Password reset successfully' };
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // ── Authenticated routes below ────────────────────────────────

  // ── Get current user ──────────────────────────────────────────
  app.get('/api/auth/me', {
    schema: { description: 'Get current user profile and scan limits', tags: ['auth'] },
  }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Not authenticated' });

    const profile = getProfile(app.db, request.user.userId);
    if (!profile) return reply.code(404).send({ error: 'Profile not found' });

    const scanLimits = getScanLimits(app.db, request.user.userId);
    const settings = JSON.parse(profile.settings || '{}');

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      settings,
      scanLimits,
    };
  });

  // ── Update profile / settings ─────────────────────────────────
  app.put('/api/auth/me', {
    schema: {
      description: 'Update current user profile and settings',
      tags: ['auth'],
      body: {
        type: 'object' as const,
        properties: {
          settings: { type: 'object' as const },
        },
      },
    },
  }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Not authenticated' });

    const { settings } = request.body as { settings?: Record<string, unknown> };
    if (settings) {
      updateProfileSettings(app.db, request.user.userId, settings);
    }

    return { success: true };
  });

  // ── Change password ───────────────────────────────────────────
  app.post('/api/auth/change-password', {
    schema: {
      description: 'Change password (requires current password)',
      tags: ['auth'],
      body: {
        type: 'object' as const,
        required: ['oldPassword', 'newPassword'],
        properties: {
          oldPassword: { type: 'string' as const },
          newPassword: { type: 'string' as const, minLength: 8 },
        },
      },
    },
  }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Not authenticated' });
    const { oldPassword, newPassword } = request.body as { oldPassword: string; newPassword: string };
    try {
      await provider.changePassword(request.user.userId, oldPassword, newPassword);
      return { message: 'Password changed successfully' };
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message });
    }
  });

  // ── Logout ────────────────────────────────────────────────────
  app.post('/api/auth/logout', {
    schema: { description: 'Log out (invalidate refresh token)', tags: ['auth'] },
  }, async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: 'Not authenticated' });
    await provider.logout(request.user.userId);
    return { success: true };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/auth/auth-routes.ts
git commit -m "feat(api): add auth route handlers"
```

---

## Task 11: Admin Routes

**Files:**
- Create: `packages/api/src/auth/admin-routes.ts`

- [ ] **Step 1: Create admin route handlers**

```typescript
// packages/api/src/auth/admin-routes.ts
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import {
  getAllProfiles, getDailyScanCountForUser, getUserScannedPages,
  updateUserRole, deleteUser,
} from '../db/index.js';

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  if (!app.authProvider) return;

  // Superadmin guard
  const requireSuperadmin = async (request: any, reply: any) => {
    if (!request.user || request.user.role !== 'superadmin') {
      return reply.code(403).send({ error: 'Superadmin access required' });
    }
  };

  // ── List users ────────────────────────────────────────────────
  app.get('/api/admin/users', {
    schema: { description: 'List all users (superadmin only)', tags: ['admin'] },
    preHandler: requireSuperadmin,
  }, async () => {
    const profiles = getAllProfiles(app.db);

    return profiles.map((p) => {
      const user: Record<string, unknown> = { id: p.id, role: p.role, created_at: p.created_at };

      if (config.superadminViewEmail) user.email = p.email;
      if (config.superadminViewLastLogin) user.last_login_at = p.last_login_at;
      if (config.superadminViewDailyScans) user.daily_scans = getDailyScanCountForUser(app.db, p.id);
      if (config.superadminViewScannedPages) user.scanned_pages = getUserScannedPages(app.db, p.id);

      return user;
    });
  });

  // ── Update user role ──────────────────────────────────────────
  app.put('/api/admin/users/:id', {
    schema: {
      description: 'Update user role (superadmin only)',
      tags: ['admin'],
      params: { type: 'object' as const, required: ['id'], properties: { id: { type: 'string' as const } } },
      body: { type: 'object' as const, required: ['role'], properties: { role: { type: 'string' as const, enum: ['user', 'superadmin'] } } },
    },
    preHandler: requireSuperadmin,
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: string };
    updateUserRole(app.db, id, role);
    return { success: true };
  });

  // ── Delete user ───────────────────────────────────────────────
  app.delete('/api/admin/users/:id', {
    schema: {
      description: 'Delete a user (superadmin only)',
      tags: ['admin'],
      params: { type: 'object' as const, required: ['id'], properties: { id: { type: 'string' as const } } },
    },
    preHandler: requireSuperadmin,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Prevent self-deletion
    if (request.user?.userId === id) {
      return reply.code(400).send({ error: 'Cannot delete your own account' });
    }

    const deleted = deleteUser(app.db, id);
    if (!deleted) return reply.code(404).send({ error: 'User not found' });
    return { success: true };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/auth/admin-routes.ts
git commit -m "feat(api): add admin route handlers for user management"
```

---

## Task 12: Update Routes — Scan Limits, User Scoping, Demo

**Files:**
- Modify: `packages/api/src/routes.ts`

- [ ] **Step 1: Add scan limit enforcement to scan routes**

In `routes.ts`, add imports at top:

```typescript
import { checkScanLimits } from './auth/scan-limits.js';
```

Modify the `GET /api` handler to check limits and pass userId:

```typescript
// Replace the existing GET /api handler body:
async (request, reply) => {
  const { url } = request.query as { url: string };
  const apiKeys = getPopulatedApiKeys();
  const db = request.server.db;
  const userId = request.user?.userId;

  // Check scan limits if auth is enabled and user is logged in
  if (userId) {
    const { allowed, limits, reason } = checkScanLimits(db, userId);
    if (!allowed) {
      return reply.code(429).send({ error: reason, scan_limits: limits });
    }
  }

  const { scanId, results } = await executeScanDeduped({
    db,
    url,
    handlerOptions: { timeout: config.timeoutLimit, apiKeys, chromePath: config.chromePath },
    concurrency: config.maxConcurrency,
    userId,
  });

  // Include scan limits in response
  const scan_limits = userId ? checkScanLimits(db, userId).limits : undefined;
  return { results, scanId, scan_limits };
}
```

Apply the same pattern to the `GET /api/stream` handler — check limits before starting, include limits in the `scan_completed` event.

- [ ] **Step 2: Update history route to scope by user**

```typescript
// Replace GET /api/history handler:
async (request) => {
  const { limit, offset } = request.query as { limit?: number; offset?: number };
  const db = request.server.db;
  const userId = request.user?.userId;
  const isAdmin = request.user?.role === 'superadmin';
  const all = (request.query as any).all === 'true' && isAdmin;

  return getScans(db, { limit, offset, userId, all: all || !userId });
}
```

- [ ] **Step 3: Add demo endpoint**

```typescript
// Add after history routes:
app.get('/api/demo', {
  schema: { description: 'Get latest demo scan result (public)', tags: ['demo'] },
}, async (request, reply) => {
  const db = request.server.db;
  // Demo scans have user_id = NULL and url = demo URL
  const scan = db.prepare(
    "SELECT * FROM scans WHERE user_id IS NULL AND url = ? ORDER BY created_at DESC LIMIT 1"
  ).get(config.demoScanUrl) as any;

  if (!scan) {
    return reply.code(404).send({ error: 'No demo scan available yet' });
  }

  return getScan(db, scan.id);
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes.ts
git commit -m "feat(api): add scan limits, user-scoped history, demo endpoint"
```

---

## Task 13: Update Scan Module

**Files:**
- Modify: `packages/api/src/scan.ts`

- [ ] **Step 1: Add userId to ExecuteScanOptions and pass to createScan**

Add `userId?: string` to the `ExecuteScanOptions` interface.

Update the `executeScan` function's `createScan` call:

```typescript
const scanId = createScan(db, { url, handlerCount: orderedHandlers.length, userId });
```

Update `executeScanDeduped` to forward `userId`:

```typescript
// No changes needed — it already passes the full opts to executeScan
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/scan.ts
git commit -m "feat(api): associate scans with user ID"
```

---

## Task 14: Update Server — Register New Routes

**Files:**
- Modify: `packages/api/src/server.ts`

- [ ] **Step 1: Register auth and admin routes**

Add imports:

```typescript
import { registerAuthRoutes } from './auth/auth-routes.js';
import { registerAdminRoutes } from './auth/admin-routes.js';
```

After `await app.register(authPlugin);` add:

```typescript
// ── Auth & Admin routes ──────────────────────────────────────
await registerAuthRoutes(app);
await registerAdminRoutes(app);
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/server.ts
git commit -m "feat(api): register auth and admin routes in server"
```

---

## Task 15: Demo Scan Scheduler

**Files:**
- Modify: `packages/api/src/scheduler/index.ts`

- [ ] **Step 1: Add demo scan cron job**

Inside `schedulerPluginImpl`, after the existing scheduler setup, add:

```typescript
// ── Demo scan (runs daily at 00:30 UTC) ──────────────────────────
const demoUrl = config.demoScanUrl;
if (demoUrl && config.authProvider) {
  app.log.info(`Demo scan scheduled for ${demoUrl}`);

  cron.schedule('30 0 * * *', async () => {
    app.log.info(`Running demo scan for ${demoUrl}`);
    try {
      await executeScan({
        db: app.db,
        url: demoUrl,
        handlerOptions: { timeout: 30_000 },
        concurrency: 4,
        // userId intentionally omitted — NULL marks it as a demo/system scan
      });
      app.log.info('Demo scan completed');
    } catch (err) {
      app.log.error(`Demo scan failed: ${String(err)}`);
    }
  });
}
```

Add `config` import at top:

```typescript
import { config } from '../config.js';
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/scheduler/index.ts
git commit -m "feat(api): add daily demo scan to scheduler"
```

---

## Task 16: CLI — create-admin Command

**Files:**
- Create: `packages/cli/src/admin.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Create admin CLI module**

```typescript
// packages/cli/src/admin.ts
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

export async function createAdmin(email: string, password: string, dbPath: string): Promise<void> {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const bcrypt = await import('bcryptjs');
  const Database = (await import('better-sqlite3')).default;

  const resolvedPath = resolve(dbPath);
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT,
      reset_token TEXT,
      reset_token_expires_at TEXT,
      refresh_token TEXT
    );
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      settings JSON NOT NULL DEFAULT '{}',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const normalizedEmail = email.toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as { id: string } | undefined;

  if (existing) {
    // Promote existing user to superadmin
    db.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(existing.id);
    db.prepare("UPDATE user_profiles SET role = 'superadmin' WHERE id = ?").run(existing.id);
    console.log(`User ${normalizedEmail} promoted to superadmin.`);
  } else {
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(id, normalizedEmail, passwordHash, 'superadmin');
    db.prepare("INSERT OR IGNORE INTO user_profiles (id, email, role) VALUES (?, ?, 'superadmin')").run(id, normalizedEmail);
    console.log(`Superadmin created: ${normalizedEmail}`);
  }

  db.close();
}
```

- [ ] **Step 2: Add create-admin command to CLI**

In `packages/cli/src/index.ts`, add after the scan command setup:

```typescript
program
  .command('create-admin')
  .description('Create or promote a superadmin user (local auth only)')
  .requiredOption('--email <email>', 'Admin email address')
  .requiredOption('--password <password>', 'Admin password (min 8 characters)')
  .option('--db <path>', 'Database path', './data/recon-web.db')
  .action(async (options) => {
    try {
      const { createAdmin } = await import('./admin.js');
      await createAdmin(options.email, options.password, options.db);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });
```

- [ ] **Step 3: Install bcryptjs and better-sqlite3 as cli dependencies**

```bash
cd packages/cli && npm install bcryptjs better-sqlite3 && npm install -D @types/bcryptjs @types/better-sqlite3
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/admin.ts packages/cli/src/index.ts packages/cli/package.json
git commit -m "feat(cli): add create-admin command"
```

---

## Task 17: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Replace auth section and add new sections**

Replace the `# ── Authentication ───` section and add new sections:

```env
# ── Authentication ───────────────────────────────────────
# Auth provider: "local" (bcrypt + JWT) or "firebase"
# Leave empty to disable authentication entirely
# AUTH_PROVIDER=local

# JWT secret (required for local auth, minimum 32 characters)
# AUTH_PROVIDER=local requires this to be set
# JWT_SECRET=your-secret-key-at-least-32-characters-long

# JWT access token expiration (default: 15m)
# JWT_EXPIRES_IN=15m

# Refresh token expiration in days (default: 30)
# REFRESH_TOKEN_EXPIRES_DAYS=30

# Firebase (only when AUTH_PROVIDER=firebase)
# FIREBASE_PROJECT_ID=
# FIREBASE_API_KEY=
# FIREBASE_SERVICE_ACCOUNT_PATH=

# Allow new user registration (default: true)
# REGISTRATION_OPEN=true

# Application URL (used in password reset emails)
# APP_URL=http://localhost:3000

# ── Scan Limits ────────────────────────────────────────────
# Daily scan limits (0 = unlimited)
# DAILY_SCAN_LIMIT_GLOBAL=0
# DAILY_SCAN_LIMIT_USER=0

# ── Superadmin Panel ───────────────────────────────────────
# Configure which columns are visible in admin user list
# SUPERADMIN_VIEW_EMAIL=true
# SUPERADMIN_VIEW_LAST_LOGIN=true
# SUPERADMIN_VIEW_DAILY_SCANS=true
# SUPERADMIN_VIEW_SCANNED_PAGES=true

# ── Demo ───────────────────────────────────────────────────
# URL for daily demo scan (shown to unauthenticated users)
# DEMO_SCAN_URL=https://example.com
```

Remove the old `AUTH_ENABLED` / `AUTH_TOKEN` lines.

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example with new auth configuration"
```

---

## Task 18: Frontend — API Client Auth Functions

**Files:**
- Modify: `packages/web/src/lib/api.ts`

- [ ] **Step 1: Add auth API functions and scan_limits type**

Add at the end of `packages/web/src/lib/api.ts`:

```typescript
// ── Auth types ──────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'superadmin';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  settings: Record<string, unknown>;
  scanLimits: ScanLimitsInfo;
}

export interface ScanLimitsInfo {
  user_daily?: { used: number; limit: number; remaining: number };
  global_daily?: { used: number; limit: number; remaining: number };
}

export interface AuthConfig {
  provider: string;
  registrationOpen: boolean;
}

// ── Auth API calls ──────────────────────────────────────────────────
const AUTH_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_BASE}/auth${path}`, {
    ...init,
    headers: buildHeaders(init?.headers),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(body.error ?? `API ${res.status}`);
    (err as any).status = res.status;
    (err as any).scanLimits = body.scan_limits;
    throw err;
  }

  return res.json() as Promise<T>;
}

export function getAuthConfig(): Promise<AuthConfig> {
  return authRequest<AuthConfig>('/config');
}

export function authRegister(email: string, password: string): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function authLogin(email: string, password: string): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function authRefresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  return authRequest('/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export function authForgotPassword(email: string): Promise<{ message: string }> {
  return authRequest('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function authResetPassword(token: string, password: string): Promise<{ message: string }> {
  return authRequest('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export function authChangePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
  return authRequest('/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export function getMe(): Promise<UserProfile> {
  return authRequest<UserProfile>('/me');
}

export function updateMe(settings: Record<string, unknown>): Promise<{ success: boolean }> {
  return authRequest('/me', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
}

export function authLogout(): Promise<{ success: boolean }> {
  return authRequest('/logout', { method: 'POST' });
}

// ── Admin API ───────────────────────────────────────────────────────
export interface AdminUser {
  id: string;
  role: string;
  created_at: string;
  email?: string;
  last_login_at?: string | null;
  daily_scans?: number;
  scanned_pages?: string[];
}

export function getAdminUsers(): Promise<AdminUser[]> {
  return request<AdminUser[]>('/admin/users');
}

export function deleteAdminUser(id: string): Promise<{ success: boolean }> {
  return request('/admin/users/' + id, { method: 'DELETE' });
}

export function updateAdminUserRole(id: string, role: string): Promise<{ success: boolean }> {
  return request('/admin/users/' + id, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

// ── Demo ────────────────────────────────────────────────────────────
export function getDemoScan(): Promise<HistoricalScan> {
  return request<HistoricalScan>('/demo');
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/lib/api.ts
git commit -m "feat(web): add auth, admin, and demo API client functions"
```

---

## Task 19: Frontend — Auth Hook Rewrite

**Files:**
- Rewrite: `packages/web/src/hooks/use-auth.ts`

- [ ] **Step 1: Rewrite auth hook for JWT-based auth**

```typescript
// packages/web/src/hooks/use-auth.ts
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { createElement } from 'react';
import type { AuthUser, AuthConfig, ScanLimitsInfo } from '@/lib/api';

const ACCESS_TOKEN_KEY = 'recon-web-access-token';
const REFRESH_TOKEN_KEY = 'recon-web-refresh-token';
const USER_KEY = 'recon-web-user';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  authConfig: AuthConfig | null;
  scanLimits: ScanLimitsInfo | null;
  login: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
  setAuthConfig: (config: AuthConfig) => void;
  setScanLimits: (limits: ScanLimitsInfo) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setStored(key: string, value: unknown): void {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  } catch { /* localStorage unavailable */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try { return localStorage.getItem(ACCESS_TOKEN_KEY); } catch { return null; }
  });
  const [user, setUser] = useState<AuthUser | null>(() => getStored<AuthUser>(USER_KEY));
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [scanLimits, setScanLimits] = useState<ScanLimitsInfo | null>(null);

  const login = useCallback((at: string, rt: string, u: AuthUser) => {
    setStored(ACCESS_TOKEN_KEY, at);
    setStored(REFRESH_TOKEN_KEY, rt);
    setStored(USER_KEY, u);
    setAccessToken(at);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    setStored(ACCESS_TOKEN_KEY, null);
    setStored(REFRESH_TOKEN_KEY, null);
    setStored(USER_KEY, null);
    setAccessToken(null);
    setUser(null);
    setScanLimits(null);
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    isAuthenticated: !!accessToken && !!user,
    authConfig,
    login,
    logout,
    setAuthConfig,
    scanLimits,
    setScanLimits,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Update buildHeaders in api.ts to use new token key**

In `packages/web/src/lib/api.ts`, update `getStoredToken`:

```typescript
function getStoredToken(): string | null {
  try {
    return localStorage.getItem("recon-web-access-token");
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/hooks/use-auth.ts packages/web/src/lib/api.ts
git commit -m "feat(web): rewrite auth hook for JWT-based authentication"
```

---

## Task 20: Frontend — Route Guard Component

**Files:**
- Create: `packages/web/src/components/auth/RouteGuard.tsx`

- [ ] **Step 1: Create route guard**

```typescript
// packages/web/src/components/auth/RouteGuard.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authConfig } = useAuth();

  // If auth is not configured (no provider), allow access
  if (!authConfig || !authConfig.provider) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function RequireSuperadmin({ children }: { children: React.ReactNode }) {
  const { user, authConfig } = useAuth();

  if (!authConfig || !authConfig.provider) {
    return <>{children}</>;
  }

  if (!user || user.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/auth/RouteGuard.tsx
git commit -m "feat(web): add route guard components"
```

---

## Task 21: Frontend — Login Page Rewrite

**Files:**
- Rewrite: `packages/web/src/pages/Login.tsx`

- [ ] **Step 1: Rewrite login page for email+password**

```typescript
// packages/web/src/pages/Login.tsx
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { authLogin } from '@/lib/api';
import { KeyRound } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, authConfig } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authLogin(email, password);
      login(result.accessToken, result.refreshToken, result.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 mt-32">
      <div className="mb-8 text-center">
        <KeyRound className="h-10 w-10 text-accent mx-auto mb-4" />
        <h1 className="text-3xl font-bold tracking-tight mb-2">Log In</h1>
        <p className="text-muted text-sm">Enter your credentials to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          placeholder="Email"
          className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          autoFocus
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
          placeholder="Password"
          className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          required
        />
        {error && <p className="text-sm text-red-400 pl-1">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <div className="mt-4 text-sm text-muted space-y-2 text-center">
        <Link to="/forgot-password" className="text-accent hover:underline block">
          Forgot password?
        </Link>
        {authConfig?.registrationOpen && (
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="text-accent hover:underline">
              Sign up
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/Login.tsx
git commit -m "feat(web): rewrite login page for email/password auth"
```

---

## Task 22: Frontend — Signup Page

**Files:**
- Create: `packages/web/src/pages/Signup.tsx`

- [ ] **Step 1: Create signup page**

```typescript
// packages/web/src/pages/Signup.tsx
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { authRegister } from '@/lib/api';
import { UserPlus } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await authRegister(email, password);
      login(result.accessToken, result.refreshToken, result.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 mt-32">
      <div className="mb-8 text-center">
        <UserPlus className="h-10 w-10 text-accent mx-auto mb-4" />
        <h1 className="text-3xl font-bold tracking-tight mb-2">Create Account</h1>
        <p className="text-muted text-sm">Start scanning websites for free</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          placeholder="Email"
          className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          autoFocus
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
          placeholder="Password (min 8 characters)"
          className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          required
          minLength={8}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }}
          placeholder="Confirm password"
          className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          required
        />
        {error && <p className="text-sm text-red-400 pl-1">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/Signup.tsx
git commit -m "feat(web): add signup page"
```

---

## Task 23: Frontend — Forgot Password & Reset Password Pages

**Files:**
- Create: `packages/web/src/pages/ForgotPassword.tsx`
- Create: `packages/web/src/pages/ResetPassword.tsx`

- [ ] **Step 1: Create forgot password page**

```typescript
// packages/web/src/pages/ForgotPassword.tsx
import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authForgotPassword } from '@/lib/api';
import { Mail } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authForgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center px-6 mt-32 text-center">
        <Mail className="h-10 w-10 text-accent mb-4" />
        <h1 className="text-3xl font-bold tracking-tight mb-2">Check Your Email</h1>
        <p className="text-muted text-sm max-w-md">
          If an account with that email exists, we've sent a password reset link.
        </p>
        <Link to="/login" className="mt-6 text-sm text-accent hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 mt-32">
      <div className="mb-8 text-center">
        <Mail className="h-10 w-10 text-accent mx-auto mb-4" />
        <h1 className="text-3xl font-bold tracking-tight mb-2">Reset Password</h1>
        <p className="text-muted text-sm">Enter your email to receive a reset link</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          placeholder="Email"
          className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          autoFocus
          required
        />
        {error && <p className="text-sm text-red-400 pl-1">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <Link to="/login" className="mt-4 text-sm text-accent hover:underline">
        Back to login
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Create reset password page**

```typescript
// packages/web/src/pages/ResetPassword.tsx
import { useState, FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authResetPassword } from '@/lib/api';
import { Lock } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authResetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center px-6 mt-32 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Invalid Link</h1>
        <p className="text-muted text-sm">This password reset link is invalid or has expired.</p>
        <Link to="/forgot-password" className="mt-4 text-sm text-accent hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center px-6 mt-32 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Password Reset!</h1>
        <p className="text-muted text-sm">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 mt-32">
      <div className="mb-8 text-center">
        <Lock className="h-10 w-10 text-accent mx-auto mb-4" />
        <h1 className="text-3xl font-bold tracking-tight mb-2">New Password</h1>
        <p className="text-muted text-sm">Enter your new password</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
          placeholder="New password (min 8 characters)"
          className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          autoFocus
          required
          minLength={8}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(''); }}
          placeholder="Confirm new password"
          className="w-full rounded-xl border border-border bg-surface py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          required
        />
        {error && <p className="text-sm text-red-400 pl-1">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/pages/ForgotPassword.tsx packages/web/src/pages/ResetPassword.tsx
git commit -m "feat(web): add forgot password and reset password pages"
```

---

## Task 24: Frontend — Account Settings Page

**Files:**
- Create: `packages/web/src/pages/AccountSettings.tsx`

- [ ] **Step 1: Create account settings page**

```typescript
// packages/web/src/pages/AccountSettings.tsx
import { useState, FormEvent } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { authChangePassword } from '@/lib/api';
import { User } from 'lucide-react';

export default function AccountSettings() {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authChangePassword(oldPassword, newPassword);
      setSuccess('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <User className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
      </div>

      <div className="rounded-xl border border-border/50 bg-surface/50 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Profile</h2>
        <p className="text-sm text-muted">
          Email: <span className="text-foreground">{user?.email}</span>
        </p>
        <p className="text-sm text-muted">
          Role: <span className="text-foreground capitalize">{user?.role}</span>
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-surface/50 p-6">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => { setOldPassword(e.target.value); setError(''); setSuccess(''); }}
            placeholder="Current password"
            className="w-full rounded-xl border border-border bg-background py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setError(''); setSuccess(''); }}
            placeholder="New password (min 8 characters)"
            className="w-full rounded-xl border border-border bg-background py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            required
            minLength={8}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(''); setSuccess(''); }}
            placeholder="Confirm new password"
            className="w-full rounded-xl border border-border bg-background py-3 px-4 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-400">{success}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/AccountSettings.tsx
git commit -m "feat(web): add account settings page"
```

---

## Task 25: Frontend — Admin Panel Page

**Files:**
- Create: `packages/web/src/pages/AdminPanel.tsx`

- [ ] **Step 1: Create admin panel page**

```typescript
// packages/web/src/pages/AdminPanel.tsx
import { useState, useEffect } from 'react';
import { getAdminUsers, deleteAdminUser, updateAdminUserRole, type AdminUser } from '@/lib/api';
import { Shield, Trash2 } from 'lucide-react';

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadUsers() {
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteAdminUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRoleToggle(user: AdminUser) {
    const newRole = user.role === 'superadmin' ? 'user' : 'superadmin';
    try {
      await updateAdminUserRole(user.id, newRole);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12 text-center text-muted">Loading users...</div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        <span className="text-sm text-muted ml-auto">{users.length} users</span>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface/50 border-b border-border/50">
              {users[0]?.email !== undefined && <th className="px-4 py-3 text-left font-medium text-muted">Email</th>}
              <th className="px-4 py-3 text-left font-medium text-muted">Role</th>
              {users[0]?.last_login_at !== undefined && <th className="px-4 py-3 text-left font-medium text-muted">Last Login</th>}
              {users[0]?.daily_scans !== undefined && <th className="px-4 py-3 text-left font-medium text-muted">Today's Scans</th>}
              {users[0]?.scanned_pages !== undefined && <th className="px-4 py-3 text-left font-medium text-muted">Scanned Pages</th>}
              <th className="px-4 py-3 text-left font-medium text-muted">Joined</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border/30 hover:bg-surface/30">
                {user.email !== undefined && <td className="px-4 py-3">{user.email}</td>}
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    user.role === 'superadmin' ? 'bg-accent/15 text-accent' : 'bg-surface-light text-muted'
                  }`}>
                    {user.role}
                  </span>
                </td>
                {user.last_login_at !== undefined && (
                  <td className="px-4 py-3 text-muted">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                )}
                {user.daily_scans !== undefined && <td className="px-4 py-3">{user.daily_scans}</td>}
                {user.scanned_pages !== undefined && (
                  <td className="px-4 py-3 text-muted text-xs max-w-48 truncate">
                    {user.scanned_pages?.join(', ') || '—'}
                  </td>
                )}
                <td className="px-4 py-3 text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => handleRoleToggle(user)}
                    className="text-xs text-accent hover:underline"
                  >
                    {user.role === 'superadmin' ? 'Demote' : 'Promote'}
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/AdminPanel.tsx
git commit -m "feat(web): add admin panel page"
```

---

## Task 26: Frontend — Demo Page

**Files:**
- Create: `packages/web/src/pages/Demo.tsx`

- [ ] **Step 1: Create demo results page**

```typescript
// packages/web/src/pages/Demo.tsx
import { useState, useEffect } from 'react';
import { getDemoScan, type HistoricalScan } from '@/lib/api';
import ResultGrid from '@/components/results/ResultGrid';
import { Eye } from 'lucide-react';

export default function Demo() {
  const [scan, setScan] = useState<HistoricalScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDemoScan()
      .then(setScan)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12 text-center text-muted">Loading demo scan...</div>
    );
  }

  if (error || !scan) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12 text-center">
        <Eye className="h-10 w-10 text-muted mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">No Demo Available</h1>
        <p className="text-muted text-sm">A demo scan will appear here once the daily scan runs.</p>
      </div>
    );
  }

  const results: Record<string, any> = {};
  for (const r of scan.results) {
    results[r.handler] = r.result;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Demo Scan</h1>
        <p className="text-muted text-sm">
          Read-only results for <span className="text-accent">{scan.url}</span>
          {' · '}
          <span>{new Date(scan.created_at).toLocaleDateString()}</span>
        </p>
      </div>
      <ResultGrid results={results} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/Demo.tsx
git commit -m "feat(web): add read-only demo scan page"
```

---

## Task 27: Frontend — Nav Gear Menu

**Files:**
- Rewrite: `packages/web/src/components/layout/Nav.tsx`

- [ ] **Step 1: Replace Settings link with gear icon dropdown**

Rewrite `Nav.tsx` — replace the `<NavLink to="/settings" ...>` with a gear dropdown. Keep the existing theme switcher and GitHub link. The gear dropdown logic:

```typescript
// Add to imports:
import { useAuth } from '@/hooks/use-auth';
import { Settings, LogOut, User, Shield as ShieldIcon } from 'lucide-react';

// Inside Nav component, add:
const { isAuthenticated, user, logout, authConfig } = useAuth();
const navigate = useNavigate();
const [showGear, setShowGear] = useState(false);
const gearRef = useRef<HTMLDivElement>(null);

// Close gear dropdown on click outside (same pattern as theme)
useEffect(() => {
  if (!showGear) return;
  const handleClick = (e: MouseEvent) => {
    if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
      setShowGear(false);
    }
  };
  document.addEventListener('mousedown', handleClick);
  return () => document.removeEventListener('mousedown', handleClick);
}, [showGear]);
```

Replace the Settings NavLink with:

```tsx
{/* Gear menu */}
<div className="relative" ref={gearRef}>
  <button
    onClick={() => setShowGear(!showGear)}
    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-surface-light/50 transition-colors"
    title="Settings"
  >
    <Settings className="h-4 w-4" />
  </button>

  {showGear && (
    <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-surface p-2 shadow-2xl animate-fade-in z-50">
      {isAuthenticated ? (
        <>
          <GearItem
            icon={User}
            label="Account"
            onClick={() => { navigate('/account'); setShowGear(false); }}
          />
          <GearItem
            icon={Settings}
            label="Settings"
            onClick={() => { navigate('/settings'); setShowGear(false); }}
          />
          {user?.role === 'superadmin' && (
            <GearItem
              icon={ShieldIcon}
              label="Admin Panel"
              onClick={() => { navigate('/admin'); setShowGear(false); }}
            />
          )}
          <hr className="my-1.5 border-border/30" />
          <GearItem
            icon={LogOut}
            label="Log out"
            onClick={() => { logout(); navigate('/'); setShowGear(false); }}
          />
        </>
      ) : authConfig?.provider ? (
        <>
          <GearItem
            icon={User}
            label="Log in"
            onClick={() => { navigate('/login'); setShowGear(false); }}
          />
          {authConfig.registrationOpen && (
            <GearItem
              icon={User}
              label="Sign up"
              onClick={() => { navigate('/signup'); setShowGear(false); }}
            />
          )}
          <hr className="my-1.5 border-border/30" />
          <GearItem
            icon={Settings}
            label="Settings"
            onClick={() => { navigate('/settings'); setShowGear(false); }}
          />
        </>
      ) : (
        <GearItem
          icon={Settings}
          label="Settings"
          onClick={() => { navigate('/settings'); setShowGear(false); }}
        />
      )}
    </div>
  )}
</div>
```

Add helper component at bottom of file:

```typescript
function GearItem({ icon: Icon, label, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface-light/50 transition-colors text-left"
    >
      <Icon className="h-4 w-4 text-muted" />
      {label}
    </button>
  );
}
```

Add `useNavigate` import from `react-router-dom`.

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/layout/Nav.tsx
git commit -m "feat(web): replace settings link with gear icon dropdown menu"
```

---

## Task 28: Frontend — Homepage Conditional Content

**Files:**
- Modify: `packages/web/src/pages/Home.tsx`

- [ ] **Step 1: Add auth-aware conditional rendering**

Add imports at top:

```typescript
import { useAuth } from '@/hooks/use-auth';
import { Link } from 'react-router-dom';
```

Inside the `Home` component, add:

```typescript
const { isAuthenticated, authConfig, scanLimits } = useAuth();
const authEnabled = !!authConfig?.provider;
```

Wrap the search form section with a conditional:

```tsx
{/* Scan form — shown when logged in or auth disabled */}
{(!authEnabled || isAuthenticated) ? (
  <>
    {/* Scan limit indicator */}
    {scanLimits?.user_daily && (
      <div className="mb-4 text-sm text-muted animate-fade-in">
        <span className={scanLimits.user_daily.remaining <= 3 ? 'text-yellow-400' : ''}>
          {scanLimits.user_daily.remaining}/{scanLimits.user_daily.limit} scans remaining today
        </span>
      </div>
    )}

    {/* Existing search form */}
    <form ...>
      ...
    </form>
  </>
) : (
  /* Auth CTA — shown when auth is enabled but user is not logged in */
  <div className="w-full max-w-xl mb-8 animate-fade-in text-center" style={{ animationDelay: '100ms' }}>
    <div className="flex gap-3 justify-center">
      <Link
        to="/signup"
        className="rounded-xl bg-accent px-8 py-3.5 text-[15px] font-semibold text-background hover:bg-accent-hover transition-colors"
      >
        Sign Up
      </Link>
      <Link
        to="/demo"
        className="rounded-xl border border-border px-8 py-3.5 text-[15px] font-semibold text-foreground hover:bg-surface-light/50 transition-colors"
      >
        View Demo
      </Link>
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/Home.tsx
git commit -m "feat(web): add auth-aware homepage with sign-up CTA and scan limits"
```

---

## Task 29: Frontend — Update App Router

**Files:**
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: Add all new routes with guards**

```typescript
// packages/web/src/App.tsx
import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import Home from "@/pages/Home";
import Results from "@/pages/Results";
import HistoryResults from "@/pages/HistoryResults";
import History from "@/pages/History";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AccountSettings from "@/pages/AccountSettings";
import AdminPanel from "@/pages/AdminPanel";
import Demo from "@/pages/Demo";
import Settings from "@/pages/Settings";
import Compare from "@/pages/Compare";
import NotFound from "@/pages/NotFound";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { RequireAuth, RequireSuperadmin } from "@/components/auth/RouteGuard";
import { getAuthConfig, getMe } from "@/lib/api";

function AppRoutes() {
  const { setAuthConfig, isAuthenticated, setScanLimits } = useAuth();

  // Fetch auth config on mount
  useEffect(() => {
    getAuthConfig()
      .then(setAuthConfig)
      .catch(() => { /* Auth not configured — that's fine */ });
  }, [setAuthConfig]);

  // Fetch user profile + scan limits when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    getMe()
      .then((me) => { if (me.scanLimits) setScanLimits(me.scanLimits); })
      .catch(() => {});
  }, [isAuthenticated, setScanLimits]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/results/:url" element={<RequireAuth><Results /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
      <Route path="/history/:scanId" element={<RequireAuth><HistoryResults /></RequireAuth>} />
      <Route path="/compare/:id1/:id2" element={<RequireAuth><Compare /></RequireAuth>} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/account" element={<RequireAuth><AccountSettings /></RequireAuth>} />
      <Route path="/admin" element={<RequireSuperadmin><AdminPanel /></RequireSuperadmin>} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background text-foreground">
          <Nav />
          <main>
            <AppRoutes />
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/App.tsx
git commit -m "feat(web): add auth routes, guards, and auth config loading"
```

---

## Task 30: Frontend — Update Settings Page

**Files:**
- Modify: `packages/web/src/pages/Settings.tsx`

- [ ] **Step 1: Remove old auth config section**

Remove the `authConfig` array and the `<ConfigSection title="Authentication" items={authConfig} />` call from Settings.tsx since auth is no longer configured via env display — it's a proper system now.

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/pages/Settings.tsx
git commit -m "refactor(web): remove old bearer token auth config from settings"
```

---

## Task 31: Build Verification

- [ ] **Step 1: Run TypeScript type checks for both packages**

```bash
cd packages/api && npm run typecheck
cd ../web && npm run typecheck
```

Fix any type errors.

- [ ] **Step 2: Run existing tests**

```bash
cd packages/api && npm test
cd ../web && npm test
```

Fix any broken tests.

- [ ] **Step 3: Test build**

```bash
cd packages/api && npm run build
cd ../web && npm run build
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type errors and test failures from auth implementation"
```

---

## Task 32: Manual Smoke Test

- [ ] **Step 1: Start the API in dev mode with local auth**

Create a test `.env` with:

```env
AUTH_PROVIDER=local
JWT_SECRET=test-secret-key-at-least-32-characters-long
REGISTRATION_OPEN=true
DAILY_SCAN_LIMIT_USER=5
DEMO_SCAN_URL=https://example.com
```

```bash
cd packages/api && npm run dev
```

- [ ] **Step 2: Create a superadmin via CLI**

```bash
cd packages/cli && npx tsx src/index.ts create-admin --email admin@test.com --password TestPassword123
```

- [ ] **Step 3: Test auth endpoints via curl**

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@test.com","password":"TestPassword123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@test.com","password":"TestPassword123"}'

# Get profile (use token from login response)
curl http://localhost:3000/api/auth/me \
  -H 'Authorization: Bearer <access_token>'

# Demo endpoint
curl http://localhost:3000/api/demo

# Auth config
curl http://localhost:3000/api/auth/config
```

- [ ] **Step 4: Test frontend**

```bash
cd packages/web && npm run dev
```

Open browser, verify:
1. Homepage shows Sign Up + View Demo buttons
2. Sign Up flow works
3. Login flow works
4. Scan limit badge shows after login
5. Gear menu shows correct items
6. Admin panel accessible for superadmin
7. Settings page no longer shows old auth section
