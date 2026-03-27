// backend/firebaseconfig.js
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar credenciales: 1) variable JSON, 2) ruta en env, 3) archivo *-firebase-adminsdk-*.json en backend
let serviceAccount = null;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const p = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (fs.existsSync(p)) {
    serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
}
if (!serviceAccount) {
  const backendDir = __dirname;
  const files = fs.readdirSync(backendDir);
  const credFile = files.find((f) => f.endsWith('.json') && f.includes('firebase') && f.includes('adminsdk'));
  if (credFile) {
    serviceAccount = JSON.parse(fs.readFileSync(path.join(backendDir, credFile), 'utf8'));
  }
}
if (!serviceAccount) {
  console.error('❌ No se encontraron credenciales de Firebase.');
  console.error('   Opciones: GOOGLE_APPLICATION_CREDENTIALS_JSON, GOOGLE_APPLICATION_CREDENTIALS (ruta), o un archivo *-firebase-adminsdk-*.json en backend/');
  process.exit(1);
}

// DEBUG: Logs para verificar el formato de las credenciales
console.log('=== DEBUG FIREBASE CREDENTIALS ===');
console.log('Service Account Type:', serviceAccount.type);
console.log('Project ID:', serviceAccount.project_id);
console.log('Client Email:', serviceAccount.client_email);
console.log('Private Key ID:', serviceAccount.private_key_id);
console.log('Private Key Length:', serviceAccount.private_key?.length);
console.log('Private Key Starts With:', serviceAccount.private_key?.substring(0, 30));
console.log('Private Key Ends With:', serviceAccount.private_key?.slice(-30));
console.log('==================================');

try {
  // Solución temporal: reemplazar \\n por \n si es necesario
  const fixedServiceAccount = {
    ...serviceAccount,
    private_key: serviceAccount.private_key.replace(/\\n/g, '\n')
  };

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(fixedServiceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('Firebase initialized successfully!');
  }
} catch (error) {
  console.error('=== FIREBASE INITIALIZATION ERROR ===');
  console.error('Error:', error.message);
  console.error('Error Stack:', error.stack);
  console.error('Full Error Object:', JSON.stringify(error, null, 2));
  throw error;
}

const db = admin.firestore();
const auth = admin.auth();

const ADMIN_ROLE = process.env.ADMIN_ROLE || 'DhHkVja'; // Constante para roles

/**
 * Verifica si un usuario es administrador basado en su rol
 * /**
 
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isUserAdmin(userId) {
  try {
    const docRef = db.collection('companies').doc(userId);
    const snapshot = await docRef.get();
    return snapshot.exists && snapshot.data().role === ADMIN_ROLE;
  } catch (error) {
    console.error('Error al verificar rol de administrador:', error);
    return false;
  }
}

export { db, auth, ADMIN_ROLE, isUserAdmin };
