# Changelog

Todos los cambios notables de FinMoves se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [1.2.0] — 2026-06-07

### Added
- Soporte dual USD/EUR en Inversión: nuevos tipos `CompraEUR` / `GastoEUR`
- Dos hero cards independientes (Reserva USD + Reserva EUR) con sus cotizaciones separadas
- Cotización USD y EUR con selector independiente (podés tener oficial en uno y blue en el otro)
- Título dinámico "Dólares | Euros" cuando hay datos de ambas monedas visibles
- Eliminación de categorías, medios de pago y orígenes de ahorro con confirmación inline
- Pills Gasto/Ingreso en lugar del select nativo al agregar categorías
- Inputs de carga movidos al tope de cada lista (Categorías, Medios, Orígenes)
- Botón "Guardar" inline en la tab Inversión de Config, visible solo con cambios pendientes

### Changed
- Toggles de Reportes y Movimientos guardan al instante (auto-save, sin botón flotante)
- FAB de guardar eliminado — reemplazado por auto-save + botón inline en Inversión
- Bug fix: estado de toggles de Reportes se perdía al navegar entre páginas
- Bug fix: "Total ingresado" en Reportes/Ingresos ahora se oculta correctamente con KPIs
- Bug fix: Reserva actual y monto objetivo en Config muestran la moneda correcta (USD o EUR)
- FAB de nuevo movimiento reposicionado más cerca del navbar
- Botón "ver más" del Dashboard con mismo estilo SVG que el FAB de Movimientos (en azul)
- Mensaje de confirmación de guardado eliminado (solo aparece en caso de error)

---

## [1.1.0] — 2026-06-07

### Added
- Íconos en cada fila de Preferencias generales: Usuario, Sincronización, Reportes, Inversión y Moneda
- Ícono de Reportes e Inversión con borde verde (activo) o rojo (inactivo)
- Ícono de Moneda muestra `$` o `€` según la divisa seleccionada
- Ícono de Sincronización refleja el estado: verde si synced, rojo si error, gris si nunca sincronizado
- Navbar: iconos activos con gradiente azul→verde según posición (casita = azul, tuerca = verde)
- Navbar: fondo adapta al tema — claro en light mode, oscuro en dark mode

### Changed
- "Inversiones" renombrado a "Inversión" en toda la app (navbar, config, reportes, sección dólares)
- Título de la sección dólares cambia dinámicamente: "Dólares" o "Euros" según moneda configurada
- Todas las cards de la página Inversión con gradiente amarillo (Cotización, Meta por período, Meta de ahorro, Historial)
- Cotización seleccionada resaltada con gradiente amarillo y texto amarillo
- Orden de cotización: Oficial primero, Blue segundo
- Color accent cambiado de cyan (`#00b4ff`) a azul (`#3f52e8`) — más contraste en light mode
- Pills de Configuraciones en estilo outlined (borde + dim), consistente con el resto de la app

---

## [1.0.0] — 2026-06-06

### Added
- Autenticación con Firebase (email/password)
- Dashboard con resumen del período activo: disponible, barra de gasto y últimos movimientos
- Registro de movimientos: Gasto, Ingreso, Move, CompraUSD, GastoUSD
- Sección Inversión: reserva USD/EUR, cotización blue/oficial, meta de ahorro, historial de compras
- Sección Reportes con toggles por sección: KPIs de gastos, ingresos, períodos y tendencias
- Configuraciones: categorías, medios de pago, orígenes de ahorro, preferencias generales
- Light mode por defecto con toggle a dark mode (sin flash en carga)
- Sincronización con Google Sheets (espejo completo + rotación de hasta 5 backups)
- Preferencias persistidas en localStorage vía Zustand: modo, sección Reportes, sección Inversión, moneda
- PWA: instalable desde el navegador
- Versión visible en la sección App de Configuraciones, auto-generada desde `package.json`
