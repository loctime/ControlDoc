#!/usr/bin/env node

/**
 * Script para intercambiar/cambiar emails entre dos cuentas de usuario
 * 
 * Uso: node swapUserEmails.js [tenantId] [--dry-run]
 * 
 * Cambia:
 * - Email en Firebase Auth
 * - realemail en Firestore (users y companies)
 * - email interno en Firestore (si existe)
 * 
 * Configuración:
 * - Cuenta original (UID: KIyzck38hHd3n2W07DPVonfrm1o2)
 *   - Actual: EMorales@segprosrl.com.ar
 *   - Nuevo: EMorales-backup@segprosrl.com.ar
 * 
 * - Cuenta nueva (UID: y3QxqMgYSDdZ4Hks2ORiMN468fw1)
 *   - Actual: Morales@segprosrl.com.ar
 *   - Nuevo: EMorales@segprosrl.com.ar
 * 
 * Ejemplo: node swapUserEmails.js hise --dry-run
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar Firebase
let db, auth;
try {
  const projectRoot = path.join(__dirname, '../../');
  const googleJsonPath = path.join(projectRoot, 'google.json');
  
  let serviceAccount;
  
  if (fs.existsSync(googleJsonPath)) {
    console.log('📄 Leyendo credenciales desde google.json...');
    const credentialsFile = fs.readFileSync(googleJsonPath, 'utf8');
    serviceAccount = JSON.parse(credentialsFile);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.log('📄 Leyendo credenciales desde variable de entorno...');
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } else {
    throw new Error('No se encontraron credenciales.');
  }
  
  const fixedServiceAccount = {
    ...serviceAccount,
    private_key: serviceAccount.private_key.replace(/\\n/g, '\n')
  };
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(fixedServiceAccount)
    });
    console.log('✅ Firebase inicializado correctamente');
  }
  
  db = admin.firestore();
  auth = admin.auth();
} catch (error) {
  console.error('❌ Error inicializando Firebase:', error.message);
  process.exit(1);
}

const DEFAULT_TENANT_ID = 'hise';

// Configuración de cuentas (INTERCAMBIO DE EMAILS)
const ACCOUNTS = {
  original: {
    uid: 'rQ8Yl3igHpWs57T2q5LIi5H4H7u2',
    currentEmail: '2@gmail.com',
    newEmail: '3@gmail.com', // Toma el email de la cuenta nueva
    companyId: '22222222222',
    companyName: 'dos'
  },
  new: {
    uid: '9fTJqBDhTpPQffSmhQwiw0NvmNF2',
    currentEmail: '3@gmail.com',
    newEmail: '2@gmail.com', // Toma el email de la cuenta original
    companyId: '33333333331',
    companyName: 'tres'
  }
};

const args = process.argv.slice(2);
const regularArgs = args.filter(arg => !arg.startsWith('--'));
const flags = args.filter(arg => arg.startsWith('--'));

const [tenantIdArg] = regularArgs;
const tenantId = tenantIdArg || DEFAULT_TENANT_ID;
const isDryRun = flags.includes('--dry-run');

console.log('📝 Configuración:');
console.log(`   Tenant ID: ${tenantId} ${tenantIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Modo dry-run: ${isDryRun ? 'Sí (no se guardarán cambios)' : 'No (se guardarán cambios)'}`);
console.log('');
console.log('📋 Cambios planificados:');
console.log(`   Cuenta Original (${ACCOUNTS.original.uid}):`);
console.log(`      Actual: ${ACCOUNTS.original.currentEmail}`);
console.log(`      Nuevo:  ${ACCOUNTS.original.newEmail}`);
console.log(`   Cuenta Nueva (${ACCOUNTS.new.uid}):`);
console.log(`      Actual: ${ACCOUNTS.new.currentEmail}`);
console.log(`      Nuevo:  ${ACCOUNTS.new.newEmail}`);
console.log('');

const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

async function validateEmails() {
  console.log('🔍 Validando intercambio de emails...\n');
  
  // Verificar que ambas cuentas tengan los emails correctos antes del intercambio
  console.log('   ℹ️  Verificando emails actuales de las cuentas...');
  
  try {
    const originalUser = await auth.getUser(ACCOUNTS.original.uid);
    if (originalUser.email !== ACCOUNTS.original.currentEmail) {
      console.warn(`   ⚠️  Email actual en Auth para cuenta original: ${originalUser.email} (esperado: ${ACCOUNTS.original.currentEmail})`);
    } else {
      console.log(`   ✅ Cuenta original tiene email correcto: ${originalUser.email}`);
    }
  } catch (error) {
    console.error(`   ❌ Error obteniendo cuenta original: ${error.message}`);
    return false;
  }
  
  try {
    const newUser = await auth.getUser(ACCOUNTS.new.uid);
    if (newUser.email !== ACCOUNTS.new.currentEmail) {
      console.warn(`   ⚠️  Email actual en Auth para cuenta nueva: ${newUser.email} (esperado: ${ACCOUNTS.new.currentEmail})`);
    } else {
      console.log(`   ✅ Cuenta nueva tiene email correcto: ${newUser.email}`);
    }
  } catch (error) {
    console.error(`   ❌ Error obteniendo cuenta nueva: ${error.message}`);
    return false;
  }
  
  console.log('');
  console.log('   ℹ️  No se valida disponibilidad porque es un intercambio directo');
  console.log('   ℹ️  Los emails se intercambiarán entre las dos cuentas existentes');
  console.log('');
  return true;
}

async function getUserData(uid) {
  const usersPath = getTenantPath('users');
  const userDoc = await db.collection(usersPath).doc(uid).get();
  
  if (!userDoc.exists) {
    throw new Error(`Usuario ${uid} no encontrado en Firestore`);
  }
  
  return userDoc.data();
}

async function getCompanyData(companyId) {
  const companiesPath = getTenantPath('companies');
  const companyDoc = await db.collection(companiesPath).doc(companyId).get();
  
  if (!companyDoc.exists) {
    throw new Error(`Empresa ${companyId} no encontrada en Firestore`);
  }
  
  return companyDoc.data();
}

async function updateAccountEmail(account, isDryRun) {
  const { uid, currentEmail, newEmail, companyId, companyName } = account;
  
  console.log(`📝 Actualizando cuenta: ${companyName} (${uid})`);
  console.log(`   ${currentEmail} → ${newEmail}`);
  
  try {
    // 1. Verificar usuario en Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUser(uid);
      if (userRecord.email !== currentEmail) {
        console.warn(`   ⚠️  Email en Auth (${userRecord.email}) no coincide con el esperado (${currentEmail})`);
      }
    } catch (error) {
      throw new Error(`Usuario no encontrado en Firebase Auth: ${error.message}`);
    }
    
    // 2. Obtener datos de Firestore
    const userData = await getUserData(uid);
    const companyData = await getCompanyData(companyId);
    
    console.log(`   📄 Usuario encontrado en Firestore`);
    console.log(`   📄 Empresa encontrada en Firestore`);
    
    if (!isDryRun) {
      // 3. Actualizar Firebase Auth
      console.log(`   🔄 Actualizando email en Firebase Auth...`);
      await auth.updateUser(uid, {
        email: newEmail
      });
      console.log(`   ✅ Email actualizado en Firebase Auth`);
      
      // 4. Actualizar Firestore - Users
      const usersPath = getTenantPath('users');
      const updates = {
        realemail: newEmail
      };
      
      // Si el usuario tiene email interno, también actualizarlo si coincide con el realemail
      if (userData.email && userData.email === currentEmail) {
        // No actualizamos el email interno generado (@controldoc.app), solo el realemail
        console.log(`   ℹ️  Email interno (${userData.email}) se mantiene (es generado)`);
      }
      
      await db.collection(usersPath).doc(uid).update(updates);
      console.log(`   ✅ realemail actualizado en Firestore (users)`);
      
      // 5. Actualizar Firestore - Companies
      const companiesPath = getTenantPath('companies');
      const companyUpdates = {
        realemail: newEmail
      };
      
      // Si la empresa tiene email interno que coincide, mantenerlo (es generado)
      if (companyData.email && companyData.email.includes('@controldoc.app')) {
        console.log(`   ℹ️  Email interno de empresa (${companyData.email}) se mantiene (es generado)`);
      }
      
      await db.collection(companiesPath).doc(companyId).update(companyUpdates);
      console.log(`   ✅ realemail actualizado en Firestore (companies)`);
    } else {
      console.log(`   🔍 DRY-RUN: Se actualizaría:`);
      console.log(`      - Firebase Auth: ${userRecord.email} → ${newEmail}`);
      console.log(`      - Firestore users: realemail → ${newEmail}`);
      console.log(`      - Firestore companies: realemail → ${newEmail}`);
    }
    
    console.log(`   ✅ Cuenta actualizada correctamente\n`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error actualizando cuenta: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
    throw error;
  }
}

async function swapEmails() {
  console.log('🔍 Verificando cuentas...\n');
  
  // Verificar que ambas cuentas existan
  for (const [key, account] of Object.entries(ACCOUNTS)) {
    try {
      const userRecord = await auth.getUser(account.uid);
      console.log(`✅ Cuenta ${key} encontrada en Firebase Auth: ${userRecord.email}`);
    } catch (error) {
      console.error(`❌ Error: Cuenta ${key} (${account.uid}) no encontrada en Firebase Auth`);
      process.exit(1);
    }
    
    try {
      await getUserData(account.uid);
      console.log(`✅ Usuario ${key} encontrado en Firestore`);
    } catch (error) {
      console.error(`❌ Error: Usuario ${key} no encontrado en Firestore: ${error.message}`);
      process.exit(1);
    }
    
    try {
      await getCompanyData(account.companyId);
      console.log(`✅ Empresa ${key} encontrada en Firestore`);
    } catch (error) {
      console.error(`❌ Error: Empresa ${key} no encontrada en Firestore: ${error.message}`);
      process.exit(1);
    }
  }
  
  console.log('');
  
  // Validar que los emails destino no existan
  const isValid = await validateEmails();
  if (!isValid) {
    console.error('❌ Validación fallida. No se pueden realizar los cambios.');
    process.exit(1);
  }
  
  if (isDryRun) {
    console.log('🔍 MODO DRY-RUN: No se guardarán cambios\n');
  }
  
  // Para intercambiar emails, necesitamos un email temporal porque Firebase Auth
  // no permite dos usuarios con el mismo email al mismo tiempo
  const tempEmail = `temp-swap-${Date.now()}@controldoc-temp.app`;
  
  console.log('='.repeat(80));
  console.log('INTERCAMBIO DE EMAILS (3 pasos necesarios)');
  console.log('='.repeat(80));
  console.log('');
  
  // PASO 1: Mover cuenta original a email temporal
  console.log('PASO 1: Moviendo cuenta original a email temporal');
  console.log(`   ${ACCOUNTS.original.currentEmail} → ${tempEmail}`);
  console.log('');
  await updateAccountEmail({
    ...ACCOUNTS.original,
    newEmail: tempEmail
  }, isDryRun);
  
  if (!isDryRun) {
    console.log('⏳ Esperando 1 segundo...\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // PASO 2: Mover cuenta nueva al email de la original
  console.log('PASO 2: Moviendo cuenta nueva al email de la original');
  console.log(`   ${ACCOUNTS.new.currentEmail} → ${ACCOUNTS.original.currentEmail}`);
  console.log('');
  await updateAccountEmail({
    ...ACCOUNTS.new,
    newEmail: ACCOUNTS.original.currentEmail
  }, isDryRun);
  
  if (!isDryRun) {
    console.log('⏳ Esperando 1 segundo...\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // PASO 3: Mover cuenta original al email de la nueva
  console.log('PASO 3: Moviendo cuenta original al email de la nueva');
  console.log(`   ${tempEmail} → ${ACCOUNTS.new.currentEmail}`);
  console.log('');
  await updateAccountEmail({
    ...ACCOUNTS.original,
    currentEmail: tempEmail,
    newEmail: ACCOUNTS.new.currentEmail
  }, isDryRun);
  
  console.log('='.repeat(80));
  if (isDryRun) {
    console.log('🔍 RESUMEN DRY-RUN');
  } else {
    console.log('✅ INTERCAMBIO COMPLETADO');
  }
  console.log('='.repeat(80));
  console.log(`   Cuenta Original (${ACCOUNTS.original.companyName}):`);
  console.log(`      Antes: ${ACCOUNTS.original.currentEmail}`);
  console.log(`      Ahora: ${ACCOUNTS.new.currentEmail}`);
  console.log(`   Cuenta Nueva (${ACCOUNTS.new.companyName}):`);
  console.log(`      Antes: ${ACCOUNTS.new.currentEmail}`);
  console.log(`      Ahora: ${ACCOUNTS.original.currentEmail}`);
  console.log('='.repeat(80));
  console.log('');
  
  if (isDryRun) {
    console.log('💡 Para ejecutar los cambios reales, ejecuta el script sin --dry-run');
    console.log('');
  } else {
    console.log('✅ Los usuarios ahora pueden iniciar sesión con sus nuevos emails');
    console.log('');
  }
}

swapEmails()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

