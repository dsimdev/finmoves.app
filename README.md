# FinMoves

Personal finance manager for Argentina. Track movements, monitor your investment reserve and analyze spending by period.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Firebase** — Auth (email/password) + Firestore (real-time database)
- **Zustand** — global state persisted in localStorage
- **Tailwind v4** — styles with custom CSS variables
- **Google Sheets** — optional mirror of movements
- **Vercel** — automatic deploy from `main`

## Sections

### Home — Dashboard
Active period summary: Sueldo, Gastado, Ahorros and Retiros KPIs; expense progress bar; latest movements grouped by date.

### Movements (`/movimientos`)
Full CRUD for movements, grouped by date with day headers. Supported types:

| Type | Description |
|------|-------------|
| `Gasto` | Expense in ARS |
| `Ingreso` | Income (salary or other) |
| `Move` | Internal transfer (savings → available) |
| `CompraUSD` | USD purchase (records amount + exchange rate) |
| `GastoUSD` | USD expense |
| `CompraEUR` | EUR purchase (records amount + exchange rate) |
| `GastoEUR` | EUR expense |

Each movement has: date, category, description, amount, payment method, notes and the period it belongs to. Notes are shown inline in lowercase italic.

### Investment (`/inversion`)
USD or EUR reserve tracking:
- Total reserve and average purchase price
- ARS gain/loss on investment
- Blue and official exchange rates in real time (with cache fallback)
- Savings goal with target date, progress bar and periods-to-goal projection
- 3-period ARS savings projection
- Purchase history

### Reports (`/reportes`)
Period analysis with configurable toggles per section. Tabs:
- **Gastos**: KPIs (total, average, daily pace, trend), by category, by description, by payment method, by date, period comparison
- **Ingresos**: total income, salary evolution, by category, by description, savings breakdown
- **Movimientos**: movement frequency KPIs by type, top descriptions, by category, by day of week, by payment method
- **Períodos**: historical series chart, comparative KPIs (best/worst period, average), income evolution

### Settings (`/config`)
- Categories, payment methods and savings origins (CRUD)
- Preferences: dark/light mode, enable Reports section, enable Investment section
- **Auto-savings**: toggle + fixed ARS amount; when active, every Gasto automatically creates an `Ingreso / Ahorros` movement for the configured amount
- Investment currency: USD or EUR
- Manual sync with Google Sheets

## Periods

Movements are grouped into periods with a start/end date and declared salary. The active period is the main unit of analysis. Report KPIs compare periods against each other. Period and year selectors support multi-select (long press) for cross-period analysis.

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

`v1.14.5` — see [CHANGELOG.md](./CHANGELOG.md) for the full history.
