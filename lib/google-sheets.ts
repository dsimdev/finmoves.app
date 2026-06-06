import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SHEET_GID = 630526110;
const BACKUP_PREFIX = "_bak ";
const MAX_BACKUPS = 5;

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  const filePath = path.join(process.cwd(), "google-sheets-credentials.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

type SheetsClient = Awaited<ReturnType<typeof getSheetsClient>>;

export async function getSheetName(sheets: SheetsClient): Promise<string> {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = res.data.sheets?.find(
    (s) => s.properties?.sheetId === SHEET_GID
  );
  return sheet?.properties?.title ?? "Movimientos";
}

// Nombre de backup ordenable cronológicamente: "_bak 2026-06-06 14-30-00" (hora AR)
function backupName(): string {
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${BACKUP_PREFIX}${ar.getUTCFullYear()}-${p(ar.getUTCMonth() + 1)}-${p(ar.getUTCDate())} ${p(ar.getUTCHours())}-${p(ar.getUTCMinutes())}-${p(ar.getUTCSeconds())}`;
}

// Duplica la hoja Movimientos como pestaña de backup y borra las que excedan MAX_BACKUPS.
// Debe correr ANTES de reescribir; si falla, no se debe espejar.
export async function backupAndRotate(sheets: SheetsClient): Promise<string> {
  const name = backupName();

  // Contar hojas existentes para insertar el backup AL FINAL (después de la última pestaña).
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const allSheets = meta.data.sheets ?? [];

  // 1) Snapshot al final de las pestañas.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ duplicateSheet: { sourceSheetId: SHEET_GID, newSheetName: name, insertSheetIndex: allSheets.length } }],
    },
  });

  // 2) Rotación: borrar los backups previos que excedan el límite (la copia nueva nunca se borra).
  const baksPrevios = allSheets
    .map((s) => s.properties!)
    .filter((p) => p.title?.startsWith(BACKUP_PREFIX))
    .sort((a, b) => a.title!.localeCompare(b.title!)); // viejo → nuevo

  const exceso = baksPrevios.length + 1 - MAX_BACKUPS;
  if (exceso > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: baksPrevios.slice(0, exceso).map((p) => ({ deleteSheet: { sheetId: p.sheetId } })),
      },
    });
  }
  return name;
}

// Espejo: reemplaza TODOS los datos (desde la fila 2, preserva el header)
// con las filas dadas. Refleja altas, ediciones y borrados de la app.
export async function overwriteData(
  sheets: SheetsClient,
  sheetName: string,
  rows: (string | number)[][]
): Promise<void> {
  // 1) Borrar datos viejos (fila 2 en adelante), dejando el encabezado.
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A2:I`,
  });
  // 2) Escribir el set completo actual.
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
  }
}
