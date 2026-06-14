# FinMoves

Personal finance manager for Argentina. Track movements, monitor your investment reserve and analyze spending by period. Installable PWA, live at **[finmoves.app](https://finmoves.app)**.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Firebase App Hosting** (Cloud Run) — automatic deploy from `main`, scale-to-zero
- **Firebase** — Auth (email/password) + Firestore (real-time database) + Admin SDK
- **Cloud Scheduler** — daily cron (Sheets sync + push notifications)
- **Web Push** (VAPID) + Badging API — notifications and app-icon badge
- **Zustand** — global state persisted in localStorage
- **Tailwind v4** — styles with custom CSS variables
- **Google Sheets** — optional mirror of movements

## Sections

### Home — Resumen (`/`)
Active period summary: Sueldo, Gastado, Ahorros and Retiros KPIs; expense progress bar; latest movements; quick-action shortcuts. Add/edit movements via a modal without leaving Home.

### Movements (`/movements`)
Full CRUD for movements, grouped by date. Tap a row to edit. Supported types:

| Type | Description |
|------|-------------|
| `Gasto` | Expense in ARS |
| `Ingreso` | Income — `Sueldo` (anchors a period) or `Ahorros` |
| `Move` | Internal transfer (savings → available) |
| `CompraUSD` / `GastoUSD` | USD purchase / expense |
| `CompraEUR` / `GastoEUR` | EUR purchase / expense |

**Periods**: a `Sueldo` opens a period. For the owner (and the first-ever salary) it always opens a new one; other users choose **"Add to current / New period"**. Opening a new period carries the previous period's leftover into the new one as a `RESTO` movement (counts as Savings).

### Investment (`/investments`)
USD or EUR reserve tracking: total reserve, average purchase price, ARS gain/loss, blue/official rates (with cache fallback), savings goal with target date and projection, purchase history.

### Reports (`/reports`)
Per-period analysis with toggles. Tabs: **Gastos**, **Ingresos**, **Movimientos**, **Períodos**.

### Settings (`/settings`)
Profile (name, password change with reauth + relogin, language), categories/payment methods/savings origins (CRUD), dark/light, section toggles, auto-savings, biometric unlock, push notifications, investment currency, install button, Google Sheets sync, invite codes (owner), backup export.

## Performance

A single `DataProvider` in the tabs layout fetches movements + config **once per session** and shares them across all tabs (no re-fetch on tab switch).

## Security

- Firestore rules: per-user isolation (`request.auth.uid == userId`) + default deny. `inviteCodes` only via Admin SDK.
- API routes verify Firebase ID tokens; owner-only routes check `OWNER_UID`; cron uses `CRON_SECRET`.
- Signup closed: accounts created only via one-use invite codes (atomic reservation).
- Security headers incl. HSTS and a production `Content-Security-Policy`.

## Environment Variables

Managed via **Cloud Secret Manager** (referenced in `apphosting.yaml`). Local dev reads `.env.local`.

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | build+runtime | Firebase web config (public) |
| `NEXT_PUBLIC_OWNER_EMAIL` / `NEXT_PUBLIC_OWNER_UID` | build+runtime | Owner identity for client gating |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | build+runtime | Web Push public key |
| `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | runtime | Web Push private key |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | runtime | Firebase Admin credentials |
| `GOOGLE_SHEETS_CREDENTIALS` / `GOOGLE_SPREADSHEET_ID` | runtime | Google Sheets sync |
| `CRON_SECRET` | runtime | Bearer token for the Cloud Scheduler cron |
| `OWNER_UID` | runtime | Owner UID for owner-only server logic |
| `NEXT_PUBLIC_APP_VERSION` | build | Auto-injected from `package.json` via `next.config.ts` |

## Deploy

**Firebase App Hosting auto-builds from `main`.** Every release MUST follow this checklist:

```
1. Make changes; `npm run build` passes.
2. Bump version in package.json (semver: feat→minor, fix→patch, milestone→major).
3. Update CHANGELOG.md (technical, EN) — new [x.y.z] section.
4. Update CHANGELOG_USER.md (user-facing, ES).
5. Update README.md "Current Version" (+ any changed facts).
6. git add -A && git commit && git push origin main
7. git tag vX.Y.Z && git push origin vX.Y.Z
8. Verify the App Hosting build is live at finmoves.app.
```

Rollback: `git reset --hard vX.Y.Z` + push, or redeploy a previous build from the App Hosting console.

## Current Version

`v2.1.2` — see [CHANGELOG.md](./CHANGELOG.md) for the full history.
