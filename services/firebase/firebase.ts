import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId es público (GA4). Fallback al literal para no depender de un secret.
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-7M1GF7F4WD",
};

export const app = initializeApp(firebaseConfig);

// App Check (anti-abuso): exige que las llamadas a Firestore/Storage/Auth vengan de
// una instancia legítima de la app, no de un script con la API key pública. Se activa
// solo si hay site key de reCAPTCHA v3 configurada; sin ella (dev local) es no-op.
// Para forzar en producción: registrar reCAPTCHA v3 en Firebase App Check, setear
// NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY y habilitar enforcement en la consola.
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
  if (appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

export const auth = getAuth(app);
export const storage = getStorage(app);

// En el cliente: caché persistente en IndexedDB → los datos quedan disponibles
// sin conexión y las escrituras se encolan hasta reconectar. En el server (SSR)
// no hay IndexedDB, así que se usa la instancia estándar en memoria.
let _db: Firestore;
if (typeof window !== "undefined") {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} else {
  _db = getFirestore(app);
}
export const db = _db;
