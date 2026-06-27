# Novedades de FinMoves

Lo nuevo y lo que mejoró, versión por versión.

---

## [2.34.0] — 2026-06-26

### Configuración
- En **Ajustes > General** hay una nueva opción "Dashboard clásico" para volver a los KPIs anteriores (sueldo, gastado, ahorros, retiros).

---

## [2.33.0] — 2026-06-25

### Inicio
- Los **4 indicadores del dashboard** son nuevos: Gastado · Ahorros acumulados · Promedio por movimiento · Desvío. Tocando cualquiera aparece una explicación breve.

---

## [2.32.2] — 2026-06-24

### Reportes
- En **Por medio de pago** ya no aparece la fila "—": los movimientos sin medio asignado se suman a Mercado Pago.

---

## [2.32.1] — 2026-06-24

### Reportes
- Con el **presupuesto** tildado, ahora cada categoría muestra cuánto te **pasaste** (en rojo) o cuánto te **falta** para llegar (en verde), tanto en plata como en porcentaje, en vez del gasto absoluto.

---

## [2.32.0] — 2026-06-24

### Novedades
- **Globo en el ícono de la app**: cuando te llega una notificación, ahora aparece un contador en el ícono de FinMoves (como en otras apps). Se borra recién cuando entrás a la app, no si descartás la notificación. Necesitás tener la app instalada en la pantalla de inicio y las notificaciones activadas.
- **Aviso de versión nueva**: cuando sale una actualización importante, te llega una notificación. Al entrar, el cartel de "Actualizar" hace el resto.

---

## [2.31.0] — 2026-06-23

### Reportes
- **Gráfico de torta interactivo** en la tarjeta de Movimientos: tocás un segmento y te muestra el porcentaje de ese tipo de movimiento en el centro. Tocás de nuevo para deseleccionar.
- **Días por período** — nuevo gráfico en la sección Períodos. Verde si el período duró hasta 29 días, amarillo 30–31, rojo 32 o más.
- La **tendencia** en Movimientos ahora compara la cantidad de movimientos (no el monto gastado). El detalle muestra cuántos movimientos tuvo este período y cuál es el promedio histórico.
- Los **medios de pago**: los gastos sin medio de pago asignado ahora aparecen bajo "Mercado Pago" en el gráfico.

### Inicio
- El período activo ahora muestra **cuántos días lleva** en curso en vez de la fecha de inicio.

---

## [2.30.0] — 2026-06-23

### Mejoras en Reportes
- La sección **Movimientos** ahora muestra el **día pico de gasto** del período en vez del promedio por movimiento.
- La sección **Gastos** ahora muestra el total **movido a ahorros** del período (en violeta).
- La **tendencia** compara el período actual contra el promedio histórico de todos los períodos anteriores, en lugar de los últimos 3 vs. los 3 previos — más representativo cuando tenés muchos meses cargados.
- Nuevo esquema de colores en Reportes: **Movimientos** usa un gradiente teal→violeta, **Períodos** usa rojo→verde. Cada sección tiene su propio tono de fondo en la tarjeta principal.

---

## [2.29.2] — 2026-06-23

### Correcciones
- El badge del día en movimientos ahora muestra los Auto-ahorro en violeta (en vez de amarillo).

---

## [2.29.0] — 2026-06-22

### Mejoras
- El aviso para **instalar la app** ahora aparece como un banner flotante en la parte baja de la pantalla, igual que el de actualización. Queda hasta que la instalés.
- El **código de invitación** se muestra en una tarjeta centrada con botón para copiar.
- El botón de **eliminar cuenta** baja al final de configuración. En vez de borrar inmediatamente, envía una solicitud al admin para que confirme la eliminación de tus datos.

---

## [2.28.1] — 2026-06-22

### Visual
- Los movimientos de **Move a ahorros** ahora aparecen en violeta en toda la app (lista, modal, reportes, inicio).

---

## [2.28.0] — 2026-06-22

### Reportes — Movimientos

- **Hoy**: nuevo KPI que muestra cuánto gastaste hoy (solo período activo).
- **Por categoría**: ahora muestra el total en pesos además de la cantidad de movimientos.
- **Por medio de pago**: se movió al tab Movimientos y ahora desglosa la cantidad por tipo (gasto, ingreso, move, etc.) con colores.
- Se eliminaron "Top 5 descripciones" y el gráfico por día de semana.

### Reportes — Gastos

- Se eliminaron "Categoría que más creció" y "Por medio de pago" (ahora en Movimientos).

---

