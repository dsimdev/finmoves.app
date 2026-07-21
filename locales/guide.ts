// Contenido de la Guía (Config → Guía). Separado de los locales generales por volumen.
// Estructura: secciones con ítems (título + cuerpo). El cuerpo admite **negrita**.
// Cada sección tiene un color de acento (coherente con la paleta de la app).

export type GuideItem = { q: string; a: string };
export type GuideSection = { id: string; title: string; icon: string; color: string; items: GuideItem[] };

const es: GuideSection[] = [
  {
    id: "basico", title: "Cómo funciona", icon: "compass", color: "var(--accent)",
    items: [
      { q: "El período es el corazón de la app", a: "FinMoves no se organiza por mes calendario sino por **período**. Cada vez que cargás tu **Sueldo**, se abre un período nuevo. Todo —tu disponible, los KPIs, los reportes— se mide sobre el período en curso, no sobre el mes." },
      { q: "¿Qué es el disponible?", a: "Es la plata que te queda para gastar en este período: tu ingreso menos lo que gastaste y lo que moviste a ahorros. En Inicio es el número grande. El color pasa de verde a rojo según cuánto gastaste de tu ingreso." },
      { q: "El sueldo abre y ancla el período", a: "El sueldo es el **ancla** del período: define su fecha y por eso **no se puede borrar**. Si cargás un sueldo nuevo, se abre otro período. El resto de los movimientos sí se editan y borran libremente." },
      { q: "Inicio es para consultar", a: "La pantalla de Inicio muestra tu estado de un vistazo. Los últimos movimientos ahí son **solo para ver**: para editarlos o borrarlos, entrá a Movimientos." },
    ],
  },
  {
    id: "cargar", title: "Cargar movimientos", icon: "plus", color: "var(--green)",
    items: [
      { q: "Los tipos de movimiento", a: "**Gasto** (rojo): sale de tu disponible. **Ingreso** (verde): Sueldo abre período, o Ahorros entra directo a tus ahorros. **Move** (violeta/verde agua): mueve plata entre disponible y ahorros, sin gastarla." },
      { q: "Plantillas de gasto frecuente", a: "En el alta de un gasto, tocá el **marcador** para guardar ese gasto como plantilla. La próxima vez, tocá la plantilla arriba del formulario y se completa sola. La **×** la borra." },
      { q: "Repetir cada período (recurrentes)", a: "Al cargar un gasto o ingreso, marcá **\"repetir cada período\"** y FinMoves te va a recordar cargarlo cuando pase el tiempo. El **relojito** al lado de un movimiento indica que es recurrente." },
      { q: "Comprobantes", a: "Si tenés el permiso habilitado, podés adjuntar una **foto o PDF** a cada movimiento con el ícono del clip. Se sube solo, en segundo plano, y lo ves a pantalla completa al tocarlo." },
    ],
  },
  {
    id: "ahorros", title: "Ahorros e inversión", icon: "piggy", color: "var(--purple)",
    items: [
      { q: "Move a ahorros / a disponible", a: "**Move a ahorros** (violeta) saca plata de tu disponible y la guarda. **Move a disponible** (verde agua) hace lo contrario: trae plata de tus ahorros al período. No es un gasto ni un ingreso, solo mueve." },
      { q: "El RESTO (arrastre de período)", a: "Cuando abrís un período nuevo con tu sueldo, lo que te sobró del disponible anterior se arrastra automáticamente como un movimiento **RESTO** (azul) hacia tus ahorros. Por eso ves un movimiento que no cargaste: es tu sobrante que no se pierde." },
      { q: "Reserva en dólares o euros", a: "En Inversión llevás tu reserva de divisa: sumás con **Compra**, restás con **Venta**. La app calcula su valor en pesos al dólar oficial, tu **costo promedio** y la **ganancia**. La ganancia se mide solo sobre lo que compraste dentro de la app." },
    ],
  },
  {
    id: "gestos", title: "Gestos", icon: "hand", color: "var(--yellow)",
    items: [
      { q: "Deslizá una fila para editar o borrar", a: "En Movimientos, **deslizá una fila hacia la izquierda** y aparecen dos botones: el **lápiz** para editar y el **tacho** para borrar. Se cierra tocando en otro lado o al scrollear." },
      { q: "Deslizá entre las pestañas de Reportes", a: "En Reportes, **deslizá con el dedo** para cambiar entre Gastos, Ingresos, Movimientos y Períodos, sin tener que volver arriba a tocar los botones." },
      { q: "Tocá los números para entenderlos", a: "Casi todos los KPIs (los números grandes de colores en Inicio, Inversión y Reportes) son **tappeables**: tocalos y te explican qué significan y cómo se calculan." },
      { q: "Tocá los gráficos", a: "En Reportes, tocá una **barra de categoría**, un **día** o un **punto** del gráfico y se abre el detalle de eso: qué movimientos lo componen." },
      { q: "Otros gestos útiles", a: "**Tocá de nuevo la pestaña actual** abajo para volver al principio de la lista. En Movimientos, tocá el **encabezado de un día** para expandirlo. El botón **+** se esconde al scrollear y vuelve al parar." },
    ],
  },
  {
    id: "analizar", title: "Analizar y comparar", icon: "chart", color: "var(--teal)",
    items: [
      { q: "Reportes: mirá tu período", a: "Reportes desglosa tus gastos, ingresos y movimientos del período. Con el toggle **\"Comparar\"** podés elegir varios períodos y verlos juntos. La subtab **Períodos** muestra tu historial y tu inflación personal." },
      { q: "Análisis: buscá y compará", a: "Desde la **lupa** en Movimientos entrás a Análisis. Escribí un término (ej. \"nafta\") y fijalo con Enter. Podés sumar varios y compararlos: cuánto gastaste en cada uno, su evolución en el tiempo, o cuánto pesan sobre tu gasto total." },
      { q: "Comparar cosas parecidas", a: "En Análisis podés agrupar por descripción, categoría u **observación** — así comparás, por ejemplo, dos peajes distintos aunque estén en la misma categoría. Buscá los dos términos y quedan separados para compararlos." },
    ],
  },
  {
    id: "ajustes", title: "Ajustes útiles", icon: "gear", color: "var(--blue)",
    items: [
      { q: "Categorías, medios y orígenes", a: "En Configuración → Movimientos armás tus **categorías** de gasto/ingreso, **medios de pago** y **orígenes de ahorro**. Podés activarlos, desactivarlos o borrarlos (mantené apretado para borrar)." },
      { q: "Presupuesto por categoría", a: "Definí un presupuesto por categoría y se aplica solo a cada período nuevo. En Reportes → Gastos activás \"Presupuesto\" para ver cuánto llevás gastado de cada uno." },
      { q: "Notificaciones", a: "Activá las notificaciones para que FinMoves te recuerde cargar el sueldo, tus recurrentes, o avisos del dólar. También podés crear **recordatorios** puntuales con fecha." },
      { q: "Ocultar los montos", a: "El ícono del **ojo** oculta todos los montos de la app de un toque — útil si estás en público. Volvés a tocarlo y aparecen de nuevo." },
    ],
  },
];

