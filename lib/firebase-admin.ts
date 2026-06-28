import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  const filePath = path.join(process.cwd(), "firebase-service-account.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function initAdmin() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ credential: cert(getServiceAccount()) });
}

export function adminDb() {
  return getFirestore(initAdmin());
}

export function adminAuth() {
  return getAuth(initAdmin());
}

export function adminBucket() {
  return getStorage(initAdmin()).bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
}