## [2.27.0] — 2026-06-22

### Presupuestos por período

- **Presupuesto por categoría**: en Reportes → Por categoría, el nuevo ícono de lápiz abre un panel para definir cuánto querés gastar en cada categoría durante el período activo. Se guarda por período; podés tener distintos presupuestos cada mes.
- **Template por defecto**: en Ajustes → Presupuestos podés definir valores base que se pre-cargan al abrir el editor de cada período nuevo.
- **Vista de presupuesto activable**: el botón "Presupuesto" aparece en el encabezado de "Por categoría" cuando hay un presupuesto guardado. Al activarlo, las barras cambian de color (verde / amarillo / rojo según cuánto gastaste) y muestran el monto límite al costado. Por defecto está apagado.
- **Detalle por categoría**: tocando cualquier categoría se abre un panel con todos los gastos de esa categoría en el período, ordenados por fecha.

### Movimientos

- Los contadores de día ahora diferencian "Mover a disponible" (teal) de "Mover a ahorros" (naranja).

---

## [2.26.0] — 2026-06-19

### Configuración inicial

- **Onboarding más rápido**: el proceso de bienvenida pasó de 11 pantallas a 3. Ingresás tu nombre (opcional), elegís la moneda del día a día y si gestionás reservas en divisas, y configurás biometría y notificaciones. Listo.
- **Reportes activos por defecto**: al completar el onboarding, la sección Reportes queda habilitada automáticamente.
- **Tips en la primera visita**: la primera vez que abrís Movimientos, Reportes o Inversión aparece una tarjeta con una breve descripción de la sección. Se cierra con ×.

---

## [2.25.9] — 2026-06-19

### Nuevo en Configuración

- **Backup JSON**: el botón de Backup ahora descarga un archivo `.json` con todos tus movimientos y tu configuración (categorías, medios de pago, orígenes de ahorro). Más completo y fácil de procesar que el CSV anterior.
- **Eliminar cuenta**: podés borrar tu cuenta y todos tus datos desde Configuración → Datos. Se te pide la contraseña para confirmar. La acción es irreversible.
- **Historial de accesos**: si el administrador activó o desactivó un permiso en tu cuenta, ahora lo ves en Configuración → Datos, con la fecha y el motivo.

---

## [2.25.6] — 2026-06-18

### Mejoras
- **Reportes / Movimientos**: los moves a ahorros (naranja) y a disponible (teal) ahora aparecen separados en la barra, la leyenda y las listas de categoría y descripción.
- **Carga de Move**: el chip "Move" tiene borde degradado teal→naranja. Los botones "A Disponible" y "A Ahorros" muestran cada uno su color propio, y el recuadro de info se adapta.

---

## [2.25.5] — 2026-06-18

### Mejoras
- **Moves diferenciados**: los moves a ahorros (naranja) y los moves a disponible (teal) ahora tienen colores distintos y se cuentan por separado. Ya no se mezclan ni se netan entre sí.
- **KPI "Move disponible"**: antes se llamaba "Retiros" y podía verse afectado por el auto-ahorro. Ahora muestra solo los retiros manuales de ahorros hacia disponible.
- **Ahorros acumulados**: el cálculo ahora incluye los moves a ahorros correctamente, mejorando la proyección y el ritmo de ahorro.

---

## [2.25.4] — 2026-06-18

### Nuevo
- **Instalar en iPhone**: la app te guía con dos pasos claros para agregarla a la pantalla de inicio desde Safari.

---

## [2.25.3] — 2026-06-18

### Mejoras
- **Splash en iOS**: al abrir la app instalada en iPhone ahora aparece una pantalla de carga con el logo de FinMoves en lugar de una pantalla en blanco.

---

## [2.25.2] — 2026-06-18

### Corrección
- **Auto-ahorro**: corregido un error donde el monto de auto-ahorro no se descontaba del disponible. A partir de ahora funciona como un Move a ahorros: el disponible baja y los ahorros suben correctamente. Los registros anteriores también fueron corregidos.

---

## [2.25.0] — 2026-06-17

### Nuevo
- **Tendencia de cantidad de movimientos**: los Reportes ahora muestran si hiciste más o menos transacciones que los 3 meses anteriores (en verde si menos, en rojo si más).

### Mejoras
- **KPIs de movimientos reordenados**: layout 2x2 más claro — día/mayor arriba, tendencia/promedio abajo.
- **Gastos sin "Días libres"**: sacamos ese KPI para simplificar.

---

## [2.24.1] — 2026-06-17

