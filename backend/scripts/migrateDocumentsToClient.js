#!/usr/bin/env node

/**
 * Script de migración: Mover documentos aprobados de empresa principal a cliente
 * 
 * Uso: node migrateDocumentsToClient.js [--dry-run] [--backup] [tenantId] [mainCompanyId] [clientId]
 * 
 * Opciones:
 *   --dry-run    Solo muestra qué haría sin ejecutar cambios
 *   --backup     Crea un backup antes de migrar (se guarda en ./backups/)
 * 
 * Ejemplo: node migrateDocumentsToClient.js --dry-run --backup
 * 
 * Este script:
 * 1. Verifica que el cliente pertenece a la empresa principal
 * 2. Crea backup (si --backup está activo)
 * 3. Migra documentos de uploadedDocuments (agrega clientId, mantiene companyId)
 * 4. Migra documentos de approvedDocuments (agrega clientId, mantiene companyId)
 * 5. Actualiza requiredDocuments para incluir el cliente en appliesTo.clients
 * 6. Migra empleados de personal (agrega clientId, mantiene companyId)
 * 7. Migra vehículos de vehiculos (agrega clientId, mantiene companyId)
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar Firebase desde archivo o variable de entorno
let db;
try {
  // Intentar leer desde archivo google.json en la raíz del proyecto
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
    throw new Error('No se encontraron credenciales. Coloca google.json en la raíz del proyecto o configura GOOGLE_APPLICATION_CREDENTIALS_JSON');
  }
  
  // Arreglar private_key si tiene \\n
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
} catch (error) {
  console.error('❌ Error inicializando Firebase:', error.message);
  process.exit(1);
}

// ============================================
// CONFIGURACIÓN - Edita estos valores según tu caso
// ============================================
const DEFAULT_TENANT_ID = 'hise'; // Tenant ID
const DEFAULT_MAIN_COMPANY_ID = '20373003403'; // ID de la empresa principal "dieguito"
const DEFAULT_CLIENT_NAME_OR_ID = 'ultimo'; // Nombre o ID del cliente (el script buscará por nombre si no es un ID)
// ============================================

// Parsear argumentos
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const doBackup = args.includes('--backup');
const regularArgs = args.filter(arg => !arg.startsWith('--'));

const [tenantIdArg, mainCompanyIdArg, clientNameOrIdArg] = regularArgs;
const tenantId = tenantIdArg || DEFAULT_TENANT_ID;
const mainCompanyId = mainCompanyIdArg || DEFAULT_MAIN_COMPANY_ID;
const clientNameOrId = clientNameOrIdArg || DEFAULT_CLIENT_NAME_OR_ID;

console.log('📝 Configuración de migración:');
console.log(`   Tenant ID: ${tenantId} ${tenantIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Empresa principal: ${mainCompanyId} ${mainCompanyIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Cliente (nombre o ID): ${clientNameOrId} ${clientNameOrIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Modo: ${isDryRun ? '🔍 DRY-RUN (solo simulación)' : '⚡ EJECUCIÓN REAL'}`);
console.log(`   Backup: ${doBackup ? '✅ Activado' : '❌ Desactivado'}`);
console.log('');

// Rutas multi-tenant
const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

// Función para buscar cliente por nombre o ID
async function findClientByNameOrId(clientNameOrId, mainCompanyId) {
  const companiesPath = getTenantPath('companies');
  
  // Primero intentar como ID directo
  const clientRef = db.collection(companiesPath).doc(clientNameOrId);
  const clientDoc = await clientRef.get();
  
  if (clientDoc.exists) {
    const data = clientDoc.data();
    if (data.parentCompanyId === mainCompanyId) {
      return { id: clientDoc.id, ...data };
    }
  }
  
  // Si no existe como ID, buscar por nombre
  const clientsQuery = db.collection(companiesPath)
    .where('parentCompanyId', '==', mainCompanyId)
    .where('companyName', '==', clientNameOrId);
  
  const snapshot = await clientsQuery.get();
  
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  
  // También buscar en el campo 'name' por si acaso
  const nameQuery = db.collection(companiesPath)
    .where('parentCompanyId', '==', mainCompanyId)
    .where('name', '==', clientNameOrId);
  
  const nameSnapshot = await nameQuery.get();
  
  if (!nameSnapshot.empty) {
    const doc = nameSnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  
  throw new Error(`Cliente "${clientNameOrId}" no encontrado para la empresa principal ${mainCompanyId}`);
}

// Función para crear backup
async function createBackup(uploadedDocs, approvedDocs, requiredDocs, personalDocs, vehiculosDocs, clientId) {
  const backupDir = path.join(__dirname, 'backups');
  
  // Crear directorio de backups si no existe
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `migration-backup-${tenantId}-${timestamp}.json`);
  
  const backupData = {
    timestamp: new Date().toISOString(),
    tenantId,
    mainCompanyId,
    clientId,
    uploadedDocuments: uploadedDocs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })),
    approvedDocuments: approvedDocs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })),
    requiredDocuments: requiredDocs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })),
    personal: personalDocs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })),
    vehiculos: vehiculosDocs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  };
  
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`💾 Backup guardado en: ${backupFile}`);
  console.log(`   - ${uploadedDocs.length} documentos de uploadedDocuments`);
  console.log(`   - ${approvedDocs.length} documentos de approvedDocuments`);
  console.log(`   - ${requiredDocs.length} documentos de requiredDocuments`);
  console.log(`   - ${personalDocs.length} empleados de personal`);
  console.log(`   - ${vehiculosDocs.length} vehículos de vehiculos`);
  
  return backupFile;
}

async function migrateDocumentsToClient() {
  console.log('🚀 Iniciando migración de documentos a cliente...');
  console.log(`   Tenant: ${tenantId}`);
  console.log(`   Empresa principal: ${mainCompanyId}`);
  console.log(`   Cliente (nombre o ID): ${clientNameOrId}`);
  
  try {
    // 1. Buscar el cliente por nombre o ID
    console.log(`\n🔍 Buscando cliente "${clientNameOrId}"...`);
    const clientData = await findClientByNameOrId(clientNameOrId, mainCompanyId);
    const clientId = clientData.id;
    
    console.log(`✅ Cliente encontrado: ${clientData.companyName || clientData.name || clientId}`);
    console.log(`   ID del cliente: ${clientId}`);
    
    // 2. Obtener todos los documentos para backup y migración
    console.log('\n📥 Obteniendo documentos...');
    
    const uploadedPath = getTenantPath('uploadedDocuments');
    const uploadedQuery = db.collection(uploadedPath)
      .where('companyId', '==', mainCompanyId);
    const uploadedSnapshot = await uploadedQuery.get();
    const uploadedDocsToMigrate = uploadedSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.clientId || data.clientId === null;
    });
    const uploadedDocsWithClient = uploadedSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.clientId && data.clientId !== null;
    });
    
    const approvedPath = getTenantPath('approvedDocuments');
    const approvedQuery = db.collection(approvedPath)
      .where('companyId', '==', mainCompanyId);
    const approvedSnapshot = await approvedQuery.get();
    const approvedDocsToMigrate = approvedSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.clientId || data.clientId === null;
    });
    const approvedDocsWithClient = approvedSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.clientId && data.clientId !== null;
    });
    
    const requiredPath = getTenantPath('requiredDocuments');
    const requiredQuery = db.collection(requiredPath)
      .where('companyId', '==', mainCompanyId);
    const requiredSnapshot = await requiredQuery.get();
    
    // Obtener personal (empleados)
    const personalPath = getTenantPath('personal');
    const personalQuery = db.collection(personalPath)
      .where('companyId', '==', mainCompanyId);
    const personalSnapshot = await personalQuery.get();
    const personalDocsToMigrate = personalSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.clientId || data.clientId === null;
    });
    const personalDocsWithClient = personalSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.clientId && data.clientId !== null;
    });
    
    // Obtener vehiculos
    const vehiculosPath = getTenantPath('vehiculos');
    const vehiculosQuery = db.collection(vehiculosPath)
      .where('companyId', '==', mainCompanyId);
    const vehiculosSnapshot = await vehiculosQuery.get();
    const vehiculosDocsToMigrate = vehiculosSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.clientId || data.clientId === null;
    });
    const vehiculosDocsWithClient = vehiculosSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.clientId && data.clientId !== null;
    });
    
    console.log(`📄 Encontrados ${uploadedSnapshot.size} documentos en uploadedDocuments`);
    console.log(`   ✅ ${uploadedDocsToMigrate.length} necesitan migración (sin clientId)`);
    console.log(`   ⏭️  ${uploadedDocsWithClient.length} ya tienen clientId (no se migrarán)`);
    
    // Mostrar ejemplos de uploadedDocuments
    if (uploadedDocsToMigrate.length > 0) {
      console.log(`\n   📋 Ejemplos de uploadedDocuments a migrar (primeros 5):`);
      uploadedDocsToMigrate.slice(0, 5).forEach((doc, idx) => {
        const data = doc.data();
        console.log(`      ${idx + 1}. ID: ${doc.id}`);
        console.log(`         - Nombre: ${data.name || data.documentName || 'Sin nombre'}`);
        console.log(`         - Tipo: ${data.entityType || 'N/A'}`);
        console.log(`         - Estado: ${data.status || 'N/A'}`);
        console.log(`         - companyId: ${data.companyId || 'N/A'}`);
        console.log(`         - clientId actual: ${data.clientId || 'null/undefined'}`);
      });
    }
    
    console.log(`\n📄 Encontrados ${approvedSnapshot.size} documentos en approvedDocuments`);
    console.log(`   ✅ ${approvedDocsToMigrate.length} necesitan migración (sin clientId)`);
    console.log(`   ⏭️  ${approvedDocsWithClient.length} ya tienen clientId (no se migrarán)`);
    
    // Mostrar ejemplos de approvedDocuments
    if (approvedDocsToMigrate.length > 0) {
      console.log(`\n   📋 Ejemplos de approvedDocuments a migrar (primeros 5):`);
      approvedDocsToMigrate.slice(0, 5).forEach((doc, idx) => {
        const data = doc.data();
        console.log(`      ${idx + 1}. ID: ${doc.id}`);
        console.log(`         - Nombre: ${data.name || data.documentName || 'Sin nombre'}`);
        console.log(`         - Tipo: ${data.entityType || 'N/A'}`);
        console.log(`         - Estado: ${data.status || 'N/A'}`);
        console.log(`         - companyId: ${data.companyId || 'N/A'}`);
        console.log(`         - clientId actual: ${data.clientId || 'null/undefined'}`);
      });
    }
    
    console.log(`\n📋 Encontrados ${requiredSnapshot.size} documentos requeridos`);
    
    // Mostrar ejemplos de requiredDocuments
    if (requiredSnapshot.size > 0) {
      console.log(`\n   📋 Ejemplos de requiredDocuments a actualizar (primeros 5):`);
      requiredSnapshot.docs.slice(0, 5).forEach((doc, idx) => {
        const data = doc.data();
        const appliesTo = data.appliesTo || { main: true, clients: [] };
        console.log(`      ${idx + 1}. ID: ${doc.id}`);
        console.log(`         - Nombre: ${data.name || 'Sin nombre'}`);
        console.log(`         - Tipo: ${data.entityType || 'N/A'}`);
        console.log(`         - appliesTo.main: ${appliesTo.main}`);
        console.log(`         - appliesTo.clients: ${JSON.stringify(appliesTo.clients)}`);
      });
    }
    
    console.log(`\n👥 Encontrados ${personalSnapshot.size} empleados en personal`);
    console.log(`   ✅ ${personalDocsToMigrate.length} necesitan migración (sin clientId)`);
    console.log(`   ⏭️  ${personalDocsWithClient.length} ya tienen clientId (no se migrarán)`);
    
    // Mostrar ejemplos de personal
    if (personalDocsToMigrate.length > 0) {
      console.log(`\n   📋 Ejemplos de empleados a migrar (primeros 5):`);
      personalDocsToMigrate.slice(0, 5).forEach((doc, idx) => {
        const data = doc.data();
        console.log(`      ${idx + 1}. ID: ${doc.id}`);
        console.log(`         - Nombre: ${data.nombre || data.name || 'Sin nombre'}`);
        console.log(`         - DNI: ${data.dni || 'N/A'}`);
        console.log(`         - companyId: ${data.companyId || 'N/A'}`);
        console.log(`         - clientId actual: ${data.clientId || 'null/undefined'}`);
      });
    }
    
    console.log(`\n🚗 Encontrados ${vehiculosSnapshot.size} vehículos en vehiculos`);
    console.log(`   ✅ ${vehiculosDocsToMigrate.length} necesitan migración (sin clientId)`);
    console.log(`   ⏭️  ${vehiculosDocsWithClient.length} ya tienen clientId (no se migrarán)`);
    
    // Mostrar ejemplos de vehiculos
    if (vehiculosDocsToMigrate.length > 0) {
      console.log(`\n   📋 Ejemplos de vehículos a migrar (primeros 5):`);
      vehiculosDocsToMigrate.slice(0, 5).forEach((doc, idx) => {
        const data = doc.data();
        console.log(`      ${idx + 1}. ID: ${doc.id}`);
        console.log(`         - Patente: ${data.patente || 'N/A'}`);
        console.log(`         - Marca/Modelo: ${data.marca || ''} ${data.modelo || ''}`.trim() || 'N/A');
        console.log(`         - companyId: ${data.companyId || 'N/A'}`);
        console.log(`         - clientId actual: ${data.clientId || 'null/undefined'}`);
      });
    }
    
    // 3. Crear backup si está activo
    if (doBackup && !isDryRun) {
      console.log('\n💾 Creando backup...');
      await createBackup(
        uploadedDocsToMigrate, 
        approvedDocsToMigrate, 
        requiredSnapshot.docs,
        personalDocsToMigrate,
        vehiculosDocsToMigrate,
        clientId
      );
    } else if (doBackup && isDryRun) {
      console.log('\n💾 [DRY-RUN] Backup se crearía aquí (desactivado en modo dry-run)');
    }
    
    // 4. Migrar uploadedDocuments
    console.log(`\n${isDryRun ? '🔍 [DRY-RUN]' : '⚡'} Procesando uploadedDocuments...`);
    
    let uploadedCount = 0;
    const uploadedBatch = db.batch();
    let batchCount = 0;
    const BATCH_LIMIT = 500;
    
    for (const docSnap of uploadedDocsToMigrate) {
      const docRef = db.collection(uploadedPath).doc(docSnap.id);
      uploadedBatch.update(docRef, {
        clientId: clientId,
        migratedAt: new Date().toISOString(),
        migratedFrom: 'main-company'
      });
      batchCount++;
      uploadedCount++;
      
      if (batchCount >= BATCH_LIMIT && !isDryRun) {
        await uploadedBatch.commit();
        console.log(`   ${isDryRun ? '🔍 [DRY-RUN]' : '✅'} Procesados ${uploadedCount} documentos (batch commit)`);
        batchCount = 0;
      }
    }
    
    if (batchCount > 0 && !isDryRun) {
      await uploadedBatch.commit();
    }
    console.log(`${isDryRun ? '🔍 [DRY-RUN]' : '✅'} ${isDryRun ? 'Se migrarían' : 'Migrados'} ${uploadedCount} documentos en uploadedDocuments`);
    
    // 5. Migrar approvedDocuments
    console.log(`\n${isDryRun ? '🔍 [DRY-RUN]' : '⚡'} Procesando approvedDocuments...`);
    
    let approvedCount = 0;
    const approvedBatch = db.batch();
    batchCount = 0;
    
    for (const docSnap of approvedDocsToMigrate) {
      const docRef = db.collection(approvedPath).doc(docSnap.id);
      approvedBatch.update(docRef, {
        clientId: clientId,
        migratedAt: new Date().toISOString(),
        migratedFrom: 'main-company'
      });
      batchCount++;
      approvedCount++;
      
      if (batchCount >= BATCH_LIMIT && !isDryRun) {
        await approvedBatch.commit();
        console.log(`   ${isDryRun ? '🔍 [DRY-RUN]' : '✅'} Procesados ${approvedCount} documentos (batch commit)`);
        batchCount = 0;
      }
    }
    
    if (batchCount > 0 && !isDryRun) {
      await approvedBatch.commit();
    }
    console.log(`${isDryRun ? '🔍 [DRY-RUN]' : '✅'} ${isDryRun ? 'Se migrarían' : 'Migrados'} ${approvedCount} documentos en approvedDocuments`);
    
    // 6. Actualizar requiredDocuments para incluir el cliente
    console.log(`\n${isDryRun ? '🔍 [DRY-RUN]' : '⚡'} Procesando requiredDocuments...`);
    
    let requiredCount = 0;
    const requiredBatch = db.batch();
    batchCount = 0;
    
    for (const docSnap of requiredSnapshot.docs) {
      const docData = docSnap.data();
      const currentAppliesTo = docData.appliesTo || { main: true, clients: [] };
      
      // Si clients es null (aplica a todos), mantenerlo
      // Si clients es array, agregar el cliente si no está
      let newClients = currentAppliesTo.clients;
      
      if (Array.isArray(newClients)) {
        const clientIdStr = String(clientId);
        if (!newClients.some(id => String(id) === clientIdStr)) {
          newClients = [...newClients, clientId];
        }
      } else if (newClients === null) {
        // Si aplica a todos, mantener null (no cambiar)
        newClients = null;
      } else {
        // Si no es array ni null, inicializar con el cliente
        newClients = [clientId];
      }
      
      const docRef = db.collection(requiredPath).doc(docSnap.id);
      requiredBatch.update(docRef, {
        appliesTo: {
          main: currentAppliesTo.main !== false,
          clients: newClients
        },
        migratedAt: new Date().toISOString()
      });
      
      batchCount++;
      requiredCount++;
      
      if (batchCount >= BATCH_LIMIT && !isDryRun) {
        await requiredBatch.commit();
        console.log(`   ${isDryRun ? '🔍 [DRY-RUN]' : '✅'} Procesados ${requiredCount} documentos requeridos (batch commit)`);
        batchCount = 0;
      }
    }
    
    if (batchCount > 0 && !isDryRun) {
      await requiredBatch.commit();
    }
    console.log(`${isDryRun ? '🔍 [DRY-RUN]' : '✅'} ${isDryRun ? 'Se actualizarían' : 'Actualizados'} ${requiredCount} documentos requeridos`);
    
    // 7. Migrar personal (empleados)
    console.log(`\n${isDryRun ? '🔍 [DRY-RUN]' : '⚡'} Procesando personal (empleados)...`);
    
    let personalCount = 0;
    const personalBatch = db.batch();
    batchCount = 0;
    
    for (const docSnap of personalDocsToMigrate) {
      const docRef = db.collection(personalPath).doc(docSnap.id);
      personalBatch.update(docRef, {
        clientId: clientId,
        migratedAt: new Date().toISOString(),
        migratedFrom: 'main-company'
      });
      batchCount++;
      personalCount++;
      
      if (batchCount >= BATCH_LIMIT && !isDryRun) {
        await personalBatch.commit();
        console.log(`   ${isDryRun ? '🔍 [DRY-RUN]' : '✅'} Procesados ${personalCount} empleados (batch commit)`);
        batchCount = 0;
      }
    }
    
    if (batchCount > 0 && !isDryRun) {
      await personalBatch.commit();
    }
    console.log(`${isDryRun ? '🔍 [DRY-RUN]' : '✅'} ${isDryRun ? 'Se migrarían' : 'Migrados'} ${personalCount} empleados en personal`);
    
    // 8. Migrar vehiculos
    console.log(`\n${isDryRun ? '🔍 [DRY-RUN]' : '⚡'} Procesando vehiculos...`);
    
    let vehiculosCount = 0;
    const vehiculosBatch = db.batch();
    batchCount = 0;
    
    for (const docSnap of vehiculosDocsToMigrate) {
      const docRef = db.collection(vehiculosPath).doc(docSnap.id);
      vehiculosBatch.update(docRef, {
        clientId: clientId,
        migratedAt: new Date().toISOString(),
        migratedFrom: 'main-company'
      });
      batchCount++;
      vehiculosCount++;
      
      if (batchCount >= BATCH_LIMIT && !isDryRun) {
        await vehiculosBatch.commit();
        console.log(`   ${isDryRun ? '🔍 [DRY-RUN]' : '✅'} Procesados ${vehiculosCount} vehículos (batch commit)`);
        batchCount = 0;
      }
    }
    
    if (batchCount > 0 && !isDryRun) {
      await vehiculosBatch.commit();
    }
    console.log(`${isDryRun ? '🔍 [DRY-RUN]' : '✅'} ${isDryRun ? 'Se migrarían' : 'Migrados'} ${vehiculosCount} vehículos en vehiculos`);
    
    // Resumen
    console.log(`\n📊 Resumen de migración ${isDryRun ? '(DRY-RUN - NO SE EJECUTARON CAMBIOS)' : ''}:`);
    console.log(`   ${isDryRun ? '🔍' : '✅'} Documentos en uploadedDocuments: ${uploadedCount}`);
    console.log(`   ${isDryRun ? '🔍' : '✅'} Documentos en approvedDocuments: ${approvedCount}`);
    console.log(`   ${isDryRun ? '🔍' : '✅'} Documentos requeridos actualizados: ${requiredCount}`);
    console.log(`   ${isDryRun ? '🔍' : '✅'} Empleados en personal: ${personalCount}`);
    console.log(`   ${isDryRun ? '🔍' : '✅'} Vehículos en vehiculos: ${vehiculosCount}`);
    
    if (isDryRun) {
      console.log('\n🔍 MODO DRY-RUN: No se realizaron cambios. Ejecuta sin --dry-run para aplicar la migración.');
    } else {
      console.log('\n✅ Migración completada exitosamente!');
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Ejecutar migración
migrateDocumentsToClient()
  .then(() => {
    console.log('\n✅ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  });

export { migrateDocumentsToClient };

