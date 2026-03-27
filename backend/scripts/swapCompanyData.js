#!/usr/bin/env node

/**
 * Script para INTERCAMBIAR TODOS LOS DATOS entre dos empresas
 * 
 * Uso: node swapCompanyData.js [tenantId] [--dry-run]
 * 
 * Intercambia:
 * - Emails (realemail y email en Auth)
 * - CUIT (y renombra documentos de companies)
 * - companyName
 * - emails internos generados
 * - Otros campos (telefono, direccion, etc.)
 * - Actualiza referencias en todas las colecciones relacionadas
 * 
 * Configuración de prueba:
 * - Cuenta original: "dos" (CUIT: 22222222222, email: 2@gmail.com)
 * - Cuenta nueva: "tres" (CUIT: 33333333331, email: 3@gmail.com)
 * 
 * Ejemplo: node swapCompanyData.js hise --dry-run
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

// Configuración de cuentas
const ACCOUNTS = {
  original: {
    uid: 'rQ8Yl3igHpWs57T2q5LIi5H4H7u2',
    companyId: '22222222222',
    companyName: 'dos',
    email: '2@gmail.com'
  },
  new: {
    uid: '9fTJqBDhTpPQffSmhQwiw0NvmNF2',
    companyId: '33333333331',
    companyName: 'tres',
    email: '3@gmail.com'
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
console.log('📋 INTERCAMBIO COMPLETO DE DATOS:');
console.log(`   Cuenta Original: "${ACCOUNTS.original.companyName}" (${ACCOUNTS.original.companyId})`);
console.log(`   Cuenta Nueva: "${ACCOUNTS.new.companyName}" (${ACCOUNTS.new.companyId})`);
console.log('');

const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

// Colecciones que tienen referencias a companyId
const COLLECTIONS_WITH_COMPANY_ID = [
  'requiredDocuments',
  'uploadedDocuments',
  'approvedDocuments',
  'personal',
  'vehiculos'
];

async function getAllCompanyData(companyId, uid) {
  const companiesPath = getTenantPath('companies');
  const usersPath = getTenantPath('users');
  
  // Obtener datos de company
  const companyDoc = await db.collection(companiesPath).doc(companyId).get();
  if (!companyDoc.exists) {
    throw new Error(`Empresa ${companyId} no encontrada`);
  }
  
  // Obtener datos de user
  const userDoc = await db.collection(usersPath).doc(uid).get();
  if (!userDoc.exists) {
    throw new Error(`Usuario ${uid} no encontrado`);
  }
  
  // Obtener datos de Firebase Auth
  const authUser = await auth.getUser(uid);
  
  return {
    company: companyDoc.data(),
    user: userDoc.data(),
    authEmail: authUser.email
  };
}

async function updateCompanyReferences(oldCompanyId, newCompanyId, isDryRun) {
  console.log(`   📝 Actualizando referencias de companyId: ${oldCompanyId} → ${newCompanyId}`);
  
  let totalUpdated = 0;
  
  for (const collectionName of COLLECTIONS_WITH_COMPANY_ID) {
    const collectionPath = getTenantPath(collectionName);
    const query = db.collection(collectionPath).where('companyId', '==', oldCompanyId);
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log(`      ${collectionName}: 0 documentos`);
      continue;
    }
    
    console.log(`      ${collectionName}: ${snapshot.docs.length} documentos`);
    
    if (!isDryRun) {
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { companyId: newCompanyId });
      });
      await batch.commit();
      totalUpdated += snapshot.docs.length;
    }
  }
  
  console.log(`   ✅ ${totalUpdated} referencias actualizadas`);
  return totalUpdated;
}

async function swapAllData() {
  console.log('🔍 Verificando cuentas...\n');
  
  // Obtener todos los datos de ambas empresas
  let originalData, newData;
  
  try {
    console.log('📥 Obteniendo datos de cuenta original...');
    originalData = await getAllCompanyData(ACCOUNTS.original.companyId, ACCOUNTS.original.uid);
    console.log(`   ✅ Empresa: ${originalData.company.companyName || originalData.company.name}`);
    console.log(`   ✅ Usuario: ${originalData.user.realemail || originalData.authEmail}`);
    console.log(`   ✅ Email Auth: ${originalData.authEmail}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Error obteniendo datos de cuenta original: ${error.message}`);
    process.exit(1);
  }
  
  try {
    console.log('📥 Obteniendo datos de cuenta nueva...');
    newData = await getAllCompanyData(ACCOUNTS.new.companyId, ACCOUNTS.new.uid);
    console.log(`   ✅ Empresa: ${newData.company.companyName || newData.company.name}`);
    console.log(`   ✅ Usuario: ${newData.user.realemail || newData.authEmail}`);
    console.log(`   ✅ Email Auth: ${newData.authEmail}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Error obteniendo datos de cuenta nueva: ${error.message}`);
    process.exit(1);
  }
  
  if (isDryRun) {
    console.log('🔍 MODO DRY-RUN: No se guardarán cambios\n');
  }
  
  console.log('='.repeat(80));
  console.log('INICIANDO INTERCAMBIO COMPLETO DE DATOS');
  console.log('='.repeat(80));
  console.log('');
  
  // Preparar datos intercambiados
  const tempCompanyId = `temp-swap-${Date.now()}`;
  
  const companiesPath = getTenantPath('companies');
  const usersPath = getTenantPath('users');
  
  if (!isDryRun) {
    // PASO 1: Renombrar empresa original a temporal (para liberar CUIT)
    console.log('PASO 1: Renombrando empresa original a temporal');
    console.log(`   ${ACCOUNTS.original.companyId} → ${tempCompanyId}`);
    
    const originalCompanyRef = db.collection(companiesPath).doc(ACCOUNTS.original.companyId);
    const originalCompanyData = originalCompanyRef.get();
    
    // Crear documento temporal con datos originales
    await db.collection(companiesPath).doc(tempCompanyId).set((await originalCompanyData).data());
    await originalCompanyRef.delete();
    console.log('   ✅ Empresa original movida a temporal\n');
    
    // PASO 2: Renombrar empresa nueva al CUIT de la original
    console.log('PASO 2: Renombrando empresa nueva al CUIT de la original');
    console.log(`   ${ACCOUNTS.new.companyId} → ${ACCOUNTS.original.companyId}`);
    
    const newCompanyRef = db.collection(companiesPath).doc(ACCOUNTS.new.companyId);
    const newCompanyData = (await newCompanyRef.get()).data();
    
    // Actualizar datos de la nueva empresa con datos de la original (intercambio)
    await db.collection(companiesPath).doc(ACCOUNTS.original.companyId).set({
      ...newCompanyData,
      cuit: ACCOUNTS.original.companyId,
      companyName: originalData.company.companyName || originalData.company.name,
      realemail: originalData.company.realemail || originalData.authEmail,
      email: originalData.company.email, // email interno
      telefono: originalData.company.telefono,
      direccion: originalData.company.direccion,
      ownerId: ACCOUNTS.original.uid
    });
    await newCompanyRef.delete();
    console.log('   ✅ Empresa nueva renombrada y datos intercambiados\n');
    
    // PASO 3: Renombrar empresa temporal (original) al CUIT de la nueva
    console.log('PASO 3: Renombrando empresa temporal al CUIT de la nueva');
    console.log(`   ${tempCompanyId} → ${ACCOUNTS.new.companyId}`);
    
    const tempCompanyData = (await db.collection(companiesPath).doc(tempCompanyId).get()).data();
    
    // Actualizar datos de la original con datos de la nueva (intercambio)
    await db.collection(companiesPath).doc(ACCOUNTS.new.companyId).set({
      ...tempCompanyData,
      cuit: ACCOUNTS.new.companyId,
      companyName: newData.company.companyName || newData.company.name,
      realemail: newData.company.realemail || newData.authEmail,
      email: newData.company.email, // email interno
      telefono: newData.company.telefono,
      direccion: newData.company.direccion,
      ownerId: ACCOUNTS.new.uid
    });
    await db.collection(companiesPath).doc(tempCompanyId).delete();
    console.log('   ✅ Empresa original renombrada y datos intercambiados\n');
    
    // PASO 4: Actualizar referencias de companyId en todas las colecciones
    // IMPORTANTE: Como intercambiamos los CUITs (renombramos documentos), necesitamos
    // actualizar todas las referencias que apuntan a esos CUITs.
    // - Referencias que apuntaban a original.companyId ahora deben apuntar a new.companyId
    // - Referencias que apuntaban a new.companyId ahora deben apuntar a original.companyId
    
    console.log('PASO 4: Actualizando referencias de companyId en todas las colecciones');
    console.log(`   Referencias de ${ACCOUNTS.original.companyId} → ${ACCOUNTS.new.companyId}`);
    await updateCompanyReferences(ACCOUNTS.original.companyId, ACCOUNTS.new.companyId, isDryRun);
    console.log(`   Referencias de ${ACCOUNTS.new.companyId} → ${ACCOUNTS.original.companyId}`);
    await updateCompanyReferences(ACCOUNTS.new.companyId, ACCOUNTS.original.companyId, isDryRun);
    console.log('');
    
    // PASO 5: Actualizar usuarios en Firestore
    console.log('PASO 5: Actualizando usuarios en Firestore');
    
    // Usuario original - ahora apunta al CUIT de la nueva empresa (pero con datos intercambiados)
    await db.collection(usersPath).doc(ACCOUNTS.original.uid).update({
      companyId: ACCOUNTS.new.companyId, // Ahora apunta al CUIT de la nueva
      companyName: newData.company.companyName || newData.company.name, // Datos de la nueva
      realemail: newData.user.realemail || newData.authEmail, // Email de la nueva
      email: newData.user.email, // email interno de la nueva
      telefono: newData.user.telefono || newData.company.telefono,
      direccion: newData.user.direccion || newData.company.direccion
    });
    console.log(`   ✅ Usuario original actualizado (ahora apunta a CUIT ${ACCOUNTS.new.companyId})`);
    
    // Usuario nuevo - ahora apunta al CUIT de la original (pero con datos intercambiados)
    await db.collection(usersPath).doc(ACCOUNTS.new.uid).update({
      companyId: ACCOUNTS.original.companyId, // Ahora apunta al CUIT de la original
      companyName: originalData.company.companyName || originalData.company.name, // Datos de la original
      realemail: originalData.user.realemail || originalData.authEmail, // Email de la original
      email: originalData.user.email, // email interno de la original
      telefono: originalData.user.telefono || originalData.company.telefono,
      direccion: originalData.user.direccion || originalData.company.direccion
    });
    console.log(`   ✅ Usuario nuevo actualizado (ahora apunta a CUIT ${ACCOUNTS.original.companyId})\n`);
    
    // PASO 6: Actualizar emails en Firebase Auth (intercambio con email temporal)
    console.log('PASO 6: Actualizando emails en Firebase Auth');
    const tempEmail = `temp-swap-${Date.now()}@controldoc-temp.app`;
    
    // Mover original a temporal
    await auth.updateUser(ACCOUNTS.original.uid, { email: tempEmail });
    console.log(`   ✅ Original: ${originalData.authEmail} → ${tempEmail}`);
    
    // Mover nueva al email de la original
    await auth.updateUser(ACCOUNTS.new.uid, { email: originalData.authEmail });
    console.log(`   ✅ Nueva: ${newData.authEmail} → ${originalData.authEmail}`);
    
    // Mover original al email de la nueva
    await auth.updateUser(ACCOUNTS.original.uid, { email: newData.authEmail });
    console.log(`   ✅ Original: ${tempEmail} → ${newData.authEmail}\n`);
    
  } else {
    // Modo dry-run: solo mostrar qué se haría
    console.log('🔍 DRY-RUN: Se intercambiarían los siguientes datos:\n');
    console.log('Empresas (companies):');
    console.log(`   ${ACCOUNTS.original.companyId} ↔ ${ACCOUNTS.new.companyId}`);
    console.log(`   companyName: "${originalData.company.companyName}" ↔ "${newData.company.companyName}"`);
    console.log(`   realemail: "${originalData.company.realemail}" ↔ "${newData.company.realemail}"`);
    console.log(`   email interno: "${originalData.company.email}" ↔ "${newData.company.email}"`);
    console.log(`   telefono: "${originalData.company.telefono}" ↔ "${newData.company.telefono}"`);
    console.log(`   direccion: "${originalData.company.direccion}" ↔ "${newData.company.direccion}"`);
    console.log('');
    console.log('Usuarios (users):');
    console.log(`   companyId: ${ACCOUNTS.original.companyId} ↔ ${ACCOUNTS.new.companyId}`);
    console.log(`   realemail: "${originalData.user.realemail}" ↔ "${newData.user.realemail}"`);
    console.log('');
    console.log('Firebase Auth:');
    console.log(`   ${originalData.authEmail} ↔ ${newData.authEmail}`);
    console.log('');
    console.log('Referencias en colecciones:');
    for (const collectionName of COLLECTIONS_WITH_COMPANY_ID) {
      console.log(`   ${collectionName}: companyId se intercambiaría`);
    }
  }
  
  console.log('='.repeat(80));
  if (isDryRun) {
    console.log('🔍 RESUMEN DRY-RUN');
  } else {
    console.log('✅ INTERCAMBIO COMPLETO FINALIZADO');
  }
  console.log('='.repeat(80));
  console.log(`   Cuenta Original ahora tiene:`);
  console.log(`      CUIT: ${ACCOUNTS.new.companyId}`);
  console.log(`      Nombre: ${newData.company.companyName || newData.company.name}`);
  console.log(`      Email: ${newData.authEmail}`);
  console.log(`   Cuenta Nueva ahora tiene:`);
  console.log(`      CUIT: ${ACCOUNTS.original.companyId}`);
  console.log(`      Nombre: ${originalData.company.companyName || originalData.company.name}`);
  console.log(`      Email: ${originalData.authEmail}`);
  console.log('='.repeat(80));
  console.log('');
  
  if (isDryRun) {
    console.log('💡 Para ejecutar los cambios reales, ejecuta el script sin --dry-run');
    console.log('');
  } else {
    console.log('✅ Intercambio completo realizado. Las empresas ahora tienen los datos intercambiados.');
    console.log('');
  }
}

swapAllData()
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

