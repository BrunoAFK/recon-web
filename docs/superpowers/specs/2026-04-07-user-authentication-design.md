# User Authentication System — Design Spec

## Overview

Replace the existing bearer-token authentication with a full user account system supporting registration, login, password recovery, role-based access, and daily scan limits. Two auth providers are supported: self-hosted (bcrypt + SQLite + JWT) and Firebase Auth. Only one provider is active at a time, configured via environment variable.

---

## 1. Auth Provider Architecture

### Configuration

```env
AUTH_PROVIDER=local                    # "local" | "firebase"

# Firebase-only settings
FIREBASE_PROJECT_ID=
FIREBASE_API_KEY=
FIREBASE_SERVICE_ACCOUNT_PATH=
```

### Provider Interface

Both providers implement the same `AuthProvider` interface so the rest of the codebase is provider-agnostic:

```typescript
interface AuthProvider {
  register(email: string, password: string): Promise<AuthResult>
  login(email: string, password: string): Promise<AuthResult>
  logout(userId: string): Promise<void>
  verifyToken(token: string): Promise<TokenPayload>
  forgotPassword(email: string): Promise<void>
  resetPassword(token: string, newPassword: string): Promise<void>
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>
}

interface AuthResult {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string; role: string }
}

interface TokenPayload {
  userId: string
  email: string
  role: string
}
```

### Local Provider

- Password hashing: bcrypt (cost factor 12)
- Access tokens: JWT (short-lived, e.g. 15 min)
- Refresh tokens: opaque token stored in DB, rotated on use
- Password reset: random token with expiration, sent via existing SMTP config

### Firebase Provider

- Frontend uses Firebase JS SDK for login/signup UI
- Backend uses Firebase Admin SDK to verify ID tokens
- No password storage on our side
- Password reset handled by Firebase's built-in flow
- User profile/role synced to `user_profiles` table on first login

---

## 2. Database Schema

### `users` table (local provider only)

```sql
CREATE TABLE users (
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
```

### `user_profiles` table (both providers)

Stores role, settings, and metadata regardless of provider:

