# Changelog

Todos los cambios notables de FinMoves se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [1.10.0] — 2026-06-08

### Added
- Nube de palabras en Reportes > Gastos: palabras de observaciones con tamaño proporcional a frecuencia y gradient azul→verde

### Changed
- Cotización en nuevo movimiento +USD: oficial seleccionado por defecto
- Toggle: knob blanco con sombra, glow en activo, animación spring
- Cotización USD/EUR en dólares: contraste suave entre oficial y blue

---

## [1.9.1] — 2026-06-08

### Changed
- Botón editar (lápiz) en lista de movimientos: sin recuadro
- Botón ocultar valores (ojo) en Dashboard: sin recuadro

---

## [1.9.0] — 2026-06-08

### Changed
- Toggle redesñado: knob blanco con sombra, glow en activo, animación spring
- Cotización USD/EUR: contraste entre oficial/blue más suave (mismo fondo, diferencia por borde y color)
- Orden cotización en nuevo movimiento +USD: oficial primero, blue después
- Barra "Meta por período": color amarillo

---

## [1.8.0] — 2026-06-08

### Added
- Desactivar todas las pills de Reportes oculta la sección automáticamente (navbar + config)
- Reactivar Reportes desde Generales resetea todas las pills a habilitadas
- Redirige al tab Cuenta si el usuario estaba en Reportes al desactivarlo todo

### Changed
- Botón guardar en Meta de Ahorro: tilde circular (igual que nuevo movimiento), tacho a la derecha
- Botón guardar en Editar movimiento: tilde circular en vez de diskette
- Barra de progreso "Meta por período": color amarillo (consistente con sección Inversión)
- Dashboard y Movimientos: header y contenido ocultos durante carga, solo spinner visible

---

## [1.7.0] — 2026-06-08

### Fixed
- Bug en carga de Ahorros: descripción mostraba "Ahorros" en vez del origen (ej. "Osansi")
- Bug en edición de movimiento Ahorros: descripción aparecía vacía en el modal de edición
- Fecha del formulario de nuevo movimiento usaba UTC en vez de hora local, causando salto de día a partir de las 21hs
- Timestamps en toda la app convertidos a formato 24hs (sin AM/PM)

### Changed
- Timestamp "Último movimiento" movido al Dashboard, debajo de "Últimos movimientos"
- Gradients de fondo aplicados a: cards KPI del Dashboard, Últimos movimientos, card de movimientos, card Disponible (color dinámico según porcentaje)

---

## [1.6.0] — 2026-06-08

### Added
- Confirmación de cierre de sesión (dos pasos)
- Botón eliminar meta de ahorro (tacho rojo) en Config > Inversión
- Dirty state en edición de movimientos: diskette solo se habilita con cambios

### Changed
- Config > Cuenta reordenado: Generales → Sincronización → Cuenta → App
- Generales reordenado: Moneda principal → Inversión → Moneda de inversión → Reportes → Modo oscuro
- "Preferencias generales" renombrado a "Generales"; "Moneda de inversiones" a "Moneda de inversión"
- Botones + en Config: solo símbolo verde sin fondo
- Botones ✕ en Config: solo X roja sin fondo
- Botón Confirmar en nuevo movimiento: tilde centrado, verde cuando los campos están completos
- Botones guardar/eliminar en edición de movimiento: íconos minimalistas (diskette verde, tacho rojo)
- Tacho a la derecha, diskette centrado en edición de movimiento
- X de cierre en modales: solo X roja sin fondo
- Números en modal "Todas las descripciones": gradient azul→verde
- LoadingSpinner: ring de colores orbita alrededor del logo, centrado en pantalla
- Link GitHub actualizado a finmoves-app

---

## [1.5.0] — 2026-06-07

### Added
- Modal de changelog en Config > App — sin salir de la app
- Logo GitHub (izquierda del logo FinMoves) con link al repositorio

### Changed
- El link "changelog" abre modal inline en lugar de redirigir a GitHub

---

## [1.4.0] — 2026-06-07

### Added
- Exportar movimientos a CSV desde Config > Cuenta (mismo formato que Google Sheets)
- Logo GitHub con link al CHANGELOG en la card App de Configuraciones

### Changed
- Config > Preferencias generales reordenado: Modo oscuro → Moneda principal → Inversión → Moneda de inversiones → Reportes
- Moneda principal movida de la card Cuenta a Preferencias generales
- Barra y badge de disponible en Dashboard cambian de color dinámicamente (verde ≥50%, amarillo <50%, rojo <10%)

---

## [1.3.0] — 2026-06-07

### Added
- Moneda principal por cuenta: ARS / USD / EUR (almacenada en Firestore, default ARS)
- `formatMoney(n, moneda)` — símbolo correcto según moneda (`$`, `U$D`, `€`)
- Toda la app adapta automáticamente el símbolo de moneda sin cambios adicionales
- Config > Cuenta muestra badge con la moneda principal seleccionada
- Inversión: si moneda principal es USD solo puede invertir en EUR (y viceversa)
- Movimientos: +/- FX excluye la moneda principal automáticamente

### Changed
- `monedaInversiones` solo visible para usuarios con moneda principal ARS
- Para USD/EUR primary, la moneda de inversión es fija y no requiere selector

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