### Mejoras
- **Selector de moneda mejorado**: la moneda actual ahora se ve con un icono $ en verde. El botón de la moneda seleccionada se resalta en verde y no se puede hacer clic en él. Orden de secciones en Cuenta reorganizado para mejor flujo.

---

## [2.24.0] — 2026-06-17

### Nuevo
- **Historial de cambios de permisos**: el administrador ahora ve cuándo y por qué (Fix / Bug / Error) se activó o desactivó cada permiso en tu cuenta. Notificaciones de cambios incluyen la fecha y hora.

### Mejoras
- **Estado de conexión más claro**: la fila "Última conexión" ahora muestra si estás conectado (punto verde) o cuándo fue tu última sesión.

---

## [2.23.3] — 2026-06-16

### Arreglos
- **Historial de movimientos**: los gastos de la reserva (GastoUSD/GastoEUR) ya no aparecen en el listado — solo afectan tu inversión, no tus movimientos de pesos.

---

## [2.23.2] — 2026-06-16

### Arreglos
- **Ganancia de la reserva**: el precio promedio y la ganancia ahora se calculan bien al vender o gastar (antes la ganancia quedaba mucho más negativa de lo real).
- **Botón "atrás"**: estando con la sesión iniciada, "atrás" ya no te lleva a la página de bienvenida.

### Mejoras
- La proyección de inversión ahora aclara que es a 3 períodos.

---

## [2.23.0] — 2026-06-15

### Nuevo
- **Tema claro/oscuro desde el inicio**: botón de sol/luna en la página de bienvenida para cambiar el tema de toda la app.

---

## [2.22.0] — 2026-06-15

### Nuevo
- **Inicio renovado**: las funciones ahora se ven en un carrusel con capturas reales que se desliza solo (y con swipe en el celu).
- **Idioma en la bienvenida**: podés ver la página de inicio en español o inglés con el botón de arriba.

### Arreglos
- **Botón "atrás"**: estando con la sesión iniciada, "atrás" ya no te devuelve a la pantalla de inicio de sesión.
- Al entrar a finmoves.app ahora ves la página de bienvenida (antes iba directo al login).

---

## [2.20.0] — 2026-06-15

### Nuevo
- **Página de inicio**: nueva landing con capturas reales de la app, efectos de hover en las cards y botón para instalar la app directamente desde la página de bienvenida.

### Mejoras
- **Plantillas**: se ordenan de mayor a menor uso — la que más usás aparece primero.

### Arreglos
- **Inversión**: cuando alcanzás tu meta de ahorro aparece el badge "ALCANZADA" en la tarjeta.

---

## [2.19.0] — 2026-06-15

### Nuevo
- **Perfil**: el modal de edición pasó a ser una card deslizable desde abajo, con foto y nombre al tope, y las banderas de idioma al lado del botón de cambiar contraseña.

### Arreglos
- Se corrigió el popup de Google que en algunos casos no cerraba correctamente (error COOP).
- El nombre y foto de Google ahora se sincronizan correctamente al vincular la cuenta.

---

## [2.18.4] — 2026-06-15

### Mejoras
- El correo de contacto ahora es **info@finmoves.app**.

---

## [2.18.3] — 2026-06-15

### Arreglos
- Se corrigió un problema que impedía **entrar con Google** (y a veces el ingreso normal) y cargaba mal las tipografías.

---

## [2.18.2] — 2026-06-15

### Mejoras
- Nueva página pública de inicio que explica qué es FinMoves (para el ingreso con Google).

---

## [2.18.1] — 2026-06-15

### Mejoras
- Agregamos las páginas de **Política de Privacidad** y **Condiciones del Servicio** (enlaces al pie del ingreso).

---

## [2.18.0] — 2026-06-15

### Novedades
- **Entrar con Google**: ahora podés vincular tu cuenta de Google (Configuración → Cuenta) y entrar con un toque. Al vincular, tomamos tu **nombre y foto** de Google para tu perfil.

---

## [2.17.1] — 2026-06-15

### Mejoras
- **Recordatorios más inteligentes**: te avisan unos días antes (cuando faltan 3 o menos) y de nuevo el día. Al avisarte el día, el recordatorio se borra solo.

---

## [2.17.0] — 2026-06-15

### Novedades
- **Venta de divisa** en Inversión: al vender, **baja tu reserva** y el dinero en pesos **suma a tu disponible** del mes. El selector ahora es Compra · Venta · Gasto.

### Mejoras
- En la carga, la fila de tipo es más ancha y "Guardar como plantilla" quedó como ícono.
- En Movimientos, las compras y ventas de dólares/euros se ven en **amarillo** (color de divisa).

