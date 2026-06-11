# Changelog

All notable changes to FinMoves are documented here.

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
