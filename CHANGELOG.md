# Changelog

All notable changes to FinMoves are documented here.

---

## [2.58.2] — 2026-07-04

### Fixed
- **Double-back-to-exit on Home**: the history "trap" is now pushed unconditionally on each root tab, so the first back on Home is captured and shows the exit toast. The previous `history.state.__fmTrap` guard was fooled by state persisted on the current entry when the PWA reopens (`launch_handler: navigate-existing`), so no trap was above and a single back exited without warning. Known residual: navigating across several tabs can leave history residue, so exiting may need an extra back — to be refined with trap-aware tab navigation.

### Added
- **Unit tests (Vitest)**: 34 tests over the pure logic — `components/reports/format` (`abbr`, `colorPct`/`colorPctDim`, `deltaMag`/`deltaColor`, date helpers), `utils/reserva` (`reservaFX`, `calcularReserva`, `tiposReserva`), `utils/periodo` (`agruparPorPeriodo`, `gastosPorCategoria`, `formatARS`), `utils/reportes` (`parsePeriodoId`, `estadisticasPeriodos`, `ritmoGasto`). `npm test` / `npm run test:watch`. Dev-only, no runtime or bundle impact.

---

## [2.58.1] — 2026-07-04

### Changed
- **Double-back-to-exit reworked (native Android pattern)**: the 2.58.0 version misfired under mixed navigation (tabs `replace`, subpages `push`, modals). Rebuilt in `hooks/useBackButton.ts` (replaces `useBackExit`) with a home-routing model: back on a non-home root tab → Home; back on Home → exit toast, and a second back within ~2s exits; subpages and modals keep their natural back; a history "trap" is re-armed on each root tab to capture the back. Never traps the user (back always advances). Needs on-device iteration for the residual mixed-nav edge cases.

---

## [2.58.0] — 2026-07-03

### Added
- **Native-feel pass** (shipped via hotfix): disabled pinch-zoom and double-tap-zoom (viewport `maximumScale: 1`, `userScalable: false` + `touch-action: manipulation`; this also removes iOS input-focus zoom for free, so no font-size bump needed); `env(safe-area-inset-top)` on `.page` (iOS notch); `user-select: none` + `-webkit-touch-callout: none` on the chrome with inputs/textarea re-enabled; scroll-to-top on active-tab re-tap + subtle `navigator.vibrate` haptics on tab nav.
- Double-back-to-exit (Android) — **reverted in 2.58.1**, see above.

---

## [2.57.1] — 2026-07-03

### Changed
- **Audit quick-wins (Phase 0)**:
  - `marcarFullSync` (movement edit/delete) now retries once and logs on failure instead of swallowing it silently — a failed `needsFullSync` flag would otherwise leave the Sheets mirror stale until the next manual sync, undetected.
  - Notifications: `RECURRENTE_LOOKBACK_DIAS` trimmed 45 → 35 days (fewer per-user reads/day; still safe — the daily cron + dedup fire the reminder on day 28, well inside the window).
  - `getCotizacion` now dedupes in-flight requests: concurrent cold-cache mounts await a single fetch instead of firing parallel calls.
  - Cold-start decision: `minInstances` stays at 0 (PWA cache masks the cold start; not worth the always-on cost).

---

## [2.57.0] — 2026-07-03

### Changed
- **Incremental Firestore reads (client + Sheets sync)** — kills the recurring ~1.4K-read full-collection scans:
  - **App load** (`useAllMovimientos`): when the server count exceeds the cached count (adds from another device/session), fetch only movements newer than the newest cached `timestampCarga` and merge, instead of re-reading the whole collection. Falls back to a full fetch when the numbers don't reconcile (cross-device deletes/edits). Count-match still short-circuits to cache.
  - **Sheets sync** (`syncUserMovimientosToSheet`): now incremental by default. Reads only movements after `syncMeta.lastSyncedTs` and appends them to the sheet (the sheet is written exclusively by the app, so its state equals the last sync). A full mirror (backup + overwrite) runs only when the app edited/deleted a movement (`syncMeta.needsFullSync`, set by `marcarFullSync` in `services/firebase/movimientos.ts` for the owner), when there's no prior sync, or when forced. Manual sync from Settings forces a full mirror.
  - **Cron back to daily** (was weekly in 2.56.2): daily is cheap now that the sync is incremental. Success push only fires when something was actually synced; the log distinguishes full vs incremental runs.

---

## [2.56.2] — 2026-07-03

### Changed
- **Sheets auto-sync throttled to weekly** (was ~daily): the sync is a full-collection mirror (~1.4K document reads per run), the single biggest recurring Firestore cost. `SYNC_MIN_INTERVAL_MS` is now 7 days minus a 4h buffer so it always lands on the same 06:00 cron slot. The cron itself still runs every 6h (notifications need it); manual sync from Settings is unchanged for on-demand flushes.

---

## [2.56.1] — 2026-07-02

### Changed
- **Dashboard "disponible" bar color follows the income-anchored scale**: was `<10% red, <50% yellow` (so green rarely showed); now uses the shared `colorPct` on spent/income (green ≤90, yellow 90–105, red >105). Side effect: moving money to savings no longer turns the bar red. `colorPct`/`colorPctDim` extracted to `components/reports/format.ts` as the single source of truth (Reports + Dashboard).
- **"Gastos totales" per-period chart is now neutral**: bar height = pesos (magnitude), single muted color. The green/amber/red semaphore only lives in the "gasto sobre sueldo" chart, where height and color describe the same thing. Best/worst months are still marked by the date-label color.

### Fixed
- **In-progress period excluded from best/worst**: the current (incomplete) period was flagged "best" just because it had spent little so far. Now `validPeriodos` drops `periodos[0]`, matching the inflation/trend criterion.
- **Budget template auto-applies to the current period**: the template only pre-filled categories that already had spending, so a fresh period showed nothing and had to be typed by hand. Now, for the in-progress period with no saved budget, the template is used as the effective budget (not persisted until edited/saved); the budget editor lists the full category union (spent + template + saved); and budgeted-but-unspent categories render as empty bars. Historical periods are untouched.

---

## [2.56.0] — 2026-07-02

### Changed
- **Color & percentage logic unified across Dashboard/Reports/Movements**:
  - **CompraUSD color**: was red on the Dashboard (grouped with Gasto) but yellow in Reports/Movements. Now yellow everywhere.
  - **`var(--teal)` token**: replaced the hardcoded `#26c6da` (and `#26c6da20` → `var(--teal-dim)`) in Dashboard, Movements, Reports and MovementModal for the "move disponible" color. No visual change; palette edits now propagate.
  - **Trend uses a relative threshold (z-score)**: the Gastos and Movements "Tendencia" stats no longer use a fixed ±10% band. Color is now based on how many standard deviations the current period sits from the user's own historical mean (±1σ = normal/yellow, beyond = red/green), so it adapts to each user's volatility. New `colorZ(actual, hist)` helper.
  - **Zero handling in deltas**: real zero (no change) now renders in text color instead of green/yellow/gray; a near-zero value that would round to "0%" now shows a decimal and keeps its sign color. Applied to category comparison, income delta, personal inflation (Reports + Dashboard) and the salary-vs-inflation gap. Backing computations (`deltaPct`, `tendenciaGasto`, `tendenciaMovs`, `deltaIngresos`, `inflacionPersonal`, `gap`) now keep the raw unrounded value; rounding happens at display via new `deltaMag`/`deltaColor` helpers in `components/reports/format.ts`.

### Fixed
- **`colorPct` scale rebased to income limit (100%)**: spent-color was green only ≤50%, red >90% — so normal spending (~100% of income) always read red. Now green ≤90%, yellow 90–105%, red >105%, and the duplicated inline thresholds (period gasto/sueldo chart) call `colorPct` instead of re-hardcoding.

---

## [2.55.7] — 2026-07-02

### Changed
- **Reports KPI reorg (Gastos/Ingresos)**: in Gastos, the "A ahorros" mini-stat next to Trend was replaced with a **Gasto real** stat (pure spend excluding FX purchases, shown only when FX purchases exist). The Trend info modal dropped the now-redundant "Período actual" line, keeping only the historical average. In Ingresos, the two move metrics (move disponible + move a ahorros) were merged into a single **Moves** card holding both amounts, distinguished by color (cyan = disponible, purple = a ahorros); each amount stays tappable for its detail modal. Removed the redundant `+%` sub-label from the Salary mini-stat (kept the "leave" indicator). Added `moves`, `realSpent`, `kpiRealSpentInfo` locale keys (es/en).

---

## [2.55.6] — 2026-07-01

### Fixed
- **Recurring-expense reminders on high-volume periods**: `checkRecurrentes` was scanning the shared 150-most-recent movements (introduced in 2.55.0). For users loading ~200 movements per period, a recurring expense's reference movement falls out of the top-150 (~day 22) before the 28-day reminder threshold, so the reminder never fired. It now reads its own date-windowed slice (`fecha >= today − 45 days`, index-free single-field range), which is robust to period volume. Salary and forgotten-load checks keep using the shared read (they only need the newest entry).

---

## [2.55.5] — 2026-07-01

### Changed
- **`useComprobante` hook**: extracted the receipt-attachment state (file, preview, removed flag, media viewer) and its handlers (`reset`, `onSelect`, `clear`) out of `MovementModal.tsx` into `components/movements/useComprobante.ts`. Centralizes the preview object-URL lifecycle; behavior-preserving (destructured with the same identifiers).

---

## [2.55.4] — 2026-07-01

### Changed
- **Reports chart components extracted**: moved the 7 presentational chart components (`Bar`, `Stat`, `DonutChart`, `VBars`, `DotChart`, `AreaChart`, `TwoLineChart`) and the format helpers (`abbr`, `shortPer`, `sinAño`, `periodoAnio`) out of `app/(tabs)/reports/page.tsx` into `components/reports/charts.tsx` and `components/reports/format.ts`. Reports page dropped ~260 lines (1680 → 1420); no behavior change.

---

## [2.55.3] — 2026-07-01

### Changed
- **`useHideOnScroll` hook**: extracted the floating-button fade-on-scroll logic (duplicated in Movements and Investments) into `hooks/useHideOnScroll.ts`.

---

## [2.55.2] — 2026-07-01

### Changed
- **Shared UI primitives**: extracted `<PageTitle>` (the gradient page heading used across Dashboard, Movements, Reports, Investments, Settings) and a `components/ui/gradients.ts` module (`APP_GRAD`, `APP_GRAD_DIM`, `TITLE_GRAD`, `clipText`, `appGradText`, `titleGradText`). Removes the duplicated gradient constants that lived in Movements and Reports and the repeated inline title styles.

---

## [2.55.1] — 2026-07-01

### Removed
- **Unused locale keys**: 141 dead keys removed from `locales/es.ts` and `locales/en.ts` (~140 lines each), including the leftover home/management/analysis families. The in-use `budget`/`budgetPeriod`/`budgetTemplate` keys were verified and kept.
- **Dead code in `utils/reportes.ts`**: removed 9 unused functions (`topGastos`, `medioPagoMasUsadoCount`, `promedioAhorroPeriodo`, `evolucionSueldo`, `gastoPromedioHistorico`, `ritmoAhorroActual`, `consistenciaAhorro`, `ahorrosVsProyectados`, `generarInsights`) plus the `Insight` and `AhorroVsProyectado` types (~140 lines).

### Changed
- **FX reserve calculation unified** into `utils/reserva.ts` (`reservaFX`, `calcularReserva`, `tiposReserva`). The five previously duplicated copies (Investments page, Reports, MovementModal, investment settings, notifications cron) now share one implementation.

---

## [2.55.0] — 2026-07-01