---

## [2.16.0] — 2026-06-15

### Mejoras
- **Recordatorios** ahora abre como tarjeta centrada, y su acceso se pone **verde** cuando tenés alguno cargado.
- **Configuración reordenada** (Generales): Modo oscuro, Notificaciones, Recordatorios, Huella, Reportes, Auto-ahorro. El **desbloqueo con huella** pasó a Generales.
- Al abrir una ventana, **el fondo ya no se mueve**.
- El botón **Atrás** ahora **sale de la app** en vez de saltar entre secciones.

---

## [2.15.2] — 2026-06-15

### Arreglos
- Deslizar dentro de una ventana emergente ya no cambia de sección: ahora podés scrollear los modales sin que se escape el swipe.

---

## [2.15.1] — 2026-06-15

### Mejoras
- **Auto-ahorro** ahora abre como una tarjeta centrada.
- **Notificaciones y Recordatorios** quedaron arriba de todo en Generales.

---

## [2.15.0] — 2026-06-14

### Mejoras
- **Configuración reordenada**: Notificaciones y Recordatorios ahora están en **Generales**, y la configuración de **Inversión** quedó dentro de la sección **Inversión** (más ordenado).

---

## [2.14.2] — 2026-06-14

### Arreglos
- Las ventanas emergentes (como Recordatorios) ya no aparecían descolocadas o translúcidas: ahora se muestran bien centradas abajo.

---

## [2.14.1] — 2026-06-14

### Mejoras
- **Deslizar dentro de un gráfico o carrusel ya no te cambia de sección** sin querer.
- El aviso de **"Actualizar"** ahora aparece en cada versión nueva.

---

## [2.14.0] — 2026-06-14

### Novedades
- **Recordatorios**: en Configuración (con notificaciones activadas) podés cargar avisos puntuales con **texto + fecha**; te llega como notificación ese día.
- **Aviso si te olvidás de cargar**: si pasan varios días sin registrar un movimiento, te lo recordamos.

### Mejoras
- **"Guardar como plantilla"** quedó arriba, al lado del tipo, más a mano.

---

## [2.13.0] — 2026-06-14

### Novedades
- **Plantillas de gastos**: guardá un gasto frecuente como plantilla y la próxima vez cargalo con **un toque** — se precarga todo (categoría, monto editable, descripción, medio de pago) y solo confirmás. Cada plantilla se borra con la ×.

### Mejoras
- El color **naranja del Move** ahora también en Inicio.

---

## [2.12.1] — 2026-06-14

### Mejoras
- **Move tiene su propio color** (naranja), para distinguirlo de los dólares.
- En **Movimientos**, los días anteriores al más reciente se ven resumidos con la **cantidad de movimientos por tipo** (en color) y se abren con un toque.

---

## [2.12.0] — 2026-06-14

### Novedades
- **Días plegables en Movimientos**: solo el último día queda abierto; los días anteriores se muestran resumidos (fecha · cantidad · total gastado) y se abren con un toque. Adiós al scroll eterno cuando hay muchos días.

### Mejoras
- Las ventanas emergentes de Reportes (historial de sueldo, directo a ahorros, detalle del día, listas completas) ahora son todas la misma hoja deslizable, consistente con el resto de la app.
- **Las actualizaciones ya no molestan**: la app se actualiza sola la próxima vez que la abrís. Solo vas a ver el aviso "Actualizar" cuando una versión lo requiera de verdad.

---

## [2.11.0] — 2026-06-14

### Novedades
- **Deslizá entre secciones**: pasá de una pestaña a la de al lado deslizando el dedo hacia los costados (respeta tu orden y las pestañas que tengas ocultas). El gesto arranca desde el centro para no chocar con el "volver" de iOS ni con los carruseles.
- **Más datos en Períodos**: ahora ves la **mediana** de gasto por período (el valor típico, que no se distorsiona por un período raro) y una **variación** (`±%`) que te dice qué tan parejo es tu gasto entre períodos: verde = parejo, rojo = irregular. Mejor y peor período quedaron arriba, al lado.

### Mejoras
- La tarjeta de proyección del próximo período ya no repetía dos veces "promedio de los últimos 3".

---

## [2.10.2] — 2026-06-14

### Mejoras
- **Editar o borrar un movimiento es instantáneo** y usa menos datos.
- Si una edición o borrado falla, ahora te avisa con un mensaje (antes no se veía).

---

## [2.10.1] — 2026-06-14

