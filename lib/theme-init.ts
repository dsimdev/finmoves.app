// Fuente única del tema claro. El default oscuro vive en globals.css y en el
// `viewport` export del layout; acá definimos solo el override claro y el color
// de la barra del navegador (theme-color) para cada tema.
export const LIGHT_VARS: Record<string, string> = {
  "--bg": "#c8c8c8",
  "--surface": "#f4f4f4",
  "--surface-alt": "#e4e4e4",
  "--border": "#b8b8b8",
  "--border-hi": "#909090",
  "--accent-dim": "#3f52e828",
  "--green": "#007a38",
  "--green-dim": "#007a3822",
  "--red-dim": "#ff525222",
  "--yellow": "#a06200",
  "--yellow-dim": "#a0620022",
  "--blue-dim": "#536dfe22",
  "--text": "#0d1524",
  "--muted": "#4a5060",
  "--faint": "#d0d0d0",
  "--nav-bg": "rgba(244,244,244,0.92)",
};

export const THEME_COLOR = { dark: "#07090f", light: "#c8c8c8" };

// Corre en el <head> antes del primer paint: aplica el tema claro guardado en
// localStorage (evita el flash de oscuro) y ajusta la barra del navegador.
// Debe ser autocontenido (sin imports) porque se serializa e inyecta inline.
export const themeInitScript = `try{if(localStorage.getItem('finmoves-theme')!=='dark'){var v=${JSON.stringify(
  LIGHT_VARS
)},s=document.documentElement.style;for(var k in v)s.setProperty(k,v[k]);document.documentElement.setAttribute('data-theme','light');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',${JSON.stringify(
  THEME_COLOR.light
)});}}catch(e){}`;