### Performance / cost (Firestore reads)
- **Notifications cron — daily gate**: movement-based checks (meta, salary, forgotten-entry, recurrents) now run at most once per day per user via a `lastDailyRun` marker, instead of on every cron run. Dollar-rate and version checks still run every run (they don't read movements). Cuts those reads ~4×→1×.
- **Recurrents check**: a single read of the ~150 most recent movements, filtered in memory, replaces one Firestore query per active recurrent.
- **Shared recent-movements read**: `checkSueldo` and `checkCargaOlvidada` now reuse that same snapshot instead of each issuing its own query.
- **`checkMeta` guarded**: returns early once the 100% milestone was notified, and uses a `count()` aggregation to reuse a cached investment-sum (stored in `notifyMeta`) when the number of investment movements and currency are unchanged; the base balance is always added separately so base edits still reflect.
- **Admin users API**: 60s in-module cache on `GET /api/admin/users` (owner-only, low churn), invalidated on permission change.
- **Client caching**: `recurrentes` and `plantillas` are now loaded once per session via `DataProvider` (movements list marker, add-movement modal, notifications settings) instead of re-fetching on each tab visit / modal open.

### Changed
- **Manual Sheets-sync button** now only appears when the last sync errored; the routine mirror is automatic (self-limited to ~1×/day), so the always-visible manual trigger was redundant.

---

## [2.54.1] — 2026-06-30

### Changed
- **Compare toggle resized**: the multi-period compare button in Reports now matches the smaller pill size (was left oversized after the pill resize).

---

## [2.54.0] — 2026-06-30

### Changed
- **Card labels capitalized**: stat/label text across cards (MiniStat, Stat, Patrimonio rows) now uses `capitalize`.
- **Section headers cleaned up**: removed the small kicker label above every section title. Dashboard renamed "Resumen" → "Inicio"; Settings title renamed "Cuenta" → "Configuración".
- **Reserve card**: header shown as "RESERVA" (uppercase) and the redundant "USD"/"EUR" suffix removed (currency is already in the big figure). Removed the redundant "Objetivo USD" label in the savings-goal card.
- **Reports year/period pills** resized to match the Movements pills (padding 4×12, 10px).

---

## [2.53.2] — 2026-06-30

### Changed
- **Chart metric selector** (Reports → Periods) now uses the unified brand gradient (soft tint fill + gradient text, no border), matching the sub-tabs and pills, instead of the previous solid blue accent.

---

## [2.53.1] — 2026-06-30

### Changed
- **Unified selector styling**: the Reports sub-tabs (Spending/Income/Movements/Periods) and every year/period pill — in both Reports and Movements — now share one brand gradient (blue → cyan → teal → green). Active state is a soft opaque tint fill with gradient text and no border, replacing the previous per-section colors and mixed border/fill treatments.

---

## [2.53.0] — 2026-06-29

### Added
- **FX income movement** (`IngresoUSD`/`IngresoEUR`): receiving money in foreign currency (e.g. a USD payment) adds to the reserve without touching the available balance — the opposite of FX spending. Counted at zero cost (ii): it raises the reserve and the gain. Wired into every reserve calculation (investment, settings, goal notifications, reports), shown in the reserve history, and hidden from the main movements/dashboard lists.

### Changed
- **Reserve modal redesigned**: the four type pills sit in one row (Buy/Income green, Sell/Spend red). Income works like Spend — amount only, no rate or currency selector — it just adds to the reserve. For Buy/Sell the oficial/blue rate pills were removed (defaults to the official rate, shown with its label) and the date moved into that slot.
- **"Leftover" reclassified**: the previous period's leftover (`RESTO`) is already-earned money, so it's now stored as a `Move` to savings instead of a fresh income. Existing leftover movements were migrated (`scripts/migrate-resto.js`). Period math is unchanged (still counts as savings carryover, never subtracts from available); it just no longer shows as green income — it's now a blue carryover entry.

### Fixed
- **Salary always anchors the period**: deterministic ordering so the salary movement sorts first even when it shares a creation timestamp with the leftover entry (was device-dependent).
- **Personal inflation** no longer includes the in-progress period, which produced absurd values (nominal −1%, cumulative −93%, dashboard −95%) right after opening a new period. Applies to the dashboard KPI, the reports average, and the cumulative CPI chart.

---

## [2.52.0] — 2026-06-29

### Changed
- **Settings consolidated** from 9 groups to 6: Account (profile + security merged), Preferences (now with language + **main currency selector, restored**), Notifications, Movements (now includes **budget template**), Investment, Data (now includes **owner invites**), Help. Removed standalone Profile/Security/Budgets/Admin routes.
- **Dashboard "Spent"** now shows real spending (excludes FX purchases).
- **Reports → Gastos hero**: added a breakdown legend ("real spending X + FX Y") when the total includes USD/EUR purchases.

### Fixed
- Account deletion entry relabeled "request deletion" (it sends a request to the admin, doesn't delete) and shown only to non-owner users.

---

## [2.51.0] — 2026-06-29

### Added
- **Salary over time** (Reports → Períodos): chart of your salary per period in USD (official historical rate from bluelytics) or CPI-adjusted (today's pesos), with a USD/IPC toggle. ARS only.

### Changed
- **Period chart selector** redesigned: the pill row is now a single centered button that opens a bottom-sheet picker (label + check). Options renamed/reordered: Total spending · Spending vs salary · Length in days · Personal inflation · Total income · Salary over time.
- **"Your year" recap is now seasonal**: the button only shows in December.

---

## [2.50.0] — 2026-06-29

### Added
- **"Your year" recap (annual Wrapped)**: full-screen story (tap to advance) in Reports recapping a closed year — total spent, top category, total saved, best savings month, personal vs country inflation (ARS only), salary raise, movement count. Reveal rule: closed years always available; the current year only from December 1. Button hidden when no year is available. All client-side ($0).

---

## [2.49.0] — 2026-06-29

### Added
- **Recurring flag in the movements list**: movements matching an active recurrente (same type+category+description) show a small clock icon.

### Changed
- **Server-mediated comprobante uploads (F3)**: uploads and deletes now go through API routes (`/api/comprobantes/upload`, `/api/comprobantes/delete`) that verify the ID token, check the `comprobantes` permission (owner bypass), validate type/size, and write via the Admin SDK with a non-expiring download token. Client still compresses images before upload. Storage rules tightened: clients can no longer write/delete comprobantes directly (server-only). **Requires deploying storage rules** (`firebase deploy --only storage`).

---

## [2.48.1] — 2026-06-29

### Changed
- **Movements settings redesigned**: categories/methods/origins are now full-width rows (name + active toggle + delete with confirm) instead of cramped chips with hidden long-press. Adding is behind a "+ Add" button that reveals an inline input (with Gasto/Ingreso selector for categories). Auto-savings unchanged.

---

## [2.48.0] — 2026-06-29

### Changed
- **Settings restructured into an account/profile hub with drill-in sub-pages.** The single-accordion `/settings` is now a landing with a profile header + grouped rows, each navigating to its own route (native back works): `/settings/profile`, `/preferences`, `/notifications`, `/security`, `/movements`, `/budgets`, `/investment`, `/data`, `/admin`, `/help`. Shared components in `settings/_shared.tsx` (SubHeader, NavRow, Toggle, Chip, flags). Behavior of each group preserved; movements UI unchanged (redesign pending). Investment gated by permission, admin/sheets gated to owner.

---

## [2.47.0] — 2026-06-28

### Added
- **Recurring movements (P3, reminder mode)**: a "Repeat each period" toggle when adding a Gasto/Ingreso saves a template (`users/{uid}/recurrentes`). A daily cron (`checkRecurrentes`) finds the last matching load and, ~28 days later, sends a push reminder ("¿Cargás X?") — date-based, never auto-posts. Dedup by last-load date (re-arms after you load it again). Management section in Settings (Generales → Movimientos recurrentes): list with pause toggle + delete.

### Changed
- Savings-projection KPI modal copy clarified (it's the next-period inflow, not the total balance).
- "Repeat each period" toggle placed at the bottom of the add form.

### Fixed
- **Bottom-sheet long-press no longer selects text** (`user-select: none` on the sheet).

### Added
- **Back button closes the open modal** instead of leaving the app (`useModalBack`, history-based). Lateral section swipe is disabled while a modal is open.
- **Bottom sheets draggable from the whole header** and via **long-press anywhere in the body** (native non-passive touch listeners so it doesn't fight scroll).

### Changed
- **G/Sueldo chart**: shows the surplus over 100% (+86% = spent 186% of salary; -14% = spent 86%); the baseline (0) marks 100%.
- **Savings projection**: deflated to today's pesos and projected to next month (CPI), like the spending projection — no longer falls below the current level.
- **Día pico / daily average** (Movimientos): exclude FX purchases (pure spending only).
- Purchasing-power modal: dropped the redundant trailing sentence.

### Fixed
- **IP chart order**: accumulated inflation chart now renders most-recent-first (left), matching the other period charts.
- **Chart click targets**: días (area), G/Sueldo and IP (dots/lines) now navigate to the period when tapping anywhere in the column, not only exactly on the point.

---

## [2.46.0] — 2026-06-28

### Added
- **"Purchasing power" card** (Reports → Períodos, above the charts): verdict + gap in points between accumulated salary growth (first→last salary level, excluding vacation periods) and accumulated country inflation. Replaces the "Most frequent expense" and "Highest expense" cards.

### Changed
- **CPI month mapping fix**: periods starting after the 15th now map to the following month (the one they mostly span), since salaries anchor near month-end. Affects `deflatar` and `ipcVar`.
- **IP chart → two accumulated lines**: your accumulated inflation vs the country's (compounded), from the oldest period. Headline shows "Vos acum / País acum". Replaces the per-period dot chart.
- **Período cards reorganized**: removed "Typical income"; rows are now Typical spending | Spending projection, and Typical savings | Savings projection. The next-period spending projection moved here from the Gastos tab.
- **Gastos tab**: shows "Avg per movement" where the projection used to be.
- **Improved projection**: historical periods are deflated to today's pesos (CPI) and projected to next period by the latest monthly CPI, instead of a plain nominal average.
- **Días chart → area**, **G/Sueldo chart → dots** (uses real spending without FX), per chart-type variety.
- `useInflacionIPC` exposes `ipcVar` (country inflation between two periods) and `ipcMensualUltimo`.

---

## [2.45.2] — 2026-06-28

### Changed
- **Personal inflation chart redesigned** as a connected dot/point chart (SVG): each period is a dot above/below the dashed zero baseline (red above, green below), joined by a trend line, with the % above each dot. Replaces the diverging bars for a cleaner, more modern look.

---

## [2.45.1] — 2026-06-28

### Fixed
- **Personal inflation chart period mapping**: `serieDesc` runs newest→oldest, so the previous period is `serieDesc[i+1]`, not `[i-1]`. The chart was excluding the current (open) period instead of the oldest, and computing the change with reversed sign. Now the current period is included (its prior is the second-newest) and the oldest is excluded (no prior to compare).

### Added
- **Average personal inflation** shown above the "IP" diverging-bar chart — the mean of the real per-period inflation bars.

### Changed
- **Argentine CPI gating**: the "IP" pill (Reports) and the CPI-adjusted dashboard "Inflación" now apply only when `monedaPrincipal === "ARS"`. Non-ARS users get nominal dashboard inflation (Argentine CPI doesn't apply to their currency) and don't see the IP pill. Dashboard modal text varies by case.
- **Reports period card** renamed "Inflación personal" → "Inflación nominal" to contrast with the CPI-adjusted (real) IP chart.

---

## [2.45.0] — 2026-06-28

### Added
- **Nonce-based CSP** (F8): `proxy.ts` (Next.js 16 convention, replaces `middleware.ts`) generates a per-request cryptographic nonce and emits `script-src 'self' 'nonce-{n}' 'strict-dynamic'`. Modern browsers ignore `'unsafe-inline'` for scripts, mitigating inline-script XSS. The root layout reads `x-nonce` and applies it to the theme-init inline script. CSP moved out of `next.config.ts` into the proxy; other static security headers unchanged. `'unsafe-inline'` retained on `style-src` (inline `style={{}}` used app-wide).
- **Personal inflation chart** (Reports → Períodos): new "IP" pill renders a diverging bar chart of real per-period inflation — pure spending (tipo "Gasto") deflated by CPI vs the previous period. Zero baseline: positive up (red, spent more in real terms), negative down (green). Oldest period excluded (no prior to compare).

### Changed
- **CPI source switched to Argly** (`useInflacionIPC`): `https://www.argly.com.ar/v1/ipc?historico=true` (coverage Dec 2022 → present), replacing the INDEC series that didn't cover 2025–2026. Monthly variations compounded into a cumulative index; cached 24h in localStorage.
- **Dashboard "Inflación"**: now CPI-adjusted (real) vs the previous period instead of nominal. Positive = spending above inflation. Modal text updated (ES/EN).
- Reports → Períodos "Inflación personal" modal text corrected: it's the nominal historical average across periods (was wrongly claiming CPI adjustment / "vs previous period").

### Removed
- **"Real" metric pill** (added in 2.44.0): replaced by the diverging-bar "IP" chart. The absolute deflated-spending bars were dominated by single large periods and conveyed no useful trend.

---

## [2.44.1] — 2026-06-28

### Changed
- **Dashboard "Inflación"**: now shows change vs the immediately previous period (not the historical average). Label shortened to "Inflación"; modal text updated accordingly.
- Reports → Períodos retains "Inflación personal" (historical average across all periods) — the two metrics are intentionally different.

---

## [2.44.0] — 2026-06-28

### Added
- **Personal inflation on dashboard**: replaced "Avg. per expense" KPI with "Personal inflation" — average % change in pure spending (tipo "Gasto" only, FX purchases excluded) between consecutive periods. Green when decreasing, red when increasing; tappable for explanation modal. Same computation already present in Reports → Períodos.
- **"Real" metric pill in Reports**: new fifth pill in the period chart selector (ARS users only). Shows `gastadoPuro` (spending without FX purchases) in nominal ARS, with eye-mask and best/worst period markers — isolates spending trend from FX noise.

---

## [2.43.2] — 2026-06-28

### Fixed
- **Firebase re-initialization on Fast Refresh**: guard `initializeApp` with `getApps()` and `initializeFirestore` with try/catch so HMR module re-evaluation doesn't throw `initializeFirestore() has already been called with different options`.

---

## [2.43.1] — 2026-06-28

### Fixed
- **Period duration chart**: current period bar now uses `floor + 1` (inclusive) to match the home-page counter — no more 30d vs 31d discrepancy.
- **App Check in dev**: `initializeAppCheck` is now guarded by `NODE_ENV === "production"`, eliminating the `appCheck/recaptcha-error` console noise in local dev.
- **Push notification icon**: changed from `/favicon.png` to `/icon-192.png` (correct Android notification icon size, already precached by the SW).
- **Inactivity logout timeout**: increased from 8 hours to 3 days — push notifications are only useful if the user doesn't have to re-login every time they open the app.

---

## [2.43.0] — 2026-06-28

### Accessibility
- **BottomSheet** (the app's primary modal, used by the movement form + ~10 Reports sheets) now has `role="dialog"`/`aria-modal`, **Escape to close**, a **focus trap** (Tab cycles within the sheet), focus moved into the sheet on open and **restored to the trigger on close**, plus an `aria-label` on the close button.
- **Settings toggles** are now real `<button role="switch" aria-checked>` (keyboard-operable, announced as switches) instead of `div onClick`; added an optional `label` for `aria-label`.
- **Period bar chart** (`VBars`): clickable bars are now `<button>`s with an `aria-label` (period + value) instead of `div onClick`.
- **Type donut** (`DonutChart`): wrapper exposes `role="img"` + a percentage summary `aria-label`, the SVG is `aria-hidden`, and the tappable legend buttons gained `aria-pressed` + `aria-label` (the legend is the keyboard/SR-accessible control).

### Security
- **Durable rate limiting for `/api/register`** (F4): moved the per-IP limiter from per-instance memory to a Firestore counter (`rateLimits/{ip}`), so it survives cold starts and works across instances; now keys on the first `x-forwarded-for` hop. Expired counters are swept by the daily cron. The collection is client-denied by the default Firestore rules (Admin SDK only).
- **CSP fix for App Check / reCAPTCHA**: added `https://www.google.com` to `script-src` and `frame-src` so reCAPTCHA v3 (`recaptcha/api.js` + challenge iframe) can load. Without it App Check couldn't obtain a token and, under enforcement, all Firestore calls were rejected (production hung on load). Unblocks enabling App Check enforcement safely.

---

## [2.42.1] — 2026-06-27

### Security
- **Firebase App Check activated in monitor mode**: wired the public reCAPTCHA v3 site key via `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` (plain `value` in `apphosting.yaml` — the site key is public by design; the secret key lives only in the Firebase App Check console). Clients now attach App Check tokens to Firestore/Storage/Auth calls. Enforcement stays OFF until the console metrics confirm legitimate traffic is passing.

---

## [2.42.0] — 2026-06-27

### Changed
- **Dark is now the default theme** (the designed palette); light is opt-in. Flipped the default in `useTheme` and the pre-paint `themeInitScript` (light applies only when `finmoves-theme === "light"`). New users no longer land on the under-contrasted light theme.
- **Tap targets**: `.pill` now has `min-height: 32px` + flex centering, raising the many sub-32px period/metric pills in Movements & Reports above the mis-tap threshold.

### Added
- **`prefers-reduced-motion` support**: global CSS that collapses animations/transitions for users who request reduced motion (spinner keeps spinning so it doesn't look hung). (A11y)
- **Firebase App Check scaffolding** (anti-abuse): client initializes App Check with reCAPTCHA v3 when `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` is set; no-op otherwise (dev stays unaffected). Added `adminBucket` earlier; this is the F2 item from the security review.

### Fixed
- **i18n leaks**: routed remaining hardcoded Spanish through the dictionary (es/en) — Reports "A ahorros"/"Move a ahorros"/"Hoy"/"Compra U$D"/"Reserva" and their KPI explainers, Dashboard "spent" explainer, Settings currency toasts + "Auto-ahorro", and the login footer Privacy/Terms links.

> Enablement note: App Check is dormant until you (1) register a reCAPTCHA v3 provider in Firebase App Check, (2) add `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` (Secret Manager + `apphosting.yaml` BUILD var), then redeploy, and (3) flip enforcement to ON in the console (after a monitor period). The code ships safe-by-default (off) so nothing breaks before those steps.

---

## [2.41.1] — 2026-06-27

### Security
- **Account deletion now also wipes Cloud Storage** (receipts + avatar under `users/{uid}/`), which previously survived a hard delete as orphaned PII. Added `adminBucket()` helper and a best-effort `deleteFiles({ prefix })` in the delete route. (ISO A.8.10 / A.5.34)
- **Sheets sync errors no longer leak internals to clients**: the manual sync route returns a generic message and the cron failure push says "check Settings" — full detail stays in server logs and the owner-only sync log. (ISO A.8.15)
- **Storage rule added for `users/{uid}/avatar.jpg`** (owner read/write/delete, image-only, <5 MB) — the avatar write path was previously denied by the catch-all rule, silently breaking profile-photo copy. (ISO A.8.3)

> Deploy note: storage rule changes require `firebase deploy --only storage` (not applied by the App Hosting push).

---

## [2.41.0] — 2026-06-27

### Added
- **Tap a bar in the Periods chart to jump to that period**: opens a confirm card and, on confirm, selects the period and switches to the matching sub-tab — the Spent chart goes to **Expenses**, the Income chart to **Income** (Days / spend-salary go to Expenses). `VBars` now carries `periodoId` per bar and exposes it via `onBarClick`.

### Fixed
- **Salary KPI now reflects the selected period** instead of always showing the most recent period's salary. Replaced the global `evolucionSueldo` read with a per-active-period computation (`evolSueldoActivo`) that also derives the variation vs the previous distinct, non-leave salary level.
- **Trend and next-period projection only render on the current (most recent) period** — they're meaningless when browsing an older period. Gated behind a new `esPeriodoVigente` flag.

### Changed
- **Period spend chart counts FX buys again** (bars, best/worst markers and the spend/salary ratio): reverted to `gastado` so the chart stays aligned with the income-side totals without touching income logic. Numeric KPIs (trend, average, median, projection, pace, deviation) keep using pure spend.
- **Spend-dispersion (CV) color thresholds recalibrated** on the home dashboard: green ≤100%, yellow ≤200%, red >200% (was 25/50, which flagged nearly everything red since per-movement amounts vary widely).
- **Top-category cards** (most frequent / highest) now show only the data in the expanded modal (count / amount), since the minimized card already shows the category.
- **Shortened the median explanation** (typical income/spent/savings KPIs) — the previous copy was overly long.

---

## [2.40.0] — 2026-06-27

### Changed
- **Statistical calculations now exclude FX buys** (`CompraUSD`/`CompraEUR`), which were inflating averages, variation and projections. Introduced `gastadoPuro` (sum of `Gasto` only) on `PeriodoResumen` and `PuntoTendencia`, plus an `esGastoPuro` helper. Routed through it: personal inflation, median/average spend per period, spend trend, next-period projection, spending pace (`ritmoGasto`), avg-per-day-with-expense (`kpisPeriodo.promedioDiario`), spend dispersion/CV (`estadisticasPeriodos`), best/worst-period markers, the per-period spend bar chart and the spend/salary ratio chart, and the home dashboard's avg-per-movement + deviation (CV).
- **Totals and breakdowns keep FX**: period total `gastado`, `% spent`, by-category / by-payment-method / by-description / by-date distributions and top expenses still include `CompraUSD`, so FX buys remain visible where they're a real outflow.

---

## [2.39.0] — 2026-06-27

### Reports · Periods
- **Top categories split into two cards**: "most frequent expense" (by movement count) and a new **"highest expense"** (by total amount). Amounts are no longer shown inline — content is centered and the detail opens on tap (`KpiInfoModal`): the frequent card reveals the movement count, the highest-spend card reveals the full (non-abbreviated) amount.
- **New savings metrics**: **typical savings** (median of what goes to savings per period — `moveAhorros + ahorros`) and a **savings forecast** for the next period (historical average, excluding the in-progress period). KPI rows reorganized into a 2-2-2 grid; removed the spend forecast from this overview. Savings metrics use `--blue` (purple stays reserved for move-to-savings).

### Reports · Income
- Removed the standalone savings projection widget (3p/6p/12p selector).

### Reports · Movements
- Pie-chart legend simplified: move types now read **"Ahorros"/"Disponible"** (the color already conveys it's a move) and **CompraUSD** reads **"USD"**.

### i18n
- Added `highestExpense`, `avgSavings`, `projSavings`, `kpiTypicalSavingsInfo`, `kpiProjInfo`, `kpiMostFrequentInfo`, `kpiHighestInfo` (es/en); updated `tipoDisplay` labels for `MoveAhorro`/`MoveDisponible`/`CompraUSD`.

---

## [2.38.1] — 2026-06-27

### Fixed
- **Onboarding infinite loop for new users**: after completing onboarding the local config cache was not updated, so the home-page guard read the stale `onboardingCompleto: false` value and redirected back to `/onboarding`. Fix: `saveConfigCache` is now called with the updated config immediately after the Firestore write, before the redirect.

---

## [2.38.0] — 2026-06-27

### Changed
- **Reports / Periods section reworked into a general overview**. The four separate per-period charts (spent, spent-vs-salary, income, days) are now a single chart with a metric selector (Spent · Income · Days · Spend/Salary); `VBars` gained an optional reference line for the Spend/Salary ratio (100% marker). A subtitle under the chart explains the active metric.
- **New period summary** above the chart: hero is now **personal inflation** (average period-over-period spending growth, excluding FX buys so it isn't skewed), plus **most frequent expense** (category · times · total) and **typical income/spent** per period using the **median** (robust to atypical periods), each with a tap-to-explain `KpiInfoModal`. Removed the previous net-average hero, the average/median + best/worst stacks.

### Added
- i18n keys for the period overview (`inflationTitle`, `kpiInflationInfo`, `mostFrequentExpense`, `timesCount`, `avgSpent`/`avgIncome`, `kpiTypicalInfo`, `subMetric*`, `mPeriod*`, `byPeriod`) in es/en.

---

## [2.37.0] — 2026-06-27

### Changed
- **Reports / budget bars (Por categoría)**: the over/under-budget color now lives on the bar and the delta percentage only; the delta amount and the budget target render neutral, so the status color reads at a glance without tinting the whole figure.
- **Reports / category & description bars (non-budget)**: bar color now encodes the row type — red for gasto, yellow for FX buys (`CompraUSD`/`CompraEUR`) — in both Por categoría and Top descripciones. Amounts stay white/gray.
- **Reports / detail sheets**: amounts in the description and category modals now render neutral (white) instead of yellow/red.
- **Reports / Por medio de pago**: the preview row drops the aggregate amount and keeps only the per-type count badges; tapping a method opens a sheet detailing totals per movement type (count `×` + amount).

### Added
- **New movement / category pills**: now a single horizontally-scrollable row sorted by usage (most-used first, counted from the user's `Gasto` movements) instead of a wrapping multi-row block.
- **Reserva / FX spend**: the helper under the amount now shows the current FX reserve and, once an amount is entered, the remaining reserve (`Reserva: USD X · Restante: USD Y`), colored green/yellow/red by how much of the reserve the spend consumes — replacing the line that merely echoed the amount as "Total".

### Fixed
- **Settings opened the keyboard on load**: the Auto-ahorro amount input kept its `autoFocus`, but since modals now use the always-mounted `BottomSheet` (children stay mounted for the drag-peek), the attribute fired on page mount and popped the on-screen keyboard when entering Settings. Removed the `autoFocus`.

---

## [2.36.0] — 2026-06-27

### Changed
- **Modals unified to a single bottom-sheet**: the shared `BottomSheet` component now matches the sync-history look (muted ×, divider under the header, `--surface` panel) while keeping the draggable handle. Settings modals that were centered cards or bespoke sheets (Auto-ahorro, Historial de sync, Changelog, Recordatorios, Invitaciones) were migrated to the shared component, so reports, add/edit and settings all render the same sheet. Removed the now-unused `createPortal`/`mounted` plumbing in Settings.
- **Movement detail (read-only, from Investments history)**: redesigned and moved to the unified sheet. The amount is now a hero figure (large mono, centered) with `tipo · categoría` above and date below; quantity/rate and description/notes sit in roomy cells — the cramped 30%-width amount column is gone.

### Added
- **Bottom-sheets follow the on-screen keyboard**: `BottomSheet` tracks `window.visualViewport` and pins the container height/offset to the visible viewport, so the sheet rises above the keyboard instead of being covered. Applies to every modal via the shared component.
- **New movement / Reserva — auto focus on amount**: opening the add sheet focuses the amount input (after the open animation); switching tipo (Gasto/Ingreso/Move) re-focuses it. Reserve mode focuses its primary amount input (USD/ARS or FX spend).
- **Reports / Gastos trend**: the trend KPI modal now spells out the actual figures — current period spend vs. historical average — like the movements trend.

### Fixed
- **Dashboard / Move color**: a Move "a disponible" on the home screen now renders teal instead of purple; only "a ahorro" stays purple (matching the movements list).
- **Investments / Por período KPI**: no longer truncates ("1.044 / …"). The card shows the average; the average-vs-goal pair is shown in the KPI detail on tap.

---

## [2.35.0] — 2026-06-26

### Changed
- **Investments / period stats (Por período, Proyección, Para la meta)**: now computed from actual net FX bought per period (`CompraUSD/EUR − GastoUSD/EUR − VentaUSD/EUR` by `cantidadUSD`), not from ARS leftover savings converted at the current rate. The averaging window is anchored to a seed period (`config/meta.inversionSeedPeriodoId`, auto-set to the current period on first load) and grows period by period. If no FX was bought in the window, the three stats show "—".
- **Dashboard investment shortcut**: hidden when the user lacks the `showAhorros` pref (was always visible).

### Added
- **Reports / Por día**: bars are now stacked — red segment for gastos, yellow for `CompraUSD` — so FX purchases no longer visually inflate a day's spend without context. A legend appears when the period has FX buys, and the day modal lists the `CompraUSD` movements (yellow, with `cantidadUSD`) alongside gastos; the modal total now matches the bar.
- **Reports / Movimientos donut**: card is now a 3-column grid (total · donut · legend). The legend is a tappable list of rows (color + type + count) that selects/highlights a slice — much easier to hit on mobile than thin arcs. Removed the redundant selected-type row under "días activos" and the label under the center percentage.

---

## [2.34.0] — 2026-06-26

### Added
- **Settings > General / Dashboard clásico**: toggle that switches the four dashboard KPIs between the new set (gastado, ahorros acum., prom. por mov., desvío CV%) and the classic set (salary, spent, savings, withdrawals). Persisted per-device in `finmoves_app_prefs` (localStorage via Zustand).

---

## [2.33.0] — 2026-06-25

### Changed
- **Dashboard KPIs**: replaced the four period-level stats (salary, spent, savings, withdrawals) with four cross-cutting metrics — Gastado, Ahorros acum., Prom. por mov., and Desvío (coefficient of variation as `±X%`). All four are centered and open a `KpiInfoModal` on tap with a brief explanation.
- Added `spendSpread` and `kpiSpendSpreadInfo` translation keys (es/en).

---

## [2.32.2] — 2026-06-24

### Fixed
- **Reports / Por medio de pago**: `medioPago` placeholder dashes now cover all variants (`-`, `–`, `—`) and are attributed to "Mercado Pago" regardless of movement type, so the stray "—" row no longer appears and its movements merge into Mercado Pago. Genuinely empty `medioPago` (e.g. income) is excluded from the chart.

---

## [2.32.1] — 2026-06-24

### Changed
- **Reports / Categorías budget mode**: when the budget toggle is on, the per-category amount and percentage now show the delta vs. budget (over with `+`, under with `−`) colored by budget status, instead of the absolute spend and its share of total.

---

## [2.32.0] — 2026-06-24

### Added
- **App icon badge for push notifications**: the service worker now keeps an unread counter in IndexedDB (`finmoves-badge`); each `push` increments it and calls `setAppBadge(n)`. The badge clears only when the app is opened/focused (via a `CLEAR_BADGE` message + `clearAppBadge()` in `ServiceWorkerRegister`), not when the notification is swiped away. Requires an installed PWA with notifications granted (iOS 16.4+).
- **New-version push**: `notifyUser` sends a one-time push on MINOR/MAJOR releases (patches excluded), deduped via `notifyMeta.lastVersionNotified` with a silent baseline for existing/new users. Complements the in-app update banner (which performs the actual hard refresh).
- **Sheets sync push on success (owner)**: the cron now pushes the owner on successful auto-sync with the same detail as the log (`Sync automática · N movimientos`), in addition to failures.

### Changed
- **Sheets sync failure push (owner)**: now includes the real error message instead of a generic string.
- Removed the movement-count app badge from the dashboard (`useAppBadge`) — it only ran while the dashboard was open and never reliably rendered on mobile. Hook `hooks/useAppBadge.ts` deleted.

---

## [2.31.1] — 2026-06-24

### Fixed
- **Reports / Medios de pago**: `medioPago` values are now trimmed before comparison; both hyphen (`-`) and en-dash (`–`) variants are treated as "no payment method" and attributed to "Mercado Pago" for Gastos.

---

## [2.31.0] — 2026-06-23

### Added
- **Reports / Movimientos hero**: interactive SVG donut chart showing movement distribution by type. Tap a segment to highlight it and display its percentage in the center; tap again to deselect.
- **Reports / Períodos**: new "Días por período" bar chart with color coding — green ≤29 days, yellow 30–31, red ≥32.

### Changed
- **Reports / Movimientos KPIs — Tendencia**: now computes trend based on movement count (not expense amount) vs. historical average. Explanation modal shows current count and historical average for direct comparison.
- **Reports / Movimientos hero**: removed "período" subtitle; restored "días activos" subtitle. Legend row (`visibility: hidden` when empty) prevents layout shift on segment selection.
- **Reports / Períodos KPIs**: removed "Mejor período" / "Peor período" MiniStats; best and worst periods are now highlighted directly in the "Gastado por período" bar chart (green/red labels).
- **Reports / Medios de pago**: gastos without `medioPago` or with `medioPago === "-"` are attributed to "Mercado Pago" in the chart visualization only.
- **Dashboard**: active period display now shows elapsed days ("X días") instead of the period start date.
- **VBars**: added optional `valueLabel` per-bar prop to override the default currency-formatted label.

---

## [2.30.0] — 2026-06-23

### Changed
- **Reports / Movimientos KPIs**: replaced "avg per movement" stat with "peak spending day" (`kpis.diaMayorGasto`) in red.
- **Reports / Gastos KPIs**: replaced "peak spending day" with "moved to savings" (`periodo.moveAhorros`) in purple; shown only when > 0.
- **Reports / Tendencia**: changed comparison from last-3 vs previous-3 periods to current period vs historical average of all previous periods (`periodos.slice(1)` mean). Requires ≥ 2 periods instead of ≥ 4. Updated locale strings for `kpiTrendInfo`.
- **Reports / Colors**: Movimientos tab, year pills, period pills, and hero card now use a teal→purple gradient (matching the Move pill in the entry modal). Períodos tab and hero use a red→green gradient. Gastos hero now has a red-dim background. Ingresos hero background and number color softened.

---

## [2.29.2] — 2026-06-23

### Fixed
- **Movements day-group badge**: Auto-ahorro moves (tipo=Move, descripcion=Auto-ahorro) were excluded from `nMoveAhorro` counter and falling into `nUsd` (yellow). Now all `tipo === "Move"` entries are counted by `direccionMove` — Auto-ahorro (aAhorro) shows purple, disponible shows teal.

---

## [2.29.1] — 2026-06-23

### Fixed
- **Movements day-group badge**: Move a disponible (aDisponible) now shows in teal (`#26c6da`) instead of purple. Split `nMove` counter into `nMoveDisp` (teal) and `nMoveAhorro` (purple) so each direction renders with its correct color in the collapsed day header.

---

## [2.29.0] — 2026-06-22

### Added
- **InstallBanner**: persistent floating PWA install prompt (same style as UpdateBanner) — replaces the settings card; shows until app is installed, no close button. Added `components/pwa/InstallBanner.tsx`, wired into `app/(tabs)/layout.tsx`.
- **Account deletion request flow**: new `POST /api/account/request-deletion` endpoint — marks `pendingDeletion: true` + `pendingDeletionAt` on user's Firestore doc and sends push notification to owner. No actual deletion, no reauth required.

### Changed
- **Invite code modal**: changed from bottom-sheet to centered floating card (matching ConfirmModal/Backup style); accent-dim background, icon-only copy button.
- **Delete account**: moved from inside Cuenta card to bottom of settings page (subtle underline link, non-owner only); action now triggers deactivation request instead of immediate deletion.
- **Settings**: removed `useInstallPrompt` import and `canInstall`/`promptInstall` usage (install prompt now lives in `InstallBanner`). Removed `deletePass`, `deleteError` state; replaced `handleDeleteAccount` with `handleRequestDeletion`.

---

## [2.28.1] — 2026-06-22

### Changed
- **Move ahorros color**: changed from orange (`--orange`) to purple (`--purple`, `#b06ddb`) across all surfaces — movement list dot, amount text, day-group badge, modal direction pills and info box, dashboard list, reports `TIPO_COLOR` map.
- Added `--purple` and `--purple-dim` CSS variables to `:root`.

---

## [2.28.0] — 2026-06-22

### Changed
- **Reports > Movimientos subtab — KPIs redesigned**: replaced 6 mixed KPIs with 4 focused ones: Hoy (today's spend, active period only), Prom. ARS/mov (ticket average), Prom. ARS/día (daily average), Días activos % (days with ≥1 expense / total period days). Fixed date comparison to handle both YYYY-MM-DD and D/M/YYYY formats. Fixed total-days calculation (off-by-one removed).
- **Reports > Movimientos subtab — Por categoría**: now shows ARS total alongside frequency count. Bar width still reflects frequency. Modal "Todas las categorías" updated to match (count × + ARS).
- **Reports > Movimientos subtab — Por medio de pago**: moved from Gastos tab; now shows total ARS + per-type count breakdown (colored by Gasto/Ingreso/Move/FX) + frequency bar.
- **Reports > Gastos subtab**: removed "Categoría que más creció" card and "Por medio de pago" card.
- **Reports > Movimientos subtab**: removed "Top 5 descripciones" and "Por día de semana" chart. Added Prom. ARS/día and Prom. ARS/mov KPIs (moved from Gastos).
- **`TIPO_COLOR`**: extracted to component level to avoid duplication between movCounts useMemo and render scope.

---

## [2.27.0] — 2026-06-22

### Added
- **Per-period budgets**: new Firestore subcollection `users/{uid}/presupuestos/{periodoId}` stores per-category budget amounts per period. CRUD in `services/firebase/presupuestos.ts`.
- **Budget edit sheet**: pencil button in "Por categoría" card opens a BottomSheet with per-category number inputs, pre-filled from the saved period budget or the default template. Guardar is gated by `isDirty` comparison against Firestore state.
- **Budget toggle**: "Presupuesto" pill button appears next to the pencil when a budget is saved. Off by default; activating it colors category bars red/yellow/green based on usage percentage and shows the budget cap to the right of each bar track. Resets on period change.
- **Category drill-down modal**: tapping any category row in "Por categoría" opens a BottomSheet listing all expenses for that category in the selected period, sorted by date desc. Shows budget status in the header when a budget is set.
- **Budget template in Settings**: new "Presupuestos" collapsible section in Settings for defining a default per-category budget that pre-fills each new period's edit sheet. Save gated by `isDirty`.
- **`Presupuesto` interface** and `presupuestoTemplate?: Record<string, number>` added to `ConfigUsuario.meta` in `types/index.ts`.
- **i18n**: budget translation keys added to `locales/es.ts` and `locales/en.ts`.
- **No number input spinners**: global CSS removes webkit/moz number input arrows.

### Changed
- **Move badge color in Movements**: daily summary badges now split Move transactions — `aDisponible` shows teal, `aAhorro` shows orange (was always orange).
- **Removed KPIs**: "Promedio diario" and "Prom. por mov." removed from Gastos KPI row in Reports (will reappear in a restructured Movements tab).

---

## [2.26.0] — 2026-06-19

### Changed
- **Onboarding redesigned**: 11-step tutorial replaced by a 3-screen quick setup. Step 0: welcome + optional name input. Step 1: day-to-day currency selector + "manage USD/EUR reserve?" toggle + conditional investment currency selector (USD/EUR). Step 2: biometric + push notification toggles. On finish: writes `nombre`, `monedaPrincipal`, `showAhorros`, `monedaInversiones`, and sets `showReportes: true`.

### Added
- **`hooks/useFirstVisit`**: localStorage-based hook that returns `[show, dismiss]` for a given key — persists dismissal across sessions.
- **`components/ui/SectionHint`**: dismissible info card (left accent border) shown once per section.
- **Contextual first-visit hints**: displayed at the top of Movements (only when movements exist), Reports, and Investments tabs on first visit. Dismissed individually with an ×.

### Removed
- Educational slide screens from onboarding (`obHowBody`, `obTypesTitle/Body`, `obTypeGasto/Ingreso/Move/Fx`, `obCurrencyTitle/Body`, `obPeriodTitle/Body`, `obSavingsVsInvestTitle/Body`, `obGainCalculationTitle/Body`, `obReportsTitle/Body`, `obInvestTitle/Body`, `obDoneTitle/Body`, `obSecurityBody` locale keys). The settings Guide section now uses `hintMovBody` for the how-it-works blurb.

---

## [2.25.9] — 2026-06-19

### Added
- **`/api/account/delete`**: new DELETE endpoint — verifies ID token, calls `adminDb().recursiveDelete(userDoc)` to wipe all Firestore subcollections (movimientos, config/*, recordatorios, plantillas), then `adminAuth().deleteUser(uid)`.
- **Export JSON**: replaced CSV export with a full JSON export (`movimientos[]` + `config.{categorias, mediosPago, origenesAhorro}`). Timestamps serialized as ISO strings. File named `finmoves_YYYY-MM-DD.json`.
- **Delete account UI** (Settings → Datos): button opens a ConfirmModal that requires re-authentication (email/password credential) before calling the delete API. On success: clears localStorage caches (`moves_uid`, `config_uid`), resets Zustand prefs, signs out, redirects to `/login`.
- **Permisos log (user-facing)**: non-owner users see their permission change history (key, activated/deactivated, motivo, date) under "Accesos" in the Datos card. Loaded via `getDoc(config/permisosLog)` on settings mount.

### Removed
- CSV export (`exportCSV`) and all `csvDate/csvType/csvCategory/…` locale keys — replaced by JSON export.

---

## [2.25.8] — 2026-06-19

### Performance
- **Firestore reads ~99% reduction**: eliminated blind full-fetch after every movement creation. `useAllMovimientos` now exposes `prependLocal(movs[])` — on create, `MovementModal` captures the Firestore-generated IDs from `addDoc` responses and inserts the new documents directly into local state + localStorage cache. No round-trip to Firestore needed.
- **`useAllMovimientos` simplified**: removed `isExplicitRefresh` fast path that bypassed the count check; all refreshes now go through `getCountFromServer` — only fetches the full collection when count actually differs (e.g., changes from another device).
- **`useConfig` cache**: config (meta + permisos docs) is now cached in localStorage with a 5-minute TTL. Subsequent page loads within the TTL window skip the 2-doc Firestore read entirely.
- **`data-context`**: `prependMovimiento` added to context and exposed to all pages.
- Multi-movement creates (main + RESTO + auto-ahorro) all handled optimistically in a single `prependLocal` call.

---

## [2.25.7] — 2026-06-18

### Fixed
- Include missing logo assets: updated `logo5-cropped.png`, added `logo-fm-1024.png`.

---

## [2.25.6] — 2026-06-18

### Changed
- **Reports / Movimientos**: Move split into `MoveAhorro` (orange) and `MoveDisponible` (teal) in bar chart, legend, por categoría, and por descripción — no longer grouped as a single "Move" bucket.
- **Movement modal**: Move type chip shows teal→orange gradient border when selected. "A Disponible" button uses teal; "A Ahorros" uses orange. Info box adapts color to active direction.
- **Colors**: replaced all `var(--teal)` references with hardcoded `#26c6da` in JS (CSS variable remains in globals.css).

---

## [2.25.5] — 2026-06-18

### Fixed
- **Move bolsas independientes**: `moveDisponible` and `moveAhorros` are now tracked as separate fields in `PeriodoResumen` instead of a single net `moveTotal`. This fixes auto-ahorro (Move/aAhorro) being mixed into the retiros KPI and move count.
- **Color distinction**: Move/aAhorro → orange dot/amount; Move/aDisponible → teal (`--teal: #26c6da`). New CSS variable added.
- **Label**: "Retiros" KPI renamed to "Move disponible" and colored teal.
- **ahorrosAcum**: `PuntoTendencia.ahorros` now includes `moveAhorros` so projections and `ritmoAhorroActual` correctly account for moves to savings.
- **Sub-label**: removed "desde ahorros" from Move disponible KPI.

---

## [2.25.4] — 2026-06-18

### Added
- **iOS install banner**: bottom sheet that appears in Safari (iPhone, not installed) after 1.8s. Shows two-step guide with icons — share button + add to home screen. Animated arrow pointing to Safari toolbar. Dismissible; persists via localStorage.

---

## [2.25.3] — 2026-06-18

### Added
- **PWA splash screens (iOS)**: added `apple-touch-startup-image` for 6 modern iPhone sizes (SE/8, X/XS/11 Pro, 12/13/14, 14 Pro/15/16, Pro Max variants). Dark background with centered FM mark.
- **Maskable icon 192px**: added `icon-maskable-192.png` to manifest alongside the existing 512px maskable. `build-logo.js` updated accordingly.

---

## [2.25.2] — 2026-06-18

### Fixed
- **Auto-ahorro**: was creating `Ingreso/Ahorros` (no deduction from disponible) instead of `Move/aAhorro` (correct transfer from disponible to savings). Historical movements migrated via one-off script.

---

## [2.25.1] — 2026-06-18

### Performance
- **Cron notifications**: replaced single unbounded `movimientos` collection read (all docs) with three targeted queries — `checkCargaOlvidada` reads 1 doc, `checkSueldo` reads 50, `checkMeta` filters by investment tipo only. Eliminated duplicate `config/push` read per user per run.
- **Client movimientos cache**: `useAllMovimientos` now stores movements in `localStorage`. On load, shows cached data instantly and runs a single Firestore aggregation count query; only fetches all documents when the count differs (add/delete from another session). Edit and delete mutations update the cache in-place (0 Firestore reads).

---

## [2.25.0] — 2026-06-17

### Added
- **Movement quantity trend KPI**: Reports now show trend of movement count vs. previous 3 periods (like spending trend). Green if fewer movements, red if more.

### Changed
- **Movement KPIs layout**: Reorganized 2x2 grid — day/biggest on top row, trend/average on bottom. Improved visual hierarchy.
- **Expense KPIs**: Removed "Free Days" KPI from expenses section.

---

## [2.24.1] — 2026-06-17

### Changed
- **Currency selector styling**: Primary currency now displays with green $ icon badge (matching investment currency style). Selected currency button highlights with green background + border. Button disabled when currency matches current selection.
- **Settings account section reordering**: Rearranged section order: Profile → Google Linked → Google Sheets → Currency → Backup → Admin (improved UX flow).

---

## [2.24.0] — 2026-06-17

### Added
- **Permission change audit log**: Admin panel now tracks every permission activation/deactivation with reason (Fix / Bug / Error), timestamp, and who made the change. Stored in `users/{uid}/config/permisosLog` for full audit trail.
- **Reason selection modal**: When changing user permissions, admin selects reason before confirming. Reason included in user notification.
- **Permission history view**: Admin panel shows last 3 permission changes per user with date/time.

### Changed
- **Push notification format**: Now includes timestamp of permission change (e.g., "Se activó Imágenes por: Fix (16-jun, 20:52)").
- **Admin user status UI**: Single "Última conexión" row shows green dot + "online" if currently online, or date/time of last sign-in if offline.

---

## [2.23.7] — 2026-06-17

### Fixed
- **Firestore query optimization in cron**: Added date filtering to reminders cron (`.where("fecha", ">=", today)`) to skip expired reminders. Reduces read ops during notification cron runs.

---

## [2.23.6] — 2026-06-16

### Fixed
- **Rate limiting on `/api/register`**: Added in-memory rate limiter (10 requests per minute per IP) to prevent brute-force registration attempts and bot spam on the public endpoint. Returns 429 with `Retry-After` header when limit exceeded.
- **Authorization on `/api/sync-sheets` POST**: Only the owner can trigger manual Google Sheets sync (was allowing any authenticated user). Closes authorization bypass.

---

## [2.23.5] — 2026-06-16

### Fixed
- **Notification cron efficiency**: `notifyAllUsers` now batch-reads all `config/push` docs in parallel and filters to active subscribers before processing, reducing Firestore read ops by ~50%. Pairs with Cloud Scheduler frequency change to every 6 hours (not hourly).

---

## [2.23.4] — 2026-06-16

### Fixed
- **Service Worker: RSC hardening**: Next.js Server Component Responses (`_next/data/*` or `next-router-state-tree` header) now use network-first strategy (not cached), preventing stale component responses during internal navigations. Falls back to cache only if network fails.
- **Service Worker: safer caching**: use `req.url` instead of `req` object in `caches.put()` to avoid Cache Storage rejection edge cases.

---

## [2.23.3] — 2026-06-16

### Fixed
- **Movements list**: GastoUSD/GastoEUR (internal reserve reductions) are no longer shown in the movements historial, dashboard "Latest movements", or the `/movements` list. They only affect the investment reserve, not the main account balance.

---

## [2.23.2] — 2026-06-16

### Fixed
- **Investment average cost / profit**: `calcularReserva` now uses a moving weighted-average cost processed chronologically. Selling/spending reduces the cost basis at the average price (not only the quantity), so "Precio prom." and "Ganancia" reflect the remaining holdings. Previously every sell inflated the average and pushed profit deeply negative.
- **Back button to /home**: the landing "Ingresar" CTA navigates with `replace`, so a logged-in user pressing back no longer lands on the marketing `/home`.

### Changed
- **Projection tooltip**: states the 3-period horizon.

---

## [2.23.1] — 2026-06-16

### Fixed
- **User document on sign-in**: `ensureUserDoc` creates `users/{uid}` with `createdAt` on email/Google login. The parent user doc was never written (all data lives in subcollections), so it showed as a phantom doc in the Firestore console — no data was ever lost. Firestore rules now grant the user read/write on their own `users/{uid}` document; this does not cascade to subcollections, and `config/permisos` stays write-protected.

---

## [2.23.0] — 2026-06-15

### Added
- **Theme toggle on the landing**: sun/moon button next to the language toggle that switches the app theme via `useTheme` (shared `finmoves-theme` key, applies app-wide). The Settings theme toggle is untouched.

### Fixed
- **Landing in light mode**: carousel arrows now use theme variables instead of a hardcoded dark background.
- **Hero**: now shows the name-less app icon plus "FinMoves" as visible text (the previous wordmark logo + added text was redundant), keeping the app name as crawlable text for OAuth verification.

---

## [2.22.1] — 2026-06-15

### Changed
- **Legal routes renamed to English**: `/privacidad` → `/privacy` and `/terminos` → `/terms` (folders + `PrivacyContent`/`TermsContent` components), with permanent redirects from the old paths in `next.config`.

### Fixed
- **OAuth homepage requirements**: the landing now renders the app name "FinMoves" as visible text and names the product + purpose in the hero description. Google OAuth verification had flagged that the homepage didn't describe the purpose and the name didn't match the consent screen.

---

## [2.22.0] — 2026-06-15

### Added
- **Landing redesign**: the feature grid is now a single-row auto-advancing carousel (one large phone screenshot at a time, info above, swipe on mobile, arrows on desktop, dots) using the real `/screenshots/*` assets.
- **Bilingual landing (es/en)**: language toggle on the landing; copy switches via `useAppPrefs.lang` (persisted). SSR renders es.
- **SEO**: enriched root metadata (`metadataBase`, title template, rich description, keywords, canonical, robots, Open Graph + Twitter with `alternateLocale: en_US`), dynamic Open Graph image (`app/opengraph-image.tsx`, branded 1200x630), `app/robots.ts`, `app/sitemap.ts`, and `WebApplication` JSON-LD on the landing.

### Fixed
- **Navigation / history**: unauthenticated `/` now redirects to the landing `/home` (front door) instead of `/login`, via `router.replace`. The landing route was renamed `/inicio` → `/home` (folder `app/home`, `HomeClient`), with a permanent redirect `/inicio` → `/home` in `next.config`. Logout also lands on `/home`. Login and logout switched from `router.push` to `router.replace`, so the back button no longer returns a logged-in user to `/login`.

### Changed
- **manifest.json**: trimmed `categories` to the standard vocabulary (`finance`, `productivity`); added `launch_handler: navigate-existing` and `handle_links: preferred`.

---

## [2.21.0] — 2026-06-15

### Security
- **Server-side permission enforcement**: user entitlements (`comprobantes`, `inversion`) moved out of the client-writable `config/meta` into a dedicated read-only `config/permisos` document. Firestore rules now deny client writes to `config/permisos` and the new `permisosLog` subcollection — only the Admin SDK writes them. Previously any authenticated user could self-grant permissions by writing `meta.permisos` from the client. `obtenerConfig` reads the separate doc and injects it into `meta.permisos`, overriding any local value, so the three consumer sites are unchanged. `/api/admin/users` reads/writes the new location. One-off migration `scripts/migrate-permisos.js` backfills existing users. **Requires a separate `firebase deploy --only firestore:rules`.**

### Changed
- **PWA screenshots**: manifest points to `public/screenshots/*` (previous `/pwa-*.jpeg` paths were removed and broke the install preview). Six labeled narrow screenshots for the mobile rich install UI. Desktop rich install still needs `wide` screenshots (pending assets).

---

## [2.20.1] — 2026-06-15

### Fixed
- **Build break (hotfix)**: a duplicate `borderBottom` key in the admin user-list button's inline `style` (introduced in 2.20.0) failed TypeScript type-checking ("object literal cannot have multiple properties with the same name") and blocked the App Hosting framework build, leaving the 2.20.0 deploy stuck. Removed the redundant key — no visual change. Production kept serving the previous good revision throughout.

---

## [2.20.0] — 2026-06-15

### Added
- **Landing `/inicio`**: redesigned with gradient title, 4 feature cards using app screenshots (`pwa-*.jpeg`) as backgrounds with dark overlay and hover lift effect, staggered fade-in animations, PWA install button (via `useInstallPrompt`) alongside the CTA.
- **Landing — legal modals**: footer links for Política de Privacidad and Condiciones del Servicio now open inline modals; standalone pages at `/privacidad` and `/terminos` remain for Google OAuth verification. Legal content extracted to shared components (`PrivacidadContent`, `TerminosContent`).
- **Admin — user detail card**: users list shows only email + push dot; tapping a user opens a floating BottomSheet with last sign-in timestamp, push status, and permission toggles (comprobantes, inversion).

### Fixed
- **Plantillas**: sorted by `usageCount` descending (most used first); amount hidden from chip — visible only after selecting. `usarPlantilla` increments counter in Firestore on each apply.
- **Investments — goal badge**: `reachedBadge` ("ALCANZADA") now renders in the savings goal card header when the target is met; the translation key existed but was never wired to the UI.
- **PWA `start_url`**: reverted to `/` — dashboard lives at root via `(tabs)` route group; `/movements` was incorrect.
- **globals.css**: added `.screen-card` hover class (`translateY(-6px)` + blue glow box-shadow).

---

## [2.19.0] — 2026-06-15

### Added
- **Admin — permission toggles**: clicking a toggle now shows a confirmation modal before applying. On success the affected user receives a push notification (e.g. "Se activó Inversión en tu cuenta") that navigates them to Settings, effectively triggering a config reload.
- **Admin — re-copy invite codes**: clicking an available code in the Administración panel opens the copy card again so you can share it without generating a new one.

### Fixed
- **COOP blocking Google popup**: added `Cross-Origin-Opener-Policy: same-origin-allow-popups` header so Firebase Auth popups (`linkWithPopup`, `signInWithPopup`) can communicate `window.closed` correctly.
- **Google profile sync**: `syncGoogleProfile` now reads name/photo from the popup result (`providerData` + `getAdditionalUserInfo`) instead of `auth.currentUser.displayName` which is empty after linking.

### Changed
- **Profile card**: "Perfil" section replaces "Cuenta → Usuario". The edit card is now a draggable bottom-sheet with a photo/name header at the top and language flags inline next to the change-password button.

---

## [2.18.4] — 2026-06-15

### Changed
- Public contact email switched to **info@finmoves.app** (Privacy, Terms, landing, VAPID subject fallback). Owner/login email unchanged.

---

## [2.18.3] — 2026-06-15

### Fixed
- **CSP was blocking Google sign-in and web fonts** (and could break login): the production Content-Security-Policy didn't allow `apis.google.com`/`gstatic.com` (Firebase Auth / Google sign-in), `fonts.googleapis.com`/`fonts.gstatic.com` (fonts), nor the Google auth frames. Added those to `script-src`/`style-src`/`font-src`/`frame-src`.

---

## [2.18.2] — 2026-06-15

### Added
- **Public landing page** at `/inicio`: describes the app's purpose (movements, reports, investment, reminders), notes invite-only access, links Privacy/Terms and a sign-in CTA. Meant as the OAuth consent screen "home page" (public, no login wall).

---

## [2.18.1] — 2026-06-15

### Added
- **Public legal pages**: `/privacidad` (Privacy Policy) and `/terminos` (Terms of Service), unauthenticated, linked from the login footer — for the Google OAuth consent screen. Both note the closed, invite-code-only access.

---

## [2.18.0] — 2026-06-15

### Added
- **Sign in with Google**: button on login (registration stays closed by invite code — a brand-new Google account is rejected) and **Link Google** in Settings → Account. On link/sign-in, the Google **name overwrites** the stored name and the **profile photo is copied to Storage** (stable URL) and shown as avatar.

### Fixed
- **Admin permissions were written/read at the wrong doc level** (top-level instead of under `meta`), so per-user permissions (images/investment) and the name weren't applied/read. Now uses `meta.permisos` / `meta.nombre`. Permissions toggled before this fix need to be re-toggled.

---

## [2.17.1] — 2026-06-15

### Changed
- **Smarter reminders**: a pre-notice fires when ≤3 days remain ("in N days: …" / "tomorrow: …"), once (deduped via `avisadoPre`); the on-date notice then deletes the reminder (single final ping). Removed the obsolete `notified` state from the model/UI.

---

## [2.17.0] — 2026-06-15

### Added
- **Sell (Venta) reserve action**: new `VentaUSD`/`VentaEUR` movement type. A sale lowers the FX reserve (like Spend) **and** adds the ARS to the period's available (income). Stores the exchange rate. Cost-basis is left as-is (model A; realized-gain accounting deferred). Reserve recomputed correctly in Investment, Reports, goals and the cron meta check. Reserve type selector: Buy (green) · Sell (red) · Spend (blue).

### Changed
- **Add form — Type row is now 80/20**: types take the width; "Save as template" is an icon-only button (20%).
- **Movements — FX color**: Buy/Sell USD/EUR show in the yellow FX color (dot + amount, with their sign); plain expenses red, transfers orange, income green.

---

## [2.16.0] — 2026-06-15

### Changed
- **Reminders modal** is now a centered floating card (was a bottom sheet).
- **General section reorder**: Dark mode → Notifications → Reminders → Fingerprint unlock → Reports → Auto-savings. Fingerprint unlock moved here from Account.
- **Reminders access turns green** when there's at least one reminder loaded (orange otherwise).
- **Background scroll is locked** while any modal/sheet is open (new `useScrollLock` hook, used by BottomSheet, ConfirmModal, KpiInfoModal, MediaViewer, movement detail and the settings modals).
- **Back gesture/button no longer cycles through tabs**: tab navigation uses `replace` (BottomNav + swipe), so Back exits the app instead of walking the in-app history.

---

## [2.15.2] — 2026-06-15

### Fixed
- **Swipe nav broke scrolling inside modals**: all modals/sheets (BottomSheet, ConfirmModal, KpiInfoModal, MediaViewer, auto-savings, changelog, users, invite, sync log, movement detail) now carry `data-no-swipe`, so gestures starting inside them no longer trigger tab navigation. Since sheets are portaled to `body` and the swipe listens on `window`, this is what stops the conflict.

---

## [2.15.1] — 2026-06-15

### Changed
- **Auto-savings modal** is now a centered floating card (was a bottom sheet).
- **Notifications + Reminders** moved to the top of the General section (above Dark mode).
- Removed the non-actionable **"Main currency"** row from General (it couldn't be changed there).

---

## [2.15.0] — 2026-06-14

### Added
- **Admin panel (owner-only)** in Settings → "Administración": invite codes (lists only available ones, manual delete, **24h auto-expiry** for unused codes — enforced on registration + cron cleanup + on open) and a **registered users** list (email as primary, name + the invite code they used as secondary, push status dot).
- **Per-user permissions** managed by the owner, both **default OFF**: **Images** (receipt upload) and **Investment**. Enforced: no Images permission → no receipt option in the add sheet; no Investment permission → the user loses the Investment tab/section entirely and can't re-enable it (forced in `data-context`).
- APIs: `/api/admin/users` (GET list, POST set permission, owner-gated), `invite-codes` GET (available) / DELETE + 24h expiry.

### Changed
- **Settings reorg**: Notifications + Reminders moved into **General**; the Investment toggle + currency moved into the **Investment** section (above goal config), shown only when the user has the Investment permission.

---

## [2.14.2] — 2026-06-14

### Fixed
- **Bottom sheets mispositioned/translucent**: `BottomSheet` now renders via `createPortal` to `document.body`, so it's no longer captured by a transformed ancestor (the page's `.fade-up` animation uses `both` fill, which keeps a `translateY(0)` transform and creates a containing block). Fixes the Reminders sheet appearing mid-page and washed out; also hardens the reports modals and add/edit sheet.

---

## [2.14.1] — 2026-06-14

### Fixed
- **Swipe nav too sensitive**: gestures that start inside a horizontally-scrollable element (charts, carousels, year/period chips) no longer switch tabs. Raised the swipe threshold (80px and 2× horizontal-over-vertical).

### Changed
- **Update banner now shows on every new version** (was minor/major only). Removed the semver gate in `useUpdateBanner`.

---

## [2.14.0] — 2026-06-14

### Added
- **Push reminders**: two new cron-based notifications. **Forgot-to-log** ("it's been N days since your last movement", ≥3 days, deduped per gap, re-armed when you log again) and **custom reminders** (free text + date) created/managed from a new "Recordatorios" sheet in Settings (shown when notifications are on). Stored in `users/{uid}/recordatorios`; the cron sends on/after the date and marks them sent. New `services/firebase/recordatorios.ts`.

### Changed
- Salary reminder threshold 33 → **30 days**.
- **"Save as template"** moved to the top of the add form, next to Type (50/50 grid).

### Removed
- **New-version push notification** (the semver-based update banner already covers updates; removed the changelog-count push to avoid redundant pings).

---

## [2.13.0] — 2026-06-14

### Added
- **Expense templates (1-tap)**: save a frequent expense as a template ("Save as template" from the add form), then reload it with one tap from a chip row (prefills category, amount —editable—, description, payment method, notes). Each chip has an × to delete (with confirm). Stored in `users/{uid}/plantillas`. Templates show only for the Gasto type in add mode. New service `services/firebase/plantillas.ts`.

### Fixed
- **Move color on the Dashboard**: the Move type now uses `--orange` on the home screen too (was still `--yellow`; the edit was missed in 2.12.1).

---

## [2.12.1] — 2026-06-14

### Changed
- **Movements collapsed days**: each day is wrapped in its own card; collapsed days show a per-type count summary, colored (green income · yellow USD/dollars · orange Move · red expenses, expenses rightmost). The most recent day is always open.
- **New `--orange` color for the Move type** (`#ff6e40`), applied everywhere Move was shown (dot, amount, type button, onboarding legend, reports type maps, collapsed counts). Yellow now means only USD/dollars.
- **Update banner trigger is semver-based**: shows on MINOR/MAJOR bumps (compared client vs `/api/app-version`), silent on PATCH (auto-updates on cold start). `REQUIRE_UPDATE` kept as a manual override to force the banner on a critical patch.
- **CHANGELOG_USER curated by user-relevance** (benefit over mechanism); removed purely technical entries (2.10.3 install screenshots, 2.5.1 biometric reload, 2.3.1 analytics, 2.1.1 internal perf).

---

## [2.12.0] — 2026-06-14

### Added
- **Collapsible days in Movements**: only the most recent day starts expanded; older days collapse to a summary row (date · count · total spent) and expand on tap. Kills the infinite scroll over ~15 days. Switching period/year resets to the latest day open; editing doesn't collapse what you opened.
- **Shared `BottomSheet`**: extracted the canonical draggable sheet (peek/close drag) from MovementModal into `components/ui/BottomSheet`. The four Reports modals (salary history, direct-to-savings, top lists, day detail) now use it — salary/savings were old centered cards, the others had ad-hoc drag state.

### Changed
- **Update banner is now required-only**: the app auto-updates on the next cold start (no nagging). The banner only appears when the server reports a required update (`REQUIRE_UPDATE` in `lib/app-version`, exposed via `/api/app-version`) and the running version differs. The button is now "Update" (was "See changes"), has no dismiss X (persistent), and forces `SKIP_WAITING` + reload.

---

## [2.11.0] — 2026-06-14

### Added
- **Swipe navigation between tabs**: horizontal swipe moves to the adjacent tab, respecting the nav order and hidden tabs. Gestures starting within `[data-no-swipe]` (carousels, scrollable chips, media viewer, entry sheet) or within 24px of either edge are ignored, so the iOS back-gesture and horizontal scrollers keep working. Smooth `tabFade` transition on change.
- **Period stats — median & variation**: the Periods tab now shows the **median** spend per period (resistant to outliers, unlike the average) and a **variation** KPI (coefficient of variation, `±X%`) colored by regularity (green ≤25%, yellow ≤50%, red >50%). Best/worst period KPIs moved up next to them.

### Fixed
- **Next-period projection KPI** no longer repeats "average of last 3" twice in its explanation.

---

## [2.10.3] — 2026-06-14

### Added
- **PWA install screenshots**: the manifest now ships three `narrow` (mobile) screenshots (login, reports, settings), so the browser's install prompt and richer install UI show a preview of the app before installing.

---

## [2.10.2] — 2026-06-14

### Performance
- **Editing or deleting a movement no longer re-reads the whole collection**: the change is applied optimistically in memory (the Firestore write is awaited first, so the DB stays the source of truth). Eliminates N extra reads per edit/delete and makes the UI instant. New movements still do a full refresh (they can spawn carry-over/auto-savings docs).

### Fixed
- Edit/delete now show a visible error message if the write fails (previously only logged to console).

---

## [2.10.1] — 2026-06-14

### Changed
- **Modernized bottom sheet**: blurred backdrop, smoother decelerated entrance, larger radius and top shadow. The **grab handle is now functional** — drag down to shrink the sheet to a peek (without losing what you typed), drag up to restore, drag far down to close.

### Performance
- **Receipt images are compressed/resized on upload** (max 1600px, JPEG ~0.8) so they go from several MB to a few hundred KB and load much faster; uploads now set a long `Cache-Control` so re-viewing is instant.

---

## [2.10.0] — 2026-06-14

### Added
- **KPI detail card**: report KPIs (Expenses, Income, Movements, Periods) and the Investment goal mini-stats are now tappable — a centered floating card shows the **exact number** (un-abbreviated) plus a short explanation. Cards were stripped of secondary text for a cleaner look.
- **Unified floating confirm/detail modals**: deleting a movement, deleting categories/methods/origins (long-press), all Settings warnings (leave-to-GitHub, export, sign-out, language), the Investment history detail (read-only) and the salary raise history now open as centered floating cards instead of bottom sheets.

### Changed
- **Reports**: "vs previous period" now shows the **difference in $** (what the % represents) instead of the previous total; "fastest-growing category" shows the previous-period amount. Trend explanation clarified (red = spending more, green = less). The period **"Compare" button renamed to "Multiple"** (it selects several periods).
- **Investment**: average price + gain/loss merged into the reserve hero as a compact line (removed the two large cards), for USD and EUR.
- **Receipt viewer**: image framed (rounded corners + shadow) and the backdrop is more transparent so the app stays visible behind.

---

## [2.9.1] — 2026-06-14

### Added
- **In-app media viewer for receipts**: tapping a receipt opens a full-screen viewer inside the app instead of the raw Storage URL. Images support **pinch-zoom**, double-tap zoom and drag-to-pan; PDFs open in an embedded iframe. Close with ×, tap-outside or Escape. New `MediaViewer` component (no external deps).

### Fixed
- CSP `frame-src` now allows `firebasestorage.googleapis.com` so the PDF iframe isn't blocked in production.

---

## [2.9.0] — 2026-06-14

### Added
- **Reserve loading from the Investment screen**: a green floating "+" opens a dedicated **Reserve** modal (+Reserve / −Reserve) in the active investment currency. Reuses the FX logic (USD/ARS entry, official/blue rate). Compact ~3-tap layout: Type + Date on one row, "Enter in" + "Rate" in a single grid, rate pills without value (value shows in the editable input below).
- **Available / Remaining preview** in a +Reserve: subtle line under "Total ARS" showing the period's available balance and what remains after the purchase, live. Color by how much the purchase consumes: <30% green, 30–70% yellow, >70% (or negative) red.
- **Reserve history shows withdrawals too** (−Reserve), in red with a "−" sign, alongside purchases. Title is now "USD/EUR history".
- **History detail (read-only)**: tapping a history row opens a read-only detail (Type · Category · Date, Quantity + Rate, Amount, Description, Notes, receipt link). Editing remains only from Movements.

### Changed
- **Reserve loads removed from the regular movement modal** (the +/− USD/EUR pills); they now live only in the Investment screen. Editing existing reserve movements still works from Movements.
- Investment history limited to the **last 5** with a "see more / see less" toggle.

---

## [2.8.1] — 2026-06-14

### Fixed
- **UI prefs leaking between users on the same device**: `monedaInversiones`, `showAhorros` and `showReportes` were stored only in `localStorage` (device-global) and never cleared on logout, so a different account's currency/section choices bled into yours. They are now persisted **per-user in `config.meta`** (Firestore is the source of truth), **hydrated from config on load** (in `DataProvider`), and the prefs store is **reset on every sign-out** (manual logout, password change, 8h inactivity, biometric "use password"). Settings/onboarding toggles now write these prefs to config.

---

## [2.8.0] — 2026-06-14

### Added
- **Manual exchange rate** (Settings → Investment): a switch toggles between automatic (bluelytics) and a manual value. When manual is on, the entered rate replaces the official rate **in the investment valuation** for the active investment currency. Stored per-user in config. The Investment section header shows `manual` instead of `oficial` when active.
- **Delete via long-press**: long-pressing a movement (Movements list or Home) opens the delete confirmation directly (short haptic). The trash icon was removed from the edit modal. A salary that anchors a period still can't be deleted (long-press opens edit instead). New `useLongPress` hook.

### Changed
- **The user's exchange rate is now always the official one** (blue is only selectable when loading an FX purchase/expense). Default config `tipoCambioRef` changed `blue → oficial`; the dead blue/oficial selector in the Investment page was removed.
- **Investment header**: big gradient title is now the section name (**Inversión** / Portfolio) with the currency moved to the small eyebrow.
- **Reports are no longer configurable**: the per-section KPI/Other-data toggles were removed (along with `useReportConfig`); the Reports screen always shows everything. Only the on/off toggle in General remains.
- **Settings → Account opens by default** when entering Settings.
- **Edit movement** layout: read-only chips (Type · Category · Date) on one row, then an editable **Amount 30% / Description 70%** row; receipt is a compact 📎 next to **Notes 70% / Receipt 30%**. "Notes" dropped the "(optional)" suffix.
- **Changelog modal**: the header "+" was replaced by a **"see more"** link at the bottom (italic, same pattern as Home/Reports) that opens the full web changelog with the leave-site warning.

### Removed
- **Vercel** fully removed: `@vercel/analytics` + `@vercel/speed-insights` packages and their components in `layout.tsx`, plus the `.vercel` gitignore entry. Firebase Analytics (GA4) stays.

---

## [2.7.0] — 2026-06-14

### Added
- **Smart description suggestions**: the description field autocompletes from your own past expense descriptions, filtered by the selected category (top 8 by frequency, native datalist).
- **Changelog "+"**: a button in the changelog modal opens the full `CHANGELOG_USER.md` on the web (GitHub), with a "you're leaving the site" confirmation first.

### Changed (new-movement form)
- Receipt attach moved to the bottom row — grid is now **Notes 50% / Receipt 25% / Submit 25%** — and works for all types (incl. Move/FX). The attach is just a larger 📎 icon (no dashed box).
- **Reserve loads (+USD/-USD/+EUR/-EUR) are hidden when the Investment section is off** (`showAhorros`).

### Repo
- GitHub repository renamed to `dsimdev/finmoves.app`; local remote updated.

---

## [2.6.2] — 2026-06-14

### Changed (new-movement form)
- **Receipt attach is now a single icon** at the right of the payment-method row (same grid), instead of a full dashed box. Shows a small thumbnail/📄 with remove when attached.
- **Notes + submit share one row** (70% notes / 30% submit checkmark).
- The auto-savings hint now only appears **once a description is entered** (and still hidden for skip-list descriptions).

---

## [2.6.1] — 2026-06-14

### Changed (new-movement form)
- **Amount is now the first field**, on a compact row next to the date (which is pre-filled), so the most common entry is faster. The standalone amount/date fields below were removed.
- Home shortcut relabeled **"Movimiento"** / "Movement" (kept "Movement" in EN since "Move" is already the transfer type).

---

## [2.6.0] — 2026-06-14

### Added
- **Receipts now accept PDFs** (not just images): file picker accepts `image/*,application/pdf`, non-image attachments show a 📄 PDF tile (click to open). `storage.rules` updated to allow `application/pdf` (≤10 MB) — **re-publish the rules in the console**.

### Changed
- Home "New movement" shortcut label shortened to just **"Nuevo"** (the modal title stays "Nuevo movimiento").

---

## [2.5.1] — 2026-06-14

### Fixed
- Removed the `controllerchange` → `window.location.reload()` in the service worker registration. It was a leftover from the old skip-waiting update flow and could reload the page right when unlocking with biometrics, so the update/changelog notice never had a chance to appear. SW updates still apply silently on the next cold start.

---

## [2.5.0] — 2026-06-14

### Added
- **Receipt attachments**: attach **one image per movement** (add & edit) stored in **Cloud Storage** under `users/{uid}/comprobantes/`. Thumbnail with open/replace/remove; the file is deleted when the movement is deleted. New `comprobanteUrl`/`comprobantePath` fields. Feature-gated to the owner for now (`canComprobante`), trivially extendable to a premium tier later.
- `storage.rules` added (per-user isolation, images only, ≤10 MB). Firebase Storage must be enabled and the rules published in the console.

---

## [2.4.2] — 2026-06-14

### Fixed
- The auto-savings hint ("+$X to savings") in the new-expense form now respects the **skip-descriptions** list: if the typed description is one that auto-savings ignores, the hint no longer shows (matches the actual behavior, cleaner form).

---

## [2.4.1] — 2026-06-14

### Performance (service worker)
- Immutable `/_next/static/` assets are now served **cache-first** (they're content-hashed, so they never change) instead of stale-while-revalidate — removes redundant background re-fetches on every load, cutting non-cached CDN requests.

---

## [2.4.0] — 2026-06-14

### Added
- **Bidirectional Move**: the Move form now has a direction toggle — **To Available** (classic: Savings → Available) and **To Savings** (new: Available → Savings). Both net into the same `moveTotal` (signed) and the same accumulated-savings pool, with opposite signs: "To Savings" lowers the period's available and raises accumulated savings. New `direccionMove` field; legacy Moves default to "To Available". Shown with a "−" sign where it leaves the available balance.

---

## [2.3.2] — 2026-06-13

### Changed (cron / notifications)
- The cron can now run frequently (e.g. hourly) for timely notifications: the **Sheets sync self-throttles to ~once a day** (`lastAutoSync` guard) while notifications are evaluated on every run.
- **Dollar-change alert is now frequency-independent**: the baseline re-anchors only when an alert fires, so it measures the *cumulative* move since the last alert instead of run-to-run (a gradual 3% daily move now triggers even when the cron runs hourly).

---

## [2.3.1] — 2026-06-13

### Added
- **Firebase Analytics** (GA4) initialized client-side only, guarded by `isSupported()` (`lib/analytics.ts` + `FirebaseAnalytics` component). `measurementId` added to the Firebase config (public, with literal fallback so it works without a new secret).
- CSP `script-src` now allows `https://www.googletagmanager.com` (gtag loader).

---

## [2.3.0] — 2026-06-13

### Changed (onboarding)
- Refreshed the onboarding wizard: updated the "how it works" step for the new salary flow (add to current / new period, leftover → Savings), added a **"Movement types"** step (Expense / Salary / Move / USD-EUR) and expanded the savings/reserve explanation.
- New **"Security & alerts"** step lets users enable **fingerprint unlock** and **notifications** right from onboarding (with availability checks), instead of only later in Settings.

---

## [2.2.0] — 2026-06-13

### Added
- **Update notice every 5 versions**: a banner (logo + spinner, like the loading screen) appears once ≥5 releases have shipped since the user last saw it. "See changes" opens Settings with the changelog modal (`/settings?changelog=1`). Dismiss/open marks the current version as seen; the count accumulates across patches instead of nagging on every one.
- The **new-version push** is aligned to the same 5-version cadence and deep-links to the changelog. Version distance is computed from `CHANGELOG_USER.md` (`lib/changelog-versions.ts`, shared client/server).

---

## [2.1.4] — 2026-06-13

### Fixed
- **Euro rate for new users**: exchange rate now comes from a server-cached `/api/cotizacion` route (shared across users + survives cold starts) with a `localStorage` fallback, and keeps the last good euro value if the upstream omits it. Fixes empty/wrong euro for fresh sessions.
- **Initial reserve follows the investment currency**: new `saldoEUR` config field. In EUR mode the "Initial reserve" field reads/writes/labels as EUR (was always USD, so an EUR user's seed was ignored). USD data untouched. Applied across Investments, Reports and savings-goal notifications.

---

## [2.1.3] — 2026-06-13

### Changed
- **Salary deletion rule**: a salary that **opens a period** (its date defines the `periodoId`) is the anchor and **cannot be deleted**; a salary **added to the current period** is now deletable. Detected via `fechaAPeriodoId(fecha) === periodoId`.
- Delete confirmation now shows an **"can't be undone"** warning (irreversible-action notice).

### Fixed
- Reverted EN dashboard title back to "Dashboard" (the "Resumen" rename is Spanish-only).

---

## [2.1.2] — 2026-06-13

### Changed
- **Home renamed "Tablero" → "Resumen"** (ES) / "Summary" (EN).
- Home shortcuts reordered: New movement · Investment · Reports.
- Offline banner moved from bottom to **top**.
- Loading spinner ring tightened around the logo (260→180px).

### Docs
- README fully updated (was stale at v1.14.5 / Vercel): Firebase App Hosting, custom domain, current routes, security, and the **mandatory deploy checklist** (incl. updating README every release).

---

## [2.1.1] — 2026-06-13

### Performance
- `MovementModal` no longer fetches `config/meta` on its own — it receives `config` as a prop from the shared `DataProvider`. Removes a duplicate Firestore read on every visit to Home and Movements.

### Security
- **Content-Security-Policy** header added (production only): locks down `object-src`, `base-uri`, `form-action`, `frame-ancestors`, restricts `frame-src`/`connect-src`. `script-src`/`style-src` keep `'unsafe-inline'` (required by Next/React inline scripts and `style={{}}`).
- **Invite-code registration is now atomic**: the code is reserved inside a Firestore transaction before creating the account, preventing a parallel-request race that could reuse one code twice. The code is released if account creation fails.

---

## [2.1.0] — 2026-06-13

### Added
- **Salary period control**: when adding a salary income, non-owner users get a **"Add to current / New period"** toggle. The owner and the first-ever salary always open a period (no choice). Lets daily/variable earners (e.g. a photographer) log income throughout a cycle and decide when a new period starts.
- **Period close + carryover**: opening a new period now moves the previous period's **leftover available** into the new one as a `RESTO` movement (counts as Savings) — implements the close/carryover that was previously only done by the obsolete Google Form.
- **Editable description on salary movements** (add + edit). Delete stays locked for salaries (they anchor the period).

### Changed
- **Password change** now **reauthenticates** with the current password (new "current password" field), fixing `auth/requires-recent-login`. On success it signs the user out and redirects to login to sign in with the new password.
- Movements floating **+** button visibility **inverted**: hides while scrolling, reappears when idle (no longer covers the list).

### Removed
- **Test notification** button and the `/api/push-test` endpoint.

---

## [2.0.0] — 2026-06-13

Milestone release marking the move to **Firebase** as the single home for the app
(frontend on App Hosting + Firestore + Google Cloud). No breaking changes for users;
the major bump marks the platform/infra shift and the body of work shipped in the 1.2x–1.30 line.

### Highlights since 1.2x
- **Platform**: migrated hosting from Vercel to **Firebase App Hosting** (`apphosting.yaml`, secrets via Secret Manager, scale-to-zero); daily cron moved to **Cloud Scheduler**.
- **PWA standard**: adaptive theme-color via `viewport` export, real `/offline` page, SW precache + navigation preload, install button, manifest shortcuts.
- **UX**: New/Edit movement modals open from Home; app icon badge; reusable `MiniStat`; touch-friendly Reports period selector; investments & dashboard redesign.
- **Performance**: single shared `DataProvider` (movimientos + config fetched once per session).
- **Notifications**: all-users push with savings-goal milestones and salary reminders (idempotent).
- **i18n**: full ES/EN sweep including page titles.

---

## [1.30.0] — 2026-06-13

### Added (notifications)
- Cron now notifies **all users** with a push subscription (was owner-only): new version + dollar change, plus two new triggers — **savings-goal milestones** (50/75/100%) and a **salary reminder** when a period is overdue (>33 days).
- Sheets sync + sync-failure alert remain **owner-only**.
- All notification triggers are **idempotent** (deduped via `config/notifyMeta`), so the Cloud Scheduler job can run more than once a day without spamming. New `lib/notifications.ts`.

---

## [1.29.2] — 2026-06-13

### Removed
- Update banner ("new version available"). The service worker now applies updates silently on the next cold start; removed `UpdateBanner` + `useSwUpdate`.

---

## [1.29.1] — 2026-06-13

### Fixed
- Push notifications: `enablePush` now always unsubscribes any stale subscription and re-subscribes with the current VAPID key (fixes activation breaking after the VAPID pair was regenerated). Toggle surfaces the real error if it still fails.

---

## [1.29.0] — 2026-06-13

### Added
- Reusable `components/movements/MovementModal` (add/edit/delete) extracted from the Movements page.
- Dashboard now opens the New movement and Edit modals **in place** (no navigation): the "New movement" shortcut and tapping a recent movement open the modal on Home.
- App icon **badge** (Badging API) showing the current period's movement count on the installed app.

### Performance
- Single shared `DataProvider` (movimientos + config) at the tabs layout: data is fetched **once per session** and reused across tabs instead of re-fetching the whole collection on every tab switch — large cut in Firestore reads.

### Infra
- Added `apphosting.yaml` for Firebase App Hosting (scale-to-zero, env via Secret Manager). Cron must move to Cloud Scheduler (vercel.json is inert on Firebase).

---

## [1.28.0] — 2026-06-13

### PWA standard
- Unified, theme-aware `theme-color` (dark `#07090f` / light `#c8c8c8`) kept in sync by `applyTheme`; migrated `<head>` `theme-color`/`viewport` to Next's `viewport` export.
- Added a real cached `/offline` fallback page (shown by the SW when offline and the route isn't cached).
- Service worker: precache the offline page + core icons (best-effort `cache.add`), enabled **navigation preload**, navigation fallback now `req → / → /offline`.

### Refactor / cleanup
- Extracted the duplicated Sheets-sync core into `lib/sync-sheets.ts` (`syncUserMovimientosToSheet`); manual and cron routes now share it.
- Single reusable `components/ui/MiniStat` (was duplicated in Reports, Investments and Dashboard); Movements now uses the shared `EyeIcon`.
- Extracted the inline theme bootstrap to `lib/theme-init.ts` (single source for light vars + theme colors, used by `useTheme` too).
- Removed the unused `/api/version` route.
- Reorganized `components/` into `ui/`, `pwa/`, `nav/`.
- `.gitignore`: ignore local `/scripts/`.

---

## [1.27.1] — 2026-06-13

### Changed
- Regenerated/optimized app icons and logo (smaller files). Version bump refreshes the service-worker cache so devices pick up the new icons.
- `.gitignore`: ignore local `/scripts/` (asset generators, not part of the app).

---

## [1.27.0] — 2026-06-13

### Changed (Dashboard redesign)
- KPIs (Salary/Spent/Savings/Withdrawals) restyled as consistent `MiniStat` cards.
- Added a quick-actions row: New movement · Reports · Investments.
- Latest-movements rows are now tappable; tapping deep-links to Movements and opens that movement in the edit modal (`/movements?m=<id>`).

### Changed (Movements / Investments)
- Movements list: removed the per-row pencil button; tapping anywhere on a movement opens the edit modal (larger tap target).
- Investments mini-stats: restored the standard border (matches Reports) now that the Goal card is neutral.

---

## [1.26.0] — 2026-06-13

### Changed (Investments redesign)
- Applied the Reports "Hero + mini-stats" pattern: reserve hero (USD/EUR) kept the yellow gradient; Goal and history cards now use the neutral surface gradient with standard borders.
- Reserve avg-price/profit and Goal stats moved into borderless `MiniStat` cards; profit shows signed % as sub.
- Cleaner hero rate line ("≈ $… · oficial $…", dropped "cotiz.").
- Unified metric window to the **last 3 periods** for the Goal mini-stats (Per period, Projection, To goal); "Per period" now uses avg saved (was lifetime/accumulated). Numbers formatted with thousands separators.
- Labels to sentence case (Precio prom., Ganancia).

---

## [1.25.1] — 2026-06-13

### Changed
- Settings: Backup icon now uses the accent color (matches the invite-code row).
- Removed redundant right-pointing chevrons on action rows (profile, invite code, change-password) — the icon/row itself performs the action.
- Sync (Google Sheets): removed the separate clock button; the whole row now opens the sync history (consistent with other config rows). Retry-on-error button kept.
- Reports/Expenses: "fastest-growing category" card now uses the standard border (gradient kept); removed the multi-period "Días" mini-stat.
- Reports period selector reworked for touch: replaced long-press multi-select with an explicit "Comparar" toggle (single tap selects one; in compare mode taps add/remove periods, year tap toggles the whole year); larger tap targets.

---

## [1.25.0] — 2026-06-13

### Added (i18n — Bloque 2)
- Full i18n sweep of remaining hardcoded UI strings; no database values were altered.
- Page gradient titles now translate (Dashboard/Movements/Reports/Settings + Dollars/Euros).
- New common keys: `edit`, `copy`, `clear`, `show`, `hide`, `of`, `movementsShort`, `unexpectedError`, `byPaymentMethod`, `rateOfficial`/`rateBlue`, `pageTitle*`, `currencyDollars`/`currencyEuros`.

### Changed
- Dashboard "de … · N mov.", Movements editor labels (Type/Category/Date), "Notes (optional)", delete "Cancel", aria-labels (Edit/Clear/Copy/Show/Hide), Reports "Por medio de pago", Investments rate name (oficial/blue) — all now go through the translation layer.

### Notes
- Brand/technical terms left as-is by design: Google Sheets, GitHub, Backup, Changelog.

---

## [1.24.2] — 2026-06-13

### Added
- Profile modal: **change-password** is now a collapsible row (lock icon → reveals field with show/hide eye + 6-char hint); no empty input dangling.
- Active-state colors: **biometric** and **notifications** icons turn green when enabled.

### Changed
- Invite code: removed the "Generate" button; the whole row is the action and the icon shows a spinner while generating (owner only).
- Profile "Save" button is disabled until there are actual changes (name edited or new password typed).
- Reports/Income: "Evolución ingresos" chart now uses the standard card border (removed the green tint) for visual consistency.
- Reports savings projection now defaults to **3 periods** (was 6).

### Fixed
- Biometric lock no longer hides the update prompt: `UpdateBanner` is now mounted on the lock screen, so a new version can be applied without unlocking first.

---

## [1.24.1] — 2026-06-13

### Added
- **Install app** button in Settings (uses `beforeinstallprompt`; shown only when installable and not already installed).
- Manifest **shortcuts** (New movement · Reports · Investments), `display_override` and `prefer_related_applications`.

### Notes
- Manifest screenshots pending real captures.

---

## [1.24.0] — 2026-06-13

### Added
- **User profile modal** — tapping the User row opens a modal to edit name and change password. Once a name is set, the user icon turns green and the name replaces "User".
- Language flags moved into the profile modal.
- **Guide section** in Settings (below Reports): explains how the app works + what each section does, with a "Replay the tutorial" button that reopens the onboarding in replay mode (without touching config).

---

## [1.23.3] — 2026-06-13

### Changed
- Reports → Periods: hide the period selector (year + period pills) since it's a historical view of all periods, not a single one.

---

## [1.23.2] — 2026-06-13

### Changed
- Reports → Periods fully redesigned: removed the 6 per-period KPIs that duplicated other sections (Salary, Withdrawals, Spent, Available, Projection, Remainder). Now it's a clean historical/comparative view — hero "Avg. spent / period", Best/Worst mini-stats, and the three period charts (spent per period, expenses vs salary, income evolution).

---

## [1.23.1] — 2026-06-13

### Changed
- Reports → Movements redesigned: hero with total + per-type distribution bar/legend, plus mini-stats (most active day, avg per day, biggest movement — excluding salary/remainder).

---

## [1.23.0] — 2026-06-13

### Changed
- Reports → Income redesigned to hero + mini-stats (Salary still opens raise history; Savings projection keeps its 3/6/12p toggle).
- Income: removed "By category", kept "By description" — now counting Salary and previous-period remainder (previously filtered).
- Income "Direct to savings": shows last 5 with a "see more" modal.
- Reports cards use a consistent subtle border (heros included).

---

## [1.22.5] — 2026-06-12

### Changed
- Reports → Expenses mini-stats polished: top row in 3 columns (centered), second row in 2 columns (centered), reordered, and labels shortened to remove the repeated "expense/gasto" (Daily pace, Daily average, Peak day, Avg. per item, Free days).

---

## [1.22.4] — 2026-06-12

### Fixed
- Reports → Expenses: mini-stats now use a flex-wrap layout so the last incomplete row stretches to fill the width (no more empty black gap).

---

## [1.22.3] — 2026-06-12

### Fixed
- Reports → Expenses: mini-stat values were getting cut off; amounts now use a compact format ($1,6M / $109k) so they fit.

---

## [1.22.2] — 2026-06-12

### Changed
- **Guided new-user start** — with no period yet, the New movement form only offers Income → Salary (other types hidden, category forced) to steer the user into opening their first period.
- Dashboard "see more" is hidden when there are 5 or fewer movements.
- The Google Sheets sync row is now shown only to the owner.

---

## [1.22.1] — 2026-06-12

### Fixed
- **New users couldn't add their first movement** — there was no active period, and the form required one. Now the first Salary opens the period using its own date.
- Salary description box no longer shows the Move text (it was hardcoded in English); now correctly says "The salary opens a new period" / first-period variant, translated.

### Changed
- **USD initial reserve is now per-user config** (`saldoUSD`) instead of a hardcoded 5.77 — new users start at 0. Added an "Initial reserve (USD)" field in Settings → Investments to set it.
- New movement modal fully translated (labels, texts, aria-labels) via i18n.
- Reports → Expenses redesigned: Hero (Spent) + compact neutral mini-stats.
- Reverted the "Code" row back to its full title + subtitle.

---

## [1.22.0] — 2026-06-12

### Added
- **Invite-code access** — new accounts are created via a single-use code. The login has a "Create account" form (email + password + code); `/api/register` validates the code with the Admin SDK and seeds a generic starter config. Firebase public signup stays closed.
- **Invite-code generator** (owner only) — Settings → Account → "Code" → Generate; opens a modal with the code and a copy button.
- **Password recovery** — "Forgot your password?" on the login (Firebase reset email).
- **Onboarding wizard** (bilingual) for new users: Welcome → How it works → Main currency → Investing? → Done. Redirects there automatically until completed (`onboardingCompleto` flag).
- **PWA manifest completed** — added 192/512 icons, a separate maskable icon with safe zone, apple-touch-icon, plus `id`, `scope`, `orientation`, `lang`, `categories`.

### Changed
- New users get a **generic default config** (neutral categories/methods) instead of the owner's personal data.
- Movements "+" FAB raised a bit so it no longer overlaps the bottom nav.

### Fixed
- LCP warning: the loading spinner image now uses `priority`.

### Notes
- Requires `NEXT_PUBLIC_OWNER_EMAIL` in Vercel for the invite-code generator to appear in production.

---

## [1.21.1] — 2026-06-12

### Added
- **Test notification** — `/api/push-test` endpoint (auth-protected) and a "Test" button next to the Notifications toggle to fire a sample push on demand

---

## [1.21.0] — 2026-06-12

### Added
- **Push notifications** — opt-in toggle in Settings → Account (shown only on supported devices). Subscribes via Web Push (VAPID), stores the subscription in Firestore (`users/{uid}/config/push`), and the service worker renders the notification + handles clicks
- Three server-side triggers wired into the existing daily cron (no extra cron needed):
  1. **Sync failure** — notifies when the daily Google Sheets sync fails
  2. **New version** — notifies once when the deployed build version changes
  3. **Dollar move** — notifies when the official USD rate moves ≥3% vs. the previous day
- `lib/web-push.ts` (server send helper; auto-removes expired subscriptions on 404/410) and `lib/push-client.ts` (permission + subscribe/unsubscribe)

### Notes
- Requires `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` env vars in Vercel
- Works on the installed PWA (Android; iOS 16.4+ installed to home screen)
- Triggers evaluate once per day with the cron; version/dollar checks compare against the previous run, so the first run only seeds the baseline

---

## [1.20.0] — 2026-06-11

### Changed
- **Investments page redesigned** — from 6 stacked cards down to 3 blocks: Reserve (hero) · Goal (consolidated) · History
- The four goal-related cards (savings goal, goal per period, projection, periods-to-goal) merged into a single **Goal** card: objective + progress bar on top, a row of inline mini-stats (Per period · Projection · To goal) below
- Currency symbol no longer repeated on every number — kept only on the Reserve headline and the goal objective; remaining figures are clean (remaining, per period, projection, history)
- Purchase history rows no longer append "USD"/"EUR" to each amount

---

## [1.19.0] — 2026-06-11

### Changed
- **Settings fully restructured into a single screen** — tabs removed; everything is now an accordion (one section open at a time). Order: Account (with Sync inside) → General → Movements → Investments → Reports → App row → logout
- **Categories / Methods / Origins → color chips**: tap to toggle (dimmed = off), long-press to delete (chip turns into a trash-confirm, auto-cancels after ~3s); categories grouped by type so new ones land at the end of their group
- **Reports toggles → chips** as well
- Language switch now opens a **confirmation modal** (flag + "Change language?") and reloads to Home on confirm
- Logout now opens a **bottom-sheet confirmation** (red button) instead of inline confirm
- Investments savings-goal: date + target side by side, tighter spacing, label shortened to "Target (currency)"; the destructive trash was replaced by a **broom that only clears the inputs** (user saves with the check)
- App block: removed the logo; GitHub + version/changelog + logout sit in one row
- Changelog modal now shows only the **last 5 versions**

### Added
- **User-facing changelog** (`CHANGELOG_USER.md`) — the in-app changelog reads this curated, plain-language file (highlights new features); the full technical `CHANGELOG.md` stays on GitHub

### Fixed
- **Update banner rebuilt around the service worker (proper PWA pattern)** — the SW is now served from `/sw.js` with the build version injected, so each deploy is detected; the new SW waits instead of activating silently, the banner offers to update, and confirming sends `SKIP_WAITING` → `controllerchange` → reload. Replaces the version-polling approach that the service worker had silently superseded

### Notes
- The update-banner change only validates in production; the first deploy with it is a transition (replaces the old SW). Reliable banner behavior starts from the second deploy that includes this system

---

## [1.18.1] — 2026-06-11

### Fixed
- **Sync history** now records automatic daily syncs too — previously the cron only stored "last sync / last error", so the history modal looked almost empty. Each cron run (success or failure) is now logged (last 30 entries)

### Added
- **Sync failure indicator** — a red dot appears on the Settings icon in the bottom nav when the latest sync failed, visible from any screen, so you know to take action

---

## [1.18.0] — 2026-06-11

### Added
- **Fingerprint unlock (opt-in)** — enable it in Settings → Account. When on, the app opens to a lock screen that asks for your fingerprint before revealing your data:
  - Uses the device platform authenticator via WebAuthn (`userVerification: required`)
  - Acts as a local UI gate over your active Firebase session — if the fingerprint fails or is cancelled, you can fall back to password (sign out → login)
  - The toggle only appears on devices that have a biometric sensor

### Notes
- Fully opt-in and backward-compatible: if you don't enable it, nothing changes
- Only works over HTTPS (production); test it on your phone after deploy
- The device decides which biometric method it presents (fingerprint on Android); the API can't force a specific one

---

## [1.17.0] — 2026-06-11

### Added
- **Offline support** — the app now works without a connection:
  - Firestore persistent cache (IndexedDB): your movements stay available offline and writes are queued until you reconnect
  - Service worker caches the app shell so FinMoves opens with no network (network-first when online, cache when offline)
- Redesigned **update banner**: glassmorphism card, blue glow, properly proportioned spinner (no longer overlaps the logo), gradient action button

### Changed
- App icon (`favicon.png`) regenerated from the source logo — sharper, square, text-free

### Notes
- Offline behavior only activates in production (requires HTTPS + a real build); the service worker takes effect after the first deploy that includes it

---

## [1.16.0] — 2026-06-11

### Added
- **Redesigned login** — modern minimalist look: icon + placeholder fields (no labels), taller inputs, blue/green background glows, glassmorphism card, show/hide password toggle, gradient sign-in button. Submits on Enter. Fully bilingual (ES/EN)
- **Human-readable auth errors** — Firebase error codes are mapped to clear messages ("Incorrect email or password", "Too many attempts…", "No connection…") instead of raw `Firebase: Error (auth/...)` strings; technical detail still logged to console
- **Session auto-logout** — the session now closes after 8 hours of inactivity (resets on any interaction), persisted across reloads and PWA restarts via localStorage
- **Error & 404 safety net** — added `error.tsx` (in-app error boundary with retry + visible technical detail), `global-error.tsx` (root-layout fallback), `not-found.tsx` (branded 404), and an **offline banner** that appears when the network drops
- Settings save errors now use the same human-readable mapping

### Notes
- True offline support (app opening without network via a service worker) is not included yet — the offline banner only signals the disconnection
- Passkey / biometric unlock is planned as a follow-up

---

## [1.15.2] — 2026-06-11

### Security
- **Formula/CSV injection hardening** — movement text fields starting with `= + - @` are now neutralized (prefixed with `'`) before being written to Google Sheets and to the CSV backup, so they can't execute as formulas
- **Versioned Firestore security rules** — `firestore.rules` is now tracked in the repo (per-user isolation: `request.auth.uid == userId`)
- **Server-only owner UID** — the daily cron now reads `OWNER_UID` instead of exposing it as a `NEXT_PUBLIC_` client variable
- **HTTP security headers** — added `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS across all routes

---

## [1.15.1] — 2026-06-11

### Changed
- Investments → "Periods to reach goal" card: trimmed the redundant "periods" word from the subtitle (now "at the pace of the last 3")

---

## [1.15.0] — 2026-06-11

### Added
- **Multilingual support (Spanish / English)** — the entire UI can now be switched between Spanish and English
  - New language selector in Settings → Account: tap the Argentine 🇦🇷 or British 🇬🇧 flag to switch instantly; the active flag is highlighted and the choice persists across sessions (localStorage)
  - Flags are rendered as crisp inline SVG icons (no emoji), so they display consistently on every OS including Windows
- New i18n architecture: `locales/es.ts` + `locales/en.ts` hold every UI string, surfaced through a lightweight `useT()` hook — no extra dependencies

### Changed
- Every screen (Dashboard, Movements, Investments, Reports, Settings) and the update banner now pull their labels, headings, buttons, placeholders and error messages from the active locale
- Movement type labels are translated for display (Gasto → Expense, Ingreso → Income, Move → Transfer, etc.) while the values stored in Firestore stay unchanged
- Report day-of-week names and CSV export headers follow the selected language

### Fixed
- Update banner now actually triggers: the version check runs immediately on mount (instead of waiting 60s) and re-runs whenever the app returns to the foreground — essential for the installed PWA
- `/api/version` now sends `no-store` cache headers so neither Vercel's edge nor the browser serve a stale version

### Notes
- User-created data (categories, payment methods, savings origins) and stored values are never translated — only the app's own UI text
- Number and date formatting remain in Argentine locale (`es-AR`) regardless of language

---

## [1.14.6] — 2026-06-10

### Added
- Update banner: when Vercel deploys a new version, a full-screen overlay appears with the app logo, spinner, and an "Actualizar" button — prompts the user to reload
- Version polling: `/api/version` endpoint checked every 60s; banner shows when build version differs from server version

### Changed
- Dashboard: last 5 movements shown (was 6); "+" button replaced with italic "ver más" link to /movements
- Movements: header shows "Resto" instead of "Disponible" for closed (past) periods
- Investments: projection and meta-period cards are now center-aligned; "p" suffix removed from periods count
- Auto-ahorro: generated movement now has observation "por gasto"
- LoadingSpinner: ring colors updated to blue/green gradient; container enlarged to 260×260

---

## [1.14.5] — 2026-06-10

### Added
- Auto-savings: "Descripciones a omitir" — add descriptions that skip the auto-savings rule (case-insensitive match); shown in the row subtitle when configured
- Auto-savings confirm button now only enables when there are actual changes vs. saved config

### Changed
- Settings: Sync card moved above Personalization card
- Settings > General tab renamed to "General" (pill)
- Reports > Gastos > Por día bars are now tappable — opens a bottom-sheet with all expenses for that day (swipe up to expand)
- Reports > Movimientos: Por categoría shows top 5 and opens full modal on tap; Por medio de pago removed
- Reports > Ingresos: Sueldo + Retiros cards now appear above Total ingresado card
- Page titles changed to English: Movements, Dollars/Euros, Reports, Settings
- App routes renamed: /movimientos → /movements, /inversion → /investments, /reportes → /reports, /config → /settings
- favicon updated

---

## [1.14.4] — 2026-06-10

### Changed
- Settings > App: CSV export button label changed to "Backup"; confirm button uses blue (consistent with GitHub modal)
- Settings > App card restructured: logo → versión + changelog → GitHub → Backup, all with icon + label
- Investment > Meta de ahorro: "Ahorrado" row removed; "Faltan" moved next to "Objetivo" header; progress bar color is red <40% / yellow <80% / green ≥80%; percentage shown inline with the bar
- Investment > Períodos para alcanzar meta: subtitle "al ritmo de los últimos 3 períodos" added
- Reports > Gastos: "Promedio / día" renamed to "Promedio / día con gasto"; subtitle corrected to show days with actual expenses (not calendar days)
- Reports > Gastos: "Días sin gastos" now visible when multiple periods are selected (aggregates across all selected periods)
- Reports > Ingresos: Proyección ahorros subtitle removed; period selector (3p/6p/12p) restored to pill style

---

## [1.14.3] — 2026-06-10

### Changed
- Settings > App: CSV export button moved from Account card to App card (next to changelog button); click shows confirmation modal before downloading
- Settings > App: GitHub icon now shows "GitHub" label below; click shows confirmation modal before opening the link in a new tab

---

## [1.14.2] — 2026-06-10

### Fixed
- Settings: category, payment method and savings origin toggles debounced (1.5s) — multiple rapid taps produce a single Firestore write; eliminates app-wide lag while toggling
- Settings > General: auto-savings configuration moved to a bottom-sheet modal — activating the toggle opens it; editing taps the row when active; removes layout shift from inline expand
- Settings > General: auto-savings subtitle shows amount and payment methods (e.g. `$500 por gasto · Mercado Pago + Débito`)

---

## [1.14.1] — 2026-06-10

### Changed
- Settings > General: Modo oscuro moved to top of card
- Settings > General: Reportes now listed above Inversión
- Settings > General: Auto-savings icon uses green (active) / red (inactive), consistent with Inversión and Reportes

---

## [1.14.0] — 2026-06-10

### Added
- Settings > General: **Auto-savings** toggle — when enabled, every qualifying Gasto automatically creates an `Ingreso / Ahorros` movement for a fixed amount configured by the user (respects main currency)
- Settings > General: payment method filter for auto-savings — select one, several, or all methods that trigger the rule (defaults to all active methods on first enable)
- Settings > Sync: clock icon opens a **sync history modal** — each entry shows status color (green/red), date and time, message, and badge (Manual/Auto)
- Movements: when auto-savings applies to the current payment method, the add-movement form shows a preview label with the amount going to savings

---

## [1.13.1] — 2026-06-10

### Changed
- Movements: observation shown in the subtitle of each movement row — lowercase and italic

---

## [1.13.0] — 2026-06-10

### Added
- Movements: list grouped by date with a day header between groups (standard finance app pattern)

### Changed
- Movements: date removed from each movement row subtitle (already shown in the group header)
- Movements: sorted by `fecha` desc → `timestampCarga` desc within the same day
- Movements / Reports: all pill rows use `touchAction: pan-x` for reliable horizontal scroll on mobile
- Reports: period and year pills unified to the same size (`10px`, `700`, `4px 12px`)
- Movements: period pills unified to match year pill size

### Fixed
- Reports: multi-select ring (`box-shadow 0 0 0 2px`) no longer clipped — padding added to period and year pill containers

---

## [1.12.3] — 2026-06-09

### Fixed
- Config > App: GitHub link now points directly to README.md instead of the repo root

---

## [1.12.2] — 2026-06-09

### Fixed
- Dashboard: KPI cards reordered — Sueldo | Gastado / Ahorros | Retiros (was Gastado | Ahorros / Sueldo | Retiros)

---

## [1.12.1] — 2026-06-09

### Fixed
- Inversión: **Meta de ahorro** card now appears above **Meta por período** (was reversed)
- Inversión: **Meta de ahorro** card now includes a progress bar (yellow → green when goal reached)
- Reports URL renamed `/resumen` → `/reportes`; folder and navbar link updated
- LoadingSpinner: removed double `borderRadius` on favicon image (PNG already has built-in rounded corners)

---

## [1.12.0] — 2026-06-09

### Added
- Reports > **Movimientos** (new section, replaces Tendencias): KPI cards per movement type (Gasto / Ingreso / Move / CompraUSD) in a 4-column grid with matching color gradients; Top 5 descriptions by frequency with tap-to-expand modal (50dvh → 90dvh swipe); movements by category with frequency bars; movements by day of week (vertical bar chart Mon–Sun); movements by payment method — all bar colors follow the dominant movement type (red = expense, green = income, yellow = transfer/investment)
- Reports > Períodos: **Mejor/Peor período** KPI cards (best and worst % spent vs income) in the 2fr 1fr 1fr grid alongside Prom. período; **Prom. período** stat added below the "Gastado por período" chart; **Proyección próx. período** replaces "Ahorros acum." in the KPI grid; **Evolución ingresos** chart moved here from Ingresos
- Reports > Ingresos: **Proyección ahorros** (60%) card alongside Ahorros acum. (40%) in 1fr 1fr grid, with 3p/6p/12p toggle; **Total ingresado** card repositioned directly below the hero card
- Inversión page: **Proyección · 3 períodos** and **Períodos para alcanzar meta** added as a 50%/50% grid card (Proyección first)

### Changed
- Reports tab **"Tendencias" renamed to "Movimientos"**, repositioned before "Períodos" — new tab order: Gastos | Ingresos | Movimientos | Períodos
- Reports > Ingresos: **Evolución sueldo** replaces the "Sueldo" KPI card (renamed "Sueldo") — shows current salary, % raise vs previous level, and previous salary; tap opens raise history modal
- Reports > Ingresos: "Directo a ahorros" list sorted by date descending (was by amount); "Por descripción" excludes Sueldo entries
- Reports > Gastos: Tendencia KPI moved from Tendencias into the Gastos KPI grid (order: Días sin gastos | Tendencia); "Mayor gasto" renamed "Día con mayor gasto"; Observaciones (word cloud) removed
- Reports > Gastos/Ingresos modals: max 50dvh, swipe-up handle expands to 90dvh
- **Inversión page URL renamed `/dolares` → `/inversion`** — folder, route, and navbar link updated; "Ritmo / período" card removed from Inversión
- Investment trend cards (Progreso meta USD, Períodos para meta, Ahorros USD, Ritmo/período, Proyección USD) moved out of Tendencias into the Inversión page
- Config > Reportes: section labels updated to reflect new tab names (Movimientos replaces Tendencias with new toggle keys `movimientos_kpis` / `movimientos_otros`)

---

## [1.11.0] — 2026-06-09

### Added
- Salary raise history modal in Reports > Trends: tap "Salary evolution" card to see each raise (date, from → to, %)

### Changed
- Dashboard: "Extras" renamed to "Retiros" (yellow, subtitle "desde ahorros"); available % now calculated over total income (salary + extras); last movement shows time only (no date); period label shows date without year
- Movements: Move amounts shown in yellow in the list
- Investment: "Goal per period" value in yellow
- Reports > Periods: "Extras" renamed to "Retiros" with yellow color and "desde ahorros" subtitle
- Reports > Trends: Salary evolution compares against the previous salary level (before last raise), not the historical average

---

## [1.10.4] — 2026-06-09

### Fixed
- Reports > Trends: savings in USD now reads from real CompraUSD/GastoUSD movements instead of ARS savings series — fixes 0% progress and wrong values

---

## [1.10.3] — 2026-06-08

### Changed
- Word cloud in Reports: limited to top 25 words

---

## [1.10.2] — 2026-06-08

### Fixed
- Reports: restored spacing between section tabs and period pills

---

## [1.10.1] — 2026-06-08

### Fixed
- Reports and Dollars: header and content hidden during load, only spinner visible

---

## [1.10.0] — 2026-06-08

### Added
- Word cloud in Reports > Expenses: words from movement observations sized by frequency, blue→green gradient

### Changed
- Exchange rate in new +USD movement: official selected by default
- Toggle: white knob with shadow, glow on active, spring animation
- USD/EUR exchange rate in Dollars: softer contrast between official and blue

---

## [1.9.1] — 2026-06-08

### Changed
- Edit button (pencil) in movement list: no background box
- Hide values button (eye) in Dashboard: no background box

---

## [1.9.0] — 2026-06-08

### Changed
- Toggle redesigned: white knob with shadow, glow on active, spring animation
- USD/EUR exchange rate: softer contrast between official/blue (same background, differentiated by border and color)
- Exchange rate order in new +USD movement: official first, blue second
- "Goal per period" progress bar: yellow color

---

## [1.8.0] — 2026-06-08

### Added
- Disabling all Reports pills automatically hides the section (navbar + config)
- Re-enabling Reports from General settings resets all pills to enabled
- Redirects to Account tab if user was in Reports when disabling all pills

### Changed
- Save button in Savings Goal: circular checkmark (same as new movement), trash icon on the right
- Save button in Edit movement: circular checkmark instead of floppy disk
- "Goal per period" progress bar: yellow color (consistent with Investment section)
- Dashboard and Movements: header and content hidden during load, only spinner visible

---

## [1.7.0] — 2026-06-08

### Fixed
- Savings movement bug: description showed "Ahorros" instead of origin name (e.g. "Osansi")
- Edit modal for Savings movements: description appeared empty
- New movement form date used UTC instead of local time, causing day rollover at 21:00
- All timestamps across the app converted to 24h format (no AM/PM)

### Changed
- "Last movement" timestamp moved to Dashboard, below "Latest movements"
- Background gradients applied to: Dashboard KPI cards, Latest movements, movements list card, Available card (dynamic color by percentage)

---

## [1.6.0] — 2026-06-08

### Added
- Two-step logout confirmation
- Delete savings goal button (red trash) in Config > Investment
- Dirty state in movement editing: save only enabled when there are changes

### Changed
- Config sections reordered: General → Sync → Account → App
- General section reordered: Main currency → Investment → Investment currency → Reports → Dark mode
- "General preferences" renamed to "General"; "Investment currencies" to "Investment currency"
- + buttons in Config: green symbol only, no background
- ✕ buttons in Config: red X only, no background
- Confirm button in new movement: centered checkmark, green when required fields are filled
- Save/delete buttons in movement editing: minimalist icons (green floppy, red trash)
- Trash on the right, floppy centered in movement editing
- Modal close button: red X only, no background
- Numbers in "All descriptions" modal: blue→green gradient
- LoadingSpinner: colored ring orbits around logo, centered on screen
- GitHub link updated to finmoves-app

---

## [1.5.0] — 2026-06-07

### Added
- Changelog modal in Config > App — without leaving the app
- GitHub logo (left of FinMoves logo) with link to repository

### Changed
- The "changelog" link opens an inline modal instead of redirecting to GitHub

---

## [1.4.0] — 2026-06-07

### Added
- Export movements to CSV from Config > Account (same format as Google Sheets)
- GitHub logo with link to CHANGELOG in the App card of Settings

### Changed
- Config > General preferences reordered: Dark mode → Main currency → Investment → Investment currency → Reports
- Main currency moved from Account card to General preferences
- Available bar and badge in Dashboard change color dynamically (green ≥50%, yellow <50%, red <10%)

---

## [1.3.0] — 2026-06-07

### Added
- Main currency per account: ARS / USD / EUR (stored in Firestore, default ARS)
- `formatMoney(n, currency)` — correct symbol based on currency (`$`, `U$D`, `€`)
- Entire app adapts currency symbol automatically without additional changes
- Config > Account shows badge with selected main currency
- Investment: if main currency is USD, can only invest in EUR (and vice versa)
- Movements: +/- FX automatically excludes the main currency

### Changed
- `investmentCurrency` only visible for users with ARS as main currency
- For USD/EUR primary, investment currency is fixed and requires no selector

---

## [1.2.0] — 2026-06-07

### Added
- Dual USD/EUR support in Investment: new types `CompraEUR` / `GastoEUR`
- Two independent hero cards (USD Reserve + EUR Reserve) with separate exchange rates
- USD and EUR exchange rates with independent selector (can have official on one and blue on the other)
- Dynamic title "Dollars | Euros" when data for both currencies is visible
- Delete categories, payment methods and savings origins with inline confirmation
- Expense/Income pills instead of native select when adding categories
- Input fields moved to top of each list (Categories, Methods, Origins)
- Inline "Save" button in Investment tab of Config, visible only with pending changes

### Changed
- Reports and Movements toggles save instantly (auto-save, no floating button)
- Save FAB removed — replaced by auto-save + inline button in Investment
- Bug fix: Reports toggle state was lost when navigating between pages
- Bug fix: "Total income" in Reports/Income now hides correctly with KPIs
- Bug fix: Current reserve and goal amount in Config show the correct currency (USD or EUR)
- New movement FAB repositioned closer to navbar
- Dashboard "see more" button with same SVG style as Movements FAB (in blue)
- Save confirmation message removed (only appears on error)

---

## [1.1.0] — 2026-06-07

### Added
- Icons in each row of General preferences: User, Sync, Reports, Investment and Currency
- Reports and Investment icon with green border (active) or red (inactive)
- Currency icon shows `$` or `€` based on selected currency
- Sync icon reflects status: green if synced, red if error, grey if never synced
- Navbar: active icons with blue→green gradient based on position (home = blue, gear = green)
- Navbar: background adapts to theme — light in light mode, dark in dark mode

### Changed
- "Inversiones" renamed to "Investment" throughout the app (navbar, config, reports, dollars section)
- Dollars section title changes dynamically: "Dollars" or "Euros" based on configured currency
- All cards in the Investment page with yellow gradient (Exchange rate, Goal per period, Savings goal, History)
- Selected exchange rate highlighted with yellow gradient and yellow text
- Exchange rate order: Official first, Blue second
- Accent color changed from cyan (`#00b4ff`) to blue (`#3f52e8`) — better contrast in light mode
- Settings pills in outlined style (border + dim), consistent with the rest of the app

---

## [1.0.0] — 2026-06-06

### Added
- Firebase authentication (email/password)
- Dashboard with active period summary: available, expense bar and latest movements
- Movement tracking: Expense, Income, Move, BuyUSD, SpendUSD
- Investment section: USD/EUR reserve, blue/official exchange rate, savings goal, purchase history
- Reports section with toggles per section: expense, income, period and trend KPIs
- Settings: categories, payment methods, savings origins, general preferences
- Light mode by default with dark mode toggle (no flash on load)
- Google Sheets sync (full mirror + rotation of up to 5 backups)
- Preferences persisted in localStorage via Zustand: mode, Reports section, Investment section, currency
- PWA: installable from the browser
- Version visible in the App section of Settings, auto-generated from `package.json`
