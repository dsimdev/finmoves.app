# Changelog

All notable changes to FinMoves are documented here.

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
