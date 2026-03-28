// backend/firebaseconfig.js
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── ControlDoc: Firestore ──────────────────────────────────────
// Orden de búsqueda: 1) variable JSON, 2) ruta en env, 3) archivo *-firebase-adminsdk-*.json en backend/
let controlDocServiceAccount = null;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  controlDocServiceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  if (controlDocServiceAccount.private_key) {
    controlDocServiceAccount.private_key = controlDocServiceAccount.private_key.replace(/\\n/g, '\n');
  }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const p = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (fs.existsSync(p)) {
    controlDocServiceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
}

if (!controlDocServiceAccount) {
  const files = fs.readdirSync(__dirname);
  const credFile = files.find((f) => f.endsWith('.json') && f.includes('firebase') && f.includes('adminsdk'));
  if (credFile) {
    controlDocServiceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, credFile), 'utf8'));
  }
}

if (!controlDocServiceAccount) {
  console.error('❌ No se encontraron credenciales de ControlDoc (Firestore).');
  console.error('   Opciones: GOOGLE_APPLICATION_CREDENTIALS_JSON, GOOGLE_APPLICATION_CREDENTIALS o un archivo *-firebase-adminsdk-*.json en backend/');
  process.exit(1);
}

// ── ControlFile: Auth ──────────────────────────────────────────
let controlFileServiceAccount = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_CONTROLFILE_JSON) {
  controlFileServiceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_CONTROLFILE_JSON);
  if (controlFileServiceAccount.private_key) {
    controlFileServiceAccount.private_key = controlFileServiceAccount.private_key.replace(/\\n/g, '\n');
  }
}
if (!controlFileServiceAccount) {
  console.error('❌ Falta GOOGLE_APPLICATION_CREDENTIALS_CONTROLFILE_JSON (service account JSON para ControlFile / Auth).');
  process.exit(1);
}

// ── Inicializar apps (evitar duplicados en hot reload) ─────────
const controlDocApp = admin.apps.find(a => a?.name === 'controldoc')
  || admin.initializeApp({ credential: admin.credential.cert(controlDocServiceAccount) }, 'controldoc');

const controlFileApp = admin.apps.find(a => a?.name === 'controlfile')
  || admin.initializeApp({ credential: admin.credential.cert(controlFileServiceAccount) }, 'controlfile');

console.log('✅ Firebase Admin: ControlDoc (Firestore) + ControlFile (Auth) inicializados');

// ── Exports ────────────────────────────────────────────────────
export const controlDocDb   = controlDocApp.firestore();
export const controlFileAuth = controlFileApp.auth();

// Aliases para compatibilidad con imports existentes en otros archivos
export const db   = controlDocDb;
export const auth = controlFileAuth;

const ADMIN_ROLE = process.env.ADMIN_ROLE || 'DhHkVja';

async function isUserAdmin(userId) {
  try {
    const snapshot = await controlDocDb.collection('companies').doc(userId).get();
    return snapshot.exists && snapshot.data().role === ADMIN_ROLE;
  } catch (error) {
    console.error('Error al verificar rol de administrador:', error);
    return false;
  }
}

export { ADMIN_ROLE, isUserAdmin };