### Mejoras
- **Hoja de carga renovada**: fondo desenfocado y una apertura más suave. La **barrita de arriba ahora funciona**: arrastrala hacia abajo para achicar la hoja (sin perder lo que cargaste), hacia arriba para agrandarla, y bien abajo para cerrarla.
- Las **fotos de comprobantes cargan mucho más rápido**.

---

## [2.10.0] — 2026-06-14

### Novedades
- **Tocá un KPI para ver el detalle**: en Reportes y en la meta de Inversión, al tocar una tarjeta se abre una card flotante con el **número exacto** y una explicación de qué significa. Las tarjetas quedaron más limpias.
- **Confirmaciones y detalles como card flotante**: eliminar un movimiento, borrar categorías/medios/orígenes, las advertencias de Configuración, el detalle del historial de Inversión y el historial de aumentos de sueldo ahora abren en una card centrada (antes era una hoja desde abajo).

### Mejoras
- **Reportes**: "vs período anterior" ahora muestra la **diferencia en $**; "categoría que más creció" muestra cuánto era antes. Aclaramos Tendencia (rojo = gastás más, verde = menos). El botón **"Comparar" pasó a "Varios"**.
- **Inversión**: precio promedio y ganancia se sumaron al recuadro principal (sacamos las dos tarjetas grandes).
- **Comprobantes**: la foto se ve enmarcada y el fondo del visor es más transparente (se ve la app detrás).

---

## [2.9.1] — 2026-06-14

### Novedades
- **Los comprobantes se abren dentro de la app**: al tocar una foto se abre un visor a pantalla completa con **zoom de dos dedos**, doble-toque para acercar y arrastrar para moverla. Los PDF se ven embebidos. Se cierra con ×, tocando afuera o Escape. Ya no te manda a esa dirección web fea.

---

## [2.9.0] — 2026-06-14

### Novedades
- **Cargá tu reserva desde Inversión**: un **+** verde abre un modal **+Reserva / −Reserva** en tu moneda (USD/EUR), rápido y compacto (tipo + fecha en una fila, "ingresar en" + cotización juntos). Cargás en pocos toques.
- **Disponible y restante en vivo**: al comprar reserva ves cuánto te queda del período a medida que cargás, con semáforo (verde / amarillo / rojo) según cuánto gastás.
- **El historial ahora muestra también los retiros** (−Reserva), en rojo, además de las compras.
- **Tocá un movimiento del historial** para ver su **detalle completo** (cantidad, cotización, etc.). Editar sigue siendo desde Movimientos.
- El historial muestra los **últimos 5** con "ver más".

### Cambios
- Las cargas a la reserva (+/−) salieron del modal de movimientos: ahora se hacen desde la pantalla de Inversión.

---

## [2.8.1] — 2026-06-14

### Arreglos
- **Se mezclaban preferencias entre cuentas en el mismo dispositivo**: la moneda de inversión y los toggles de secciones (Inversión/Reportes) quedaban guardados solo en el dispositivo y se filtraban de un usuario a otro. Ahora cada cuenta guarda lo suyo en su perfil, se carga al iniciar sesión y se limpia al cerrar sesión.

---

## [2.8.0] — 2026-06-14

### Novedades
- **Cotización manual** (Configuración → Inversión): un switch para usar un valor fijo en vez del automático de bluelytics. Si lo activás, ese valor se usa para valuar tu reserva en la moneda de inversión. Arriba ves siempre qué cotización estás usando.
- **Borrar un movimiento ahora es con mantener apretado**: dejá el dedo sobre el movimiento (en Movimientos o en Inicio) y se abre directo la confirmación para eliminar. Sacamos el tachito de la edición. (El sueldo que abre un período sigue sin poder borrarse.)

### Mejoras
- Tu **cotización es siempre la oficial**; el blue solo lo elegís al cargar una compra/gasto en dólares o euros.
- La sección **Inversión** ahora muestra el nombre en grande y la(s) moneda(s) arriba en chiquito.
- **Reportes** ya no se configura por partes: se ve todo siempre. Queda solo el encendido/apagado en Generales.
- Al entrar a **Configuración**, la sección **Cuenta** aparece abierta.
- **Editar movimiento** más prolijo: arriba Tipo · Categoría · Fecha, y abajo Monto + Descripción en una fila. Observaciones ya no dice "(opcional)".
- En el **changelog**, el "+" pasó a ser un **"ver más"** al pie.

---

## [2.7.0] — 2026-06-14

