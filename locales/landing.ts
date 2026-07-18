// Textos de la landing (home no-logueada). Separados de los locales generales, igual que
// guide.ts: es contenido de marketing, no UI de la app, y es lo que indexa Google.

export type Slide = { title: string; desc: string; img: string };
export type Feature = { title: string; desc: string; icon: string };

export type LandingCopy = {
  line1: string; line2: string; sub: string;
  enter: string; install: string; installHint: string;
  access1: string; accessBold: string; access2: string; access3: string;
  privacy: string; terms: string; contact: string;
  featuresTitle: string;
  slides: Slide[];
  features: Feature[];
};

const es: LandingCopy = {
  line1: "Tus finanzas personales,",
  line2: "claras",
  sub: "FinMoves es tu app de finanzas personales: registrá, analizá y seguí tus gastos, ingresos, ahorros e inversiones. Tus datos son tuyos: privados, seguros, sin publicidad.",
  enter: "Ingresar",
  install: "Instalar",
  installHint: "Instalala en el celular para tenerla a mano y recibir avisos.",
  access1: "Acceso",
  accessBold: "por invitación",
  access2: "— ingresá con un código provisto por el administrador.",
  access3: "Podés iniciar sesión con email o con tu cuenta de Google.",
  privacy: "Política de Privacidad",
  terms: "Condiciones del Servicio",
  contact: "Contacto:",
  featuresTitle: "Todo lo que necesitás para ordenar tu plata",
  slides: [
    { title: "Movimientos", desc: "Cargá gastos e ingresos por categoría, medio de pago y período.", img: "/screenshots/new-movement.png" },
    { title: "Reportes", desc: "Mirá en qué se va tu plata: categorías, tendencias y proyecciones.", img: "/screenshots/reports-expenses.jpeg" },
    { title: "Inversión", desc: "Tu reserva en dólares o euros, con cotización y metas.", img: "/screenshots/portfolio.png" },
    { title: "Configuración", desc: "Ajustá monedas, idioma y preferencias a tu gusto.", img: "/screenshots/settings.png" },
  ],
  features: [
    { title: "Por período, no por mes", desc: "Cada sueldo abre un período nuevo. Tus números siguen tu ciclo real de cobro, no el calendario.", icon: "calendar" },
    { title: "Recordatorios que sirven", desc: "Te avisa si un gasto recurrente vence, si hace días que no cargás nada o si el dólar se movió.", icon: "bell" },
    { title: "Ahorros e inversión", desc: "Seguí tus ahorros, tu reserva en dólares o euros y cuánto te falta para tu meta.", icon: "trending" },
    { title: "Tus datos son tuyos", desc: "Privados y seguros. Sin publicidad, sin vender tu información a nadie.", icon: "shield" },
  ],
};

const en: LandingCopy = {
  line1: "Your personal finances,",
  line2: "clear",
  sub: "FinMoves is your personal finance app: track and analyze your expenses, income, savings and investments. Your data is yours: private, secure, no ads.",
  enter: "Sign in",
  install: "Install",
  installHint: "Install it on your phone to keep it handy and get reminders.",
  access1: "Access is",
  accessBold: "invite-only",
  access2: "— sign up with a code provided by the admin.",
  access3: "You can sign in with email or your Google account.",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  contact: "Contact:",
  featuresTitle: "Everything you need to get your money in order",
  slides: [
    { title: "Transactions", desc: "Log expenses and income by category, payment method and period.", img: "/screenshots/new-movement.png" },
    { title: "Reports", desc: "See where your money goes: categories, trends and projections.", img: "/screenshots/reports-expenses.jpeg" },
    { title: "Investments", desc: "Your USD/EUR reserve, with exchange rate and goals.", img: "/screenshots/portfolio.png" },
    { title: "Settings", desc: "Adjust currencies, language and preferences your way.", img: "/screenshots/settings.png" },
  ],
  features: [
    { title: "By period, not by month", desc: "Every paycheck opens a new period. Your numbers follow your real pay cycle, not the calendar.", icon: "calendar" },
    { title: "Reminders that matter", desc: "Get a nudge when a recurring bill is due, when you haven't logged anything in days, or when the dollar moves.", icon: "bell" },
    { title: "Savings and investments", desc: "Track your savings, your USD/EUR reserve and how far you are from your goal.", icon: "trending" },
    { title: "Your data is yours", desc: "Private and secure. No ads, no selling your information to anyone.", icon: "shield" },
  ],
};

export const landing = { es, en };
