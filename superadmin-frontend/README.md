# Exam Neeti — Super Admin Console

A standalone Next.js application for the **root system administrator** only —
deliberately separate from the main student/admin frontend (`../frontend`) so
this console can be deployed on its own domain/subdomain, given its own access
controls, and never share a JS bundle with the public-facing site.

It talks to the **same Express backend** as the main frontend — no backend
changes were needed for this app to exist.

## Why a separate app

- **Blast radius.** A bug or dependency vulnerability in the public marketing
  site's bundle can't reach this console, and vice versa.
- **Access control at the infra layer.** This app can be put behind its own
  auth wall / IP allowlist / VPN at the hosting layer, independent of the
  public site.
- **Independent deploys.** Ship a governance feature here without touching
  (or re-testing) the student-facing app, and vice versa.

## What's here

- `src/app/login` — Super-Admin-only sign-in. Any other role (student, admin)
  is explicitly rejected here with a message pointing back to the main site.
- `src/app/dashboard` — the actual console (migrated from
  `frontend/src/components/sections/SuperAdminDashboard.tsx`): admin team
  management, question bank, platform audit trail, governance/purge tools,
  security settings.
- `src/middleware.ts` — edge route guard. Anything other than `/login`
  requires an `auth-role=super_admin` cookie, or it redirects to `/login`.
- `src/store`, `src/services`, `src/components/common`, `src/components/admin`
  — copied from the main frontend (same API client, same auth store shape,
  same shared UI/icon primitives, same question-bank admin panels) so the
  migrated dashboard code works unmodified. If you change one of these in the
  main frontend and the change matters here too, port it over manually — the
  two apps do not share a build.

## Local development

```bash
npm install
cp .env.example .env   # already done once; edit NEXT_PUBLIC_API_URL if your backend runs elsewhere
npm run dev
```

Runs on `http://localhost:3100` by default (see `package.json` — set to avoid
colliding with the main frontend's `3000`). Visit `/login` and sign in with a
`super_admin` account (seeded via `npm run seed:admin` in `backend/`, which
runs `backend/seedAdmin.js` — super admin accounts are never created through
any public API, only through this one-time bootstrap script).

## Production checklist

- [x] Security headers (`next.config.ts`): `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
      restrictive `Permissions-Policy`, `X-Robots-Tag: noindex, nofollow` (this
      app must never appear in search results).
- [x] Route guard middleware — no dashboard route renders without a
      `super_admin` cookie; double-checked again client-side against the
      hydrated auth store before the dashboard mounts.
- [x] Global error boundary (`src/app/error.tsx`) and custom 404
      (`src/app/not-found.tsx`).
- [x] `npm run type-check` and `npm run lint` both pass clean.
- [ ] Point `NEXT_PUBLIC_API_URL` at the production backend URL via your
      hosting provider's environment variables — never commit a production
      `.env`.
- [ ] Deploy behind its own subdomain (e.g. `admin.examneeti.com`) and,
      ideally, an additional network-level restriction (IP allowlist / VPN /
      hosting-provider access control) — this console can suspend admin
      accounts and purge platform data, so defense-in-depth beyond the app's
      own auth is strongly recommended before go-live.

## Scripts

| Command              | Description                     |
|-----------------------|----------------------------------|
| `npm run dev`         | Start the dev server             |
| `npm run build`       | Production build                 |
| `npm run start`       | Start the production server      |
| `npm run lint`        | ESLint                           |
| `npm run type-check`  | `tsc --noEmit`                   |