### Novedades
- **Descripción más inteligente**: te sugiere lo que ya cargaste antes según la categoría elegida.
- En el **changelog**, un botón **"+"** abre el historial completo en la web (te avisamos antes de salir del sitio).
- Si no usás la sección **Inversión**, ya no aparecen las cargas a la reserva (+USD/-USD/+EUR/-EUR).
- Ajustes en la pantalla de carga: el comprobante quedó como ícono junto a observaciones y el botón de confirmar.

---

## [2.6.2] — 2026-06-14

### Mejoras
- Pantalla de carga más compacta: el **comprobante** es un ícono al lado del medio de pago, y **observaciones** comparte fila con el botón de confirmar.

---

## [2.6.1] — 2026-06-14

### Mejoras
- Cargar un movimiento es más rápido: el **monto va primero**, con la **fecha al lado**.

---

## [2.6.0] — 2026-06-14

### Novedades
- Los **comprobantes** ahora también pueden ser **PDF**, no solo fotos.

---

## [2.5.0] — 2026-06-14

### Novedades
- **Comprobantes**: ahora podés adjuntar una **foto** a cada movimiento (al crearlo o editarlo), verla, reemplazarla o quitarla. Se guarda de forma segura y privada.

---

## [2.4.2] — 2026-06-14

### Correcciones
- Al cargar un gasto, el aviso de auto-ahorro ya no aparece si la descripción es una de las que excluís — la pantalla queda más limpia.

---

## [2.4.1] — 2026-06-14

### Mejoras
- La app **carga más rápido** y consume menos datos.

---

## [2.4.0] — 2026-06-14

### Novedades
- **Move en dos direcciones**: además de pasar plata de Ahorros a Disponible, ahora podés hacer el inverso (**Disponible → Ahorros**) para guardar. Elegís la dirección al cargar el Move; baja tu disponible y suma a tus ahorros.

---

## [2.3.2] — 2026-06-13

### Mejoras
- Las **notificaciones del dólar** ahora son más a tiempo y avisan por el cambio acumulado del día (antes podían no saltar).

---

## [2.3.0] — 2026-06-13

### Mejoras
- **Guía de inicio renovada**: ahora explica los **tipos de movimiento** y cómo funcionan los **ahorros y la reserva**, con el flujo de sueldo actualizado (sumar al período o abrir uno nuevo).
- Desde la guía ya podés **activar el desbloqueo con huella y las notificaciones**, sin tener que ir a Configuración.

---

## [2.2.0] — 2026-06-13

### Novedades
- **Aviso de novedades**: cada tanto (cada 5 versiones) te aparece un aviso con un botón **"Ver cambios"** que abre el detalle de las novedades. Así te enterás de lo nuevo sin que te moleste en cada actualización chica. También llega como notificación.

---

## [2.1.4] — 2026-06-13

### Correcciones
- La **cotización del euro** ahora carga bien también para usuarios nuevos (antes podía aparecer vacía).
- Si tu inversión es en **euros**, la **reserva inicial** ahora se carga y se muestra en EUR (antes quedaba fija en USD y se ignoraba).

---

## [2.1.3] — 2026-06-13

### Mejoras
- Un sueldo que **suma** al período en curso ahora se puede **eliminar**; el sueldo que **abre** el período no (es el que lo sostiene).
- Al eliminar, te avisamos que **la acción no se puede deshacer**.

---

## [2.1.2] — 2026-06-13

### Mejoras
- **"Tablero" ahora se llama "Resumen".**
- En Resumen, los atajos quedaron ordenados: Nuevo movimiento · Inversión · Reportes.
- El aviso de "sin conexión" ahora aparece **arriba**.
- Pequeño ajuste visual en la pantalla de carga.

---

## [2.1.0] — 2026-06-13

### Novedades
- **Sueldo con ingresos variables**: al cargar el sueldo ahora podés elegir entre **"Sumar al actual"** o **"Nuevo período"**. Ideal si cobrás por día o de forma irregular: vas sumando durante el ciclo y decidís cuándo arranca el período nuevo.
- Cuando un sueldo **abre un período nuevo**, lo que te sobró del anterior pasa solo a **Ahorros**.
- Ahora podés **editar la descripción** de un sueldo cargado.

### Mejoras
- **Cambiar contraseña** más seguro: te pide tu **contraseña actual** para confirmar y, al cambiarla, cierra la sesión para que entres con la nueva.
- El botón flotante **+** ahora se oculta mientras deslizás la lista y reaparece al soltar, así no te tapa los movimientos.

---

## [2.0.0] — 2026-06-13