const en: GuideSection[] = [
  {
    id: "basico", title: "How it works", icon: "compass", color: "var(--accent)",
    items: [
      { q: "The period is the heart of the app", a: "FinMoves isn't organized by calendar month but by **period**. Every time you log your **Salary**, a new period opens. Everything —your available balance, the KPIs, the reports— is measured over the current period, not the month." },
      { q: "What is the available balance?", a: "It's the money left to spend this period: your income minus what you spent and what you moved to savings. On Home it's the big number. Its color goes from green to red based on how much of your income you've spent." },
      { q: "The salary opens and anchors the period", a: "The salary is the period's **anchor**: it sets its date, which is why it **can't be deleted**. Logging a new salary opens another period. Every other movement can be freely edited or deleted." },
      { q: "Home is for checking", a: "The Home screen shows your status at a glance. The latest movements there are **view-only**: to edit or delete them, go to Movements." },
    ],
  },
  {
    id: "cargar", title: "Logging movements", icon: "plus", color: "var(--green)",
    items: [
      { q: "The movement types", a: "**Expense** (red): comes out of your available balance. **Income** (green): Salary opens a period, or Savings goes straight to your savings. **Move** (purple/teal): shifts money between available and savings, without spending it." },
      { q: "Frequent-expense templates", a: "When logging an expense, tap the **bookmark** to save it as a template. Next time, tap the template above the form and it fills in for you. The **×** deletes it." },
      { q: "Repeat each period (recurring)", a: "When logging an expense or income, check **\"repeat each period\"** and FinMoves will remind you to log it as time passes. The **little clock** next to a movement means it's recurring." },
      { q: "Receipts", a: "If you have the permission enabled, you can attach a **photo or PDF** to each movement with the clip icon. It uploads on its own, in the background, and opens full-screen on tap." },
    ],
  },
  {
    id: "ahorros", title: "Savings & investment", icon: "piggy", color: "var(--purple)",
    items: [
      { q: "Move to savings / to available", a: "**Move to savings** (purple) takes money from your available balance and stores it. **Move to available** (teal) does the opposite: brings money from savings into the period. It's neither an expense nor income, it just moves." },
      { q: "The RESTO (period carry-over)", a: "When you open a new period with your salary, whatever was left of the previous available balance carries over automatically as a **RESTO** movement (blue) into your savings. That's why you see a movement you didn't log: it's your leftover, saved." },
      { q: "Dollar or euro reserve", a: "In Investments you keep your currency reserve: add with **Buy**, subtract with **Sell**. The app shows its peso value at the official rate, your **average cost** and the **gain**. Gain is measured only on what you bought inside the app." },
    ],
  },
  {
    id: "gestos", title: "Gestures", icon: "hand", color: "var(--yellow)",
    items: [
      { q: "Swipe a row to edit or delete", a: "In Movements, **swipe a row left** and two buttons appear: the **pencil** to edit and the **trash** to delete. It closes when you tap elsewhere or scroll." },
      { q: "Swipe between Reports tabs", a: "In Reports, **swipe with your finger** to switch between Expenses, Income, Movements and Periods, without going back up to tap the buttons." },
      { q: "Tap the numbers to understand them", a: "Almost every KPI (the big colored numbers on Home, Investments and Reports) is **tappable**: tap them and they explain what they mean and how they're calculated." },
      { q: "Tap the charts", a: "In Reports, tap a **category bar**, a **day** or a **point** on a chart and its detail opens: which movements make it up." },
      { q: "Other handy gestures", a: "**Tap the current tab again** at the bottom to jump back to the top of the list. In Movements, tap a **day's header** to expand it. The **+** button hides while scrolling and returns when you stop." },
    ],
  },
  {
    id: "analizar", title: "Analyze & compare", icon: "chart", color: "var(--teal)",
    items: [
      { q: "Reports: look at your period", a: "Reports breaks down your expenses, income and movements for the period. With the **\"Compare\"** toggle you can pick several periods and see them together. The **Periods** subtab shows your history and your personal inflation." },
      { q: "Analyze: search and compare", a: "From the **magnifier** in Movements you reach Analyze. Type a term (e.g. \"fuel\") and pin it with Enter. You can add several and compare them: how much you spent on each, their trend over time, or how much they weigh on your total spending." },
      { q: "Comparing similar things", a: "In Analyze you can group by description, category or **note** — so you can compare, say, two different tolls even if they're in the same category. Search both terms and they stay separate to compare." },
    ],
  },
  {
    id: "ajustes", title: "Handy settings", icon: "gear", color: "var(--blue)",
    items: [
      { q: "Categories, methods and origins", a: "In Settings → Movements you set up your expense/income **categories**, **payment methods** and **savings origins**. You can enable, disable or delete them (press and hold to delete)." },
      { q: "Budget per category", a: "Set a budget per category and it applies to each new period automatically. In Reports → Expenses turn on \"Budget\" to see how much of each you've spent." },
      { q: "Notifications", a: "Turn on notifications so FinMoves reminds you to log your salary, your recurring items, or dollar alerts. You can also create one-off **reminders** with a date." },
      { q: "Hide the amounts", a: "The **eye** icon hides every amount in the app in one tap — handy in public. Tap it again and they're back." },
    ],
  },
];

export const GUIDE: Record<"es" | "en", GuideSection[]> = { es, en };