```sql
CREATE TABLE user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  settings JSON NOT NULL DEFAULT '{}',
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `scans` table — modification

Add `user_id` column to associate scans with users:

```sql
ALTER TABLE scans ADD COLUMN user_id TEXT REFERENCES user_profiles(id);
```

Existing scans (pre-auth) will have `user_id = NULL`. Demo scans also have `user_id = NULL`.

---

## 3. Roles

Two roles: **user** and **superadmin**.

| Capability | user | superadmin |
|---|---|---|
| Run scans | Yes | Yes |
| View own scan history | Yes | Yes |
| View all users' scans | No | Yes |
| View user list / admin panel | No | Yes |
| Delete own scans | Yes | Yes |
| Delete any scan | No | Yes |
| Change own settings | Yes | Yes |

---

## 4. Superadmin Configuration

Each column in the admin user list is individually toggleable:

```env
SUPERADMIN_VIEW_EMAIL=true
SUPERADMIN_VIEW_LAST_LOGIN=true
SUPERADMIN_VIEW_DAILY_SCANS=true
SUPERADMIN_VIEW_SCANNED_PAGES=true
```

All default to `true`. The `GET /api/admin/users` endpoint respects these flags and omits disabled fields from the response.

---

## 5. Superadmin Creation — CLI

```bash
npx recon-web create-admin --email admin@example.com --password SecurePass123!
```

- Only works with `AUTH_PROVIDER=local`
- Creates user with `role=superadmin` in both `users` and `user_profiles` tables
- If email already exists, promotes to superadmin
- For Firebase: superadmin is assigned by updating `role` in `user_profiles` table directly or via a future `promote-admin` CLI command that takes a Firebase UID

---

## 6. Daily Scan Limits

### Configuration

```env
DAILY_SCAN_LIMIT_GLOBAL=0     # 0 = unlimited
DAILY_SCAN_LIMIT_USER=0       # 0 = unlimited
```

### Enforcement

Before each scan, the API checks:
1. Global daily count (all users combined) against `DAILY_SCAN_LIMIT_GLOBAL`
2. Current user's daily count against `DAILY_SCAN_LIMIT_USER`

If either limit is reached, return `429 Too Many Requests`.

Daily counts reset at midnight UTC.

### Visibility

**API responses** on scan endpoints include limit info:

```json
{
  "scan_limits": {
    "user_daily": { "used": 3, "limit": 10, "remaining": 7 },
    "global_daily": { "used": 45, "limit": 100, "remaining": 55 }
  }
}
```

When limit is `0` (unlimited), that category is omitted from the response.

**`GET /api/auth/me`** also returns current scan limits so the frontend can display them before a scan is triggered.

**Frontend** displays a badge/indicator on the scan page (e.g. "7/10 scans remaining today"). Hidden when unlimited.

---

## 7. Registration Control

```env
REGISTRATION_OPEN=true     # true = anyone can register, false = closed
```

When `false`, `POST /api/auth/register` returns `403 Forbidden`. Sign Up button is hidden on frontend. Only superadmin can create users (future: invite flow).

---

## 8. Demo Scan

```env
DEMO_SCAN_URL=https://example.com
```

- Uses existing scheduler infrastructure to run one scan per day against the configured URL
- Result stored as a scan with `user_id = NULL` (system scan)
- Publicly accessible at `GET /api/demo` without authentication
- Frontend "View Demo" button links to a read-only results page for this scan

---

## 9. API Endpoints

### Auth endpoints (public)

```
POST /api/auth/register        — create account (if REGISTRATION_OPEN=true)
POST /api/auth/login           — returns access + refresh tokens
POST /api/auth/refresh         — exchange refresh token for new access token
POST /api/auth/forgot-password — sends reset email
POST /api/auth/reset-password  — reset password with token
```

### Auth endpoints (authenticated)

```
GET  /api/auth/me              — current user profile, settings, scan limits
PUT  /api/auth/me              — update profile (email, settings)
POST /api/auth/change-password — change password (requires old password)
POST /api/auth/logout          — invalidate refresh token
```

### Admin endpoints (superadmin only)

```
GET    /api/admin/users        — list users (fields filtered by env config)
DELETE /api/admin/users/:id    — delete user
PUT    /api/admin/users/:id    — update user role
```

### Existing endpoints — modifications

- `POST /api` and `POST /api/stream` — require auth, associate scan with user, return `scan_limits` in response
- `GET /api/history` — returns only current user's scans (superadmin can pass `?all=true`)
- `GET /api/demo` — new, public, no auth required

### Public endpoints (no auth required)

```
GET  /health
GET  /api/handlers
GET  /api/demo
GET  /docs
```

---

## 10. Frontend Changes

### Gear Icon Menu (replaces Settings nav link)

Gear icon always visible in header. On click opens dropdown:

**Not logged in:**
- Login
- Sign Up (if `REGISTRATION_OPEN=true`)
- Settings (theme only, localStorage)

**Logged in:**
- Account Settings (email, password change)
- Settings (theme, preferences — saved to DB via `PUT /api/auth/me`)
- Admin Panel (superadmin only)
- Logout

### Homepage (auth enabled, not logged in)

- Hero section with product description
- "Sign Up" primary button
- "View Demo" secondary button → navigates to read-only demo results page
- No URL input visible

### Homepage (logged in or auth disabled)

- Normal URL input and scan functionality (current behavior)
- Scan limit indicator when limits are active

### New Pages/Components

- **Login page** — email + password form (already exists, needs update)
- **Sign Up page** — email + password + confirm password
- **Forgot Password page** — email input, sends reset link
- **Reset Password page** — new password form (accessed via email link)
- **Account Settings page** — change email, change password
- **Admin Panel page** — user list table with configurable columns, daily stats
- **Demo Results page** — read-only scan results view

### Route Guards

Protected routes redirect to `/login` when auth is enabled and user is not authenticated. Public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/demo`.

---

## 11. Environment Variables — Complete List

```env
# Auth Provider
AUTH_PROVIDER=local                     # "local" | "firebase"

# Firebase (when AUTH_PROVIDER=firebase)
FIREBASE_PROJECT_ID=
FIREBASE_API_KEY=
FIREBASE_SERVICE_ACCOUNT_PATH=

# Registration
REGISTRATION_OPEN=true

# Scan Limits (0 = unlimited)
DAILY_SCAN_LIMIT_GLOBAL=0
DAILY_SCAN_LIMIT_USER=0

# Superadmin Panel Visibility
SUPERADMIN_VIEW_EMAIL=true
SUPERADMIN_VIEW_LAST_LOGIN=true
SUPERADMIN_VIEW_DAILY_SCANS=true
SUPERADMIN_VIEW_SCANNED_PAGES=true

# Demo
DEMO_SCAN_URL=https://example.com

# SMTP (existing, used for password reset emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

---

## 12. Security Considerations

- Passwords hashed with bcrypt (cost 12)
- JWT access tokens short-lived (15 min) to limit exposure
- Refresh token rotation — old token invalidated on use
- Timing-safe comparison for token verification (existing pattern)
- Rate limiting on auth endpoints (existing Fastify rate-limit plugin)
- Password reset tokens expire after 1 hour
- Minimum password length: 8 characters
- CSRF protection not needed (API uses Authorization header, not cookies)

---

## 13. Migration Path

- Existing bearer token auth (`AUTH_TOKEN`) is removed
- If `AUTH_PROVIDER` is not set, authentication is disabled (backward compatible)
- Existing scans in DB get `user_id = NULL` — accessible to superadmin only
- `.env.example` updated with all new variables