¡Llegamos a la **versión 2.0**! 🎉 Un hito que junta todo lo último: crear y editar movimientos desde Inicio, contador en el ícono de la app, Reportes e Inversión renovados, notificaciones nuevas (metas de ahorro y recordatorio de sueldo), idioma completo ES/EN y una app más rápida. Por dentro también se mudó a una base más sólida. Nada cambia en cómo la usás: todo sigue donde estaba, mejor.

---

## [1.30.0] — 2026-06-13

### Novedades
- **Nuevas notificaciones**: te avisamos cuando alcanzás un hito de tu meta de ahorro (50/75/100%) y te recordamos cargar el sueldo cuando arranca un período nuevo.

---

## [1.29.0] — 2026-06-13

### Mejoras
- Desde **Inicio** ahora podés crear un movimiento o tocar uno reciente para editarlo, y se abre ahí mismo (ya no te lleva a la pestaña de Movimientos).
- La app instalada muestra un **contador** en su ícono con los movimientos del período.

---

## [1.28.0] — 2026-06-13

### Mejoras
- **Mejor experiencia como app instalada**: la barra del navegador toma el color correcto según el tema (claro/oscuro) y, si te quedás sin internet, ves una pantalla de "Sin conexión" en vez de un error.
- Mejoras internas de rendimiento y orden del código (sin cambios visibles en el uso diario).

---

## [1.27.1] — 2026-06-13

### Mejoras
- Iconos y logo de la app actualizados y más livianos.

---

## [1.27.0] — 2026-06-13

### Mejoras
- **Inicio renovado**: los datos (Sueldo, Gastado, Ahorros, Retiros) se ven en tarjetitas parejas con el resto de la app, y sumamos **atajos** para crear un movimiento o ir a Reportes/Inversión de un toque.
- Desde Inicio, tocá un movimiento de "Últimos movimientos" y se abre directo para editarlo.
- En Movimientos ya no hace falta el lapicito: tocás cualquier parte del movimiento y se abre para editarlo.

---

## [1.26.0] — 2026-06-13

### Mejoras
- **Inversión renovada**: misma estética que Reportes. La Reserva (USD/EUR) queda como tarjeta destacada y el resto con un look más limpio y parejo. Los datos de precio promedio, ganancia y la meta ahora se ven en tarjetitas ordenadas.
- Los números de la meta se calculan todos con la misma base (promedio de los últimos 3 períodos), así son coherentes entre sí, y se muestran con separador de miles.

---

## [1.25.1] — 2026-06-13

### Mejoras
- Ajustes visuales en Configuración: el icono de Backup quedó del mismo color que el de códigos de invitación, y sacamos las flechitas de la derecha en las filas donde el propio icono ya hace la acción.
- Sincronización con Google Sheets: ahora tocás la fila para ver el historial (sacamos el botón del relojito), igual que el resto de las opciones.
- Reportes: la selección de períodos es más cómoda al tacto. Ahora un toque elige un período, y con el botón **Comparar** sumás o sacás varios para compararlos (antes había que mantener apretado). Botones más grandes y fáciles de tocar.

---

## [1.25.0] — 2026-06-13

### Mejoras
- **Idioma completo**: ahora toda la app cambia de idioma de punta a punta, incluidos los títulos grandes de cada pantalla (Tablero, Movimientos, Reportes, Configuración, Dólares/Euros) y varios textos que antes quedaban fijos. Tus datos no se modifican: el cambio es solo visual.

---

## [1.24.2] — 2026-06-13

### Mejoras
- **Cambiar contraseña** más prolijo: ahora es una opción que se despliega solo si la tocás, con un ojito para ver lo que escribís. Ya no aparece un campo vacío colgado.
- Los iconos de **huella** y **notificaciones** se ponen en **verde** cuando están activos.
- El botón **Guardar** del perfil se activa solo si hay cambios.
- En Reportes, el gráfico "Evolución ingresos" ahora tiene el mismo borde que el resto.
- La proyección de ahorros arranca en **3 períodos** por defecto.

### Correcciones
- Si tenés el desbloqueo por huella activo, el aviso de **nueva versión** ya aparece aunque la app esté bloqueada.

---

## [1.24.1] — 2026-06-13

### Novedades
- **Instalá FinMoves como app**: nuevo botón en Configuración para instalarla en tu teléfono o compu (aparece solo si tu navegador lo permite y todavía no la instalaste).
- **Accesos directos**: al mantener presionado el ícono de la app podés saltar directo a Nuevo movimiento, Reportes o Inversión.

