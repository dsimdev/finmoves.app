# FinMoves

Personal finance manager for Argentina. Track movements, monitor your dollar investment and analyze trends by period.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Firebase** — Auth (email/password) + Firestore (real-time database)
- **Zustand** — global state persisted in localStorage
- **Tailwind v4** — styles with custom CSS variables
- **Google Sheets** — optional mirror of movements
- **Vercel** — automatic deploy from `main`

## Sections

### Home — Dashboard
Active period summary: available vs salary, expense progress bar, latest movements and total accumulated savings.

### Movements
Full CRUD for movements. Supported types:

| Type | Description |
|------|-------------|
| `Gasto` | Expense in ARS |
| `Ingreso` | Income (salary or other) |
| `Move` | Internal transfer between accounts |
| `CompraUSD` | USD purchase (records amount + exchange rate) |
| `GastoUSD` | USD expense |
| `CompraEUR` | EUR purchase (records amount + exchange rate) |
| `GastoEUR` | EUR expense |

Each movement has: date, category, description, amount, payment method, notes and the period it belongs to.

### Investment
USD or EUR reserve tracking:
- Total reserve and average purchase price
- ARS gain/loss on investment
- Blue and official exchange rates in real time (with cache fallback)
- Savings goal with target date and progress
- Monthly goal per period
- Purchase history

### Reports
Period analysis with configurable toggles per section:
- **Expenses**: KPIs (total, average, daily pace), by category, by description, by payment method, by date, period comparison
- **Income**: total income, by category, origin breakdown
- **Periods**: historical series, comparative KPIs
- **Trends**: expense projection, salary evolution, USD savings projection, goal progress

### Settings
- Categories, payment methods and savings origins (CRUD)
- Preferences: dark/light mode, enable Reports section, enable Investment section
- Investment currency: USD or EUR
- Manual sync with Google Sheets

## Periods

Movements are grouped into periods with a start/end date and declared salary. The active period is the main unit of analysis. Report KPIs compare periods against each other.

## Google Sheets Sync

The app is the source of truth. On sync, it overwrites the `Movimientos` sheet of the configured spreadsheet, keeping up to 5 automatic backups as tabs named by date (Argentina time).

## Theme

Light mode by default, with dark mode toggle. Color variables are applied without flash via inline script in `<head>`. No theme library dependency.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase public configuration |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin service account (for API routes) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Sheets service account |
| `GOOGLE_SPREADSHEET_ID` | Target spreadsheet ID |
| `NEXT_PUBLIC_APP_VERSION` | Auto-generated from `package.json` via `next.config.ts` |

## Deploy

```bash
# Local development
npm run dev

# Release to production
git checkout main
# ... changes ...
git commit && git push origin main
git tag vX.X.X
git push origin main --tags
```

Vercel deploys automatically from `main`. Rollback via Vercel dashboard or `git reset --hard vX.X.X` + force push.

## Current Version

`v1.12.0` — see [CHANGELOG.md](./CHANGELOG.md) for the full history.
