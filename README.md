# FinMoves

Gestor de finanzas personales para Argentina. Registrá movimientos, seguí tu inversión en dólares y analizá tus tendencias por período.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Firebase** — Auth (email/password) + Firestore (base de datos en tiempo real)
- **Zustand** — estado global persistido en localStorage
- **Tailwind v4** — estilos con CSS variables propias
- **Google Sheets** — espejo opcional de los movimientos
- **Vercel** — deploy automático desde `main`

## Secciones

### Inicio — Dashboard
Resumen del período activo: disponible vs sueldo, barra de progreso de gasto, últimos movimientos y ahorros acumulados totales.

### Movimientos
CRUD completo de movimientos. Tipos soportados:

| Tipo | Descripción |
|------|-------------|
| `Gasto` | Egreso en pesos |
| `Ingreso` | Entrada de dinero (sueldo u otros) |
| `Move` | Transferencia interna entre cuentas |
| `CompraUSD` | Compra de divisas (registra cantidad USD + cotización) |
| `GastoUSD` | Gasto en moneda extranjera |

Cada movimiento tiene: fecha, categoría, descripción, monto, medio de pago, observaciones y período al que pertenece.

### Inversión
Seguimiento de reserva en USD o EUR:
- Reserva total y precio promedio de compra
- Ganancia/pérdida en ARS sobre la inversión
- Cotización blue y oficial en tiempo real (con fallback a cache)
- Meta de ahorro con fecha objetivo y progreso
- Meta mensual por período
- Historial de compras

### Reportes
Análisis por período con toggles configurables por sección:
- **Gastos**: KPIs (total, promedio, ritmo diario), por categoría, por descripción, por medio de pago, por fecha, comparativa entre períodos
- **Ingresos**: total ingresado, por categoría, detalle de orígenes
- **Períodos**: serie histórica, KPIs comparativos
- **Tendencias**: proyección de gastos, evolución del sueldo, proyección de ahorros en USD, progreso de meta

### Configuraciones
- Categorías, medios de pago y orígenes de ahorro (CRUD)
- Preferencias: modo oscuro/claro, habilitar sección Reportes, habilitar sección Inversión
- Moneda de inversiones: USD o EUR
- Sincronización manual con Google Sheets

## Períodos

Los movimientos se agrupan en períodos con fecha de inicio/fin y sueldo declarado. El período activo es la unidad de análisis principal. Los KPIs de Reportes comparan períodos entre sí.

## Sincronización con Google Sheets

La app es la fuente de verdad. Al sincronizar, sobreescribe la hoja `Movimientos` del spreadsheet configurado, manteniendo hasta 5 backups automáticos como pestañas nombradas por fecha (hora Argentina).

## Tema

Light mode por defecto, con toggle a dark. Las variables de color se aplican sin flash via script inline en `<head>`. Sin dependencia de librerías de tema.

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | Configuración pública de Firebase |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account de Firebase Admin (para API routes) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account de Google Sheets |
| `GOOGLE_SPREADSHEET_ID` | ID del spreadsheet destino |
| `NEXT_PUBLIC_APP_VERSION` | Auto-generada desde `package.json` vía `next.config.ts` |

## Deploy

```bash
# Desarrollo local
npm run dev

# Release a producción
git checkout dev
# ... cambios ...
git commit && git push origin dev
git checkout main
git merge --no-ff dev -m "Merge dev → main: vX.X.X"
git tag vX.X.X
git push origin main --tags && git push origin dev
```

Vercel deploya automáticamente desde `main`. El rollback se hace desde el dashboard de Vercel o con `git reset --hard vX.X.X` + force push.

## Versión actual

`v1.1.0` — ver [CHANGELOG.md](./CHANGELOG.md) para el historial completo.