---

## [1.24.0] — 2026-06-13

### Novedades
- **Tu perfil**: tocá tu usuario en Configuración para ponerte un **nombre** y cambiar la **contraseña**. Cuando cargás tu nombre, aparece en lugar de "Usuario".
- **Guía siempre a mano**: nueva sección "Guía" en Configuración que explica cómo funciona la app, con un botón para **volver a ver el tutorial** cuando quieras.
- El selector de idioma ahora vive dentro de tu perfil.

---

## [1.23.0] — 2026-06-13

### Novedades
- **Reportes renovados por completo**: Gastos, Ingresos, Movimientos y Períodos quedaron más limpios y modernos, con un dato principal destacado arriba y métricas claras debajo.
- Movimientos ahora muestra la distribución por tipo y el movimiento más grande del período.
- Períodos pasó a ser una vista histórica (deja de repetir datos que ya ves en otras secciones).

### Mejoras
- Los montos grandes en Reportes ahora se ven completos (abreviados, ej. $1,6M).

---

## [1.22.2] — 2026-06-12

### Mejoras
- Arranque guiado para cuentas nuevas: si todavía no empezaste, la app te lleva a cargar tu primer sueldo.

---

## [1.22.1] — 2026-06-12

### Mejoras
- Arreglamos el arranque para cuentas nuevas: ahora el primer sueldo abre tu primer período sin trabas.
- Podés cargar tu **reserva inicial en USD** desde Configuración → Inversión.
- La pantalla de cargar movimiento quedó toda traducida.
- Reportes (Gastos) más limpio y fácil de leer.

---

## [1.22.0] — 2026-06-12

### Novedades
- **Guía de bienvenida** para usuarios nuevos: una pantalla simple que explica cómo funciona la app y deja todo listo en un minuto.
- **¿Olvidaste tu contraseña?** en el ingreso, para recuperarla por email.

### Mejoras
- La app quedó lista como aplicación instalable (íconos y detalles de PWA).
- Pequeños ajustes visuales.

---

## [1.21.0] — 2026-06-12

### Novedades
- **Notificaciones al celular**: activalas en Configuración → Cuenta. Te avisan cuando falla la sincronización, cuando hay una versión nueva, y cuando el dólar oficial se mueve fuerte (3% o más).

---

## [1.20.0] — 2026-06-11

### Novedades
- **Sección Inversión renovada**: más limpia y compacta. Pasó de muchas tarjetas a 3 bloques (Reserva, Meta e Historial), con toda la info de la meta en un solo lugar.

### Mejoras
- Sacamos el "U$D" repetido en cada número: el símbolo queda solo donde hace falta y se lee más fácil.

---

## [1.19.0] — 2026-06-11

### Novedades
- **Configuración renovada**: ahora todo está en una sola pantalla, con secciones que se despliegan al tocarlas. Tu cuenta y la sincronización quedaron arriba de todo.
- **Cambio de idioma con confirmación**: tocás la bandera, confirmás y la app se recarga ya en el idioma elegido.

### Mejoras
- El changelog ahora muestra solo las novedades más recientes, en lenguaje claro.

---

## [1.18.0] — 2026-06-11

### Novedades
- **Desbloqueo con huella**: activalo en Configuración → Cuenta. Al abrir la app te pide la huella antes de mostrar tus datos. Si falla, podés entrar con tu contraseña.
- **Aviso de fallo de sincronización**: si la sincronización con Google Sheets falla, aparece un punto rojo en el ícono de Configuración para que sepas que hay que revisar.

---

## [1.17.0] — 2026-06-11

### Novedades
- **Funciona sin conexión**: tus movimientos quedan disponibles aunque te quedes sin internet, y lo que cargues se sincroniza al reconectar.

### Mejoras
- El aviso de "nueva versión disponible" se ve más moderno y prolijo.
- El ícono de la app quedó más nítido.

---

## [1.16.0] — 2026-06-11

### Novedades
- **Pantalla de ingreso renovada**: más moderna y simple, con mostrar/ocultar contraseña.
- **La sesión se cierra sola** tras 8 horas sin uso, por seguridad.
- **Aviso cuando no hay internet**: una franja te avisa si te quedás sin conexión.

### Mejoras
- Los mensajes de error al ingresar ahora son claros ("Email o contraseña incorrectos") en vez de textos técnicos.

---

## [1.15.0] — 2026-06-11

### Novedades
- **Español e inglés**: cambiá el idioma de toda la app desde Configuración → Cuenta, tocando la bandera.

---
