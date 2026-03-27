#!/usr/bin/env node

/**
 * Script para asignar documentos a clientes según el nombre del documento
 * 
 * Uso: node assignDocumentsToClientsByName.js [tenantId] [mainCompanyId] [--dry-run] [--backup]
 * 
 * Lógica de asignación:
 * - Si el documento contiene "ypf" o "YPF" en el nombre → cliente YPF
 * - Si el documento contiene "RDA" o "rda" en el nombre → cliente RDA
 * - Si no contiene ninguno → cliente RDA (por defecto)
 * - Empleados y vehículos → cliente RDA
 * 
 * Ejemplo: node assignDocumentsToClientsByName.js hise 22222222222 --dry-run
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar Firebase
let db;
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
} catch (error) {
  console.error('❌ Error inicializando Firebase:', error.message);
  process.exit(1);
}

const DEFAULT_TENANT_ID = 'hise';
const DEFAULT_MAIN_COMPANY_ID = '22222222222'; // Empresa "dos"

const args = process.argv.slice(2);
const regularArgs = args.filter(arg => !arg.startsWith('--'));
const flags = args.filter(arg => arg.startsWith('--'));

const [tenantIdArg, mainCompanyIdArg] = regularArgs;
const tenantId = tenantIdArg || DEFAULT_TENANT_ID;
const mainCompanyId = mainCompanyIdArg || DEFAULT_MAIN_COMPANY_ID;
const isDryRun = flags.includes('--dry-run');
const shouldBackup = flags.includes('--backup');

console.log('📝 Configuración:');
console.log(`   Tenant ID: ${tenantId} ${tenantIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Empresa principal: ${mainCompanyId} ${mainCompanyIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Modo dry-run: ${isDryRun ? 'Sí (no se guardarán cambios)' : 'No (se guardarán cambios)'}`);
console.log(`   Backup: ${shouldBackup ? 'Sí' : 'No'}`);
console.log('');

const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

// Función para determinar a qué cliente pertenece un documento según su nombre
function determineClientByName(documentName, ypfClientId, rdaClientId) {
  if (!documentName) {
    return rdaClientId; // Por defecto RDA si no hay nombre
  }
  
  const nameLower = documentName.toLowerCase();
  
  if (nameLower.includes('ypf')) {
    return ypfClientId;
  }
  
  if (nameLower.includes('rda')) {
    return rdaClientId;
  }
  
  // Por defecto RDA si no contiene ninguno
  return rdaClientId;
}

async function assignDocumentsToClients() {
  console.log('🔍 Obteniendo clientes de la empresa...\n');
  
  // 1. Obtener todos los clientes de la empresa principal
  const companiesPath = getTenantPath('companies');
  const clientsQuery = db.collection(companiesPath)
    .where('parentCompanyId', '==', mainCompanyId)
    .where('type', '==', 'client');
  
  const clientsSnapshot = await clientsQuery.get();
  
  if (clientsSnapshot.empty) {
    console.error('❌ Error: No se encontraron clientes para esta empresa');
    process.exit(1);
  }
  
  const clients = {};
  clientsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const name = data.companyName?.toLowerCase();
    if (name === 'ypf') {
      clients.ypf = { id: doc.id, name: data.companyName };
    } else if (name === 'rda') {
      clients.rda = { id: doc.id, name: data.companyName };
    }
  });
  
  if (!clients.ypf || !clients.rda) {
    console.error('❌ Error: No se encontraron los clientes YPF y RDA');
    console.log(`   Clientes encontrados: ${clientsSnapshot.docs.map(d => d.data().companyName).join(', ')}`);
    process.exit(1);
  }
  
  console.log(`✅ Cliente YPF encontrado: ${clients.ypf.name} (ID: ${clients.ypf.id})`);
  console.log(`✅ Cliente RDA encontrado: ${clients.rda.name} (ID: ${clients.rda.id})`);
  console.log('');
  
  // Crear backup si se solicita
  if (shouldBackup && !isDryRun) {
    console.log('💾 Creando backup...\n');
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-before-assign-${tenantId}-${mainCompanyId}-${timestamp}.json`);
    
    const collections = ['uploadedDocuments', 'approvedDocuments', 'requiredDocuments', 'personal', 'vehiculos'];
    const backupData = { timestamp: new Date().toISOString(), tenantId, mainCompanyId, data: {} };
    
    for (const collectionName of collections) {
      const collectionPath = getTenantPath(collectionName);
      const query = db.collection(collectionPath).where('companyId', '==', mainCompanyId);
      const snapshot = await query.get();
      backupData.data[collectionName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`✅ Backup creado: ${backupFile}`);
    console.log('');
  }
  
  console.log('📥 Obteniendo datos de la empresa...\n');
  
  // 2. Obtener documentos subidos
  const uploadedPath = getTenantPath('uploadedDocuments');
  const uploadedQuery = db.collection(uploadedPath)
    .where('companyId', '==', mainCompanyId);
  const uploadedSnapshot = await uploadedQuery.get();
  const uploadedDocs = uploadedSnapshot.docs.map(doc => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data()
  }));
  console.log(`   📤 Documentos subidos: ${uploadedDocs.length}`);
  
  // 3. Obtener documentos aprobados
  const approvedPath = getTenantPath('approvedDocuments');
  const approvedQuery = db.collection(approvedPath)
    .where('companyId', '==', mainCompanyId);
  const approvedSnapshot = await approvedQuery.get();
  const approvedDocs = approvedSnapshot.docs.map(doc => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data()
  }));
  console.log(`   ✅ Documentos aprobados: ${approvedDocs.length}`);
  
  // 4. Obtener documentos requeridos
  const requiredPath = getTenantPath('requiredDocuments');
  const requiredQuery = db.collection(requiredPath)
    .where('companyId', '==', mainCompanyId);
  const requiredSnapshot = await requiredQuery.get();
  const requiredDocs = requiredSnapshot.docs.map(doc => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data()
  }));
  console.log(`   📋 Documentos requeridos: ${requiredDocs.length}`);
  
  // 5. Obtener empleados
  const personalPath = getTenantPath('personal');
  const personalQuery = db.collection(personalPath)
    .where('companyId', '==', mainCompanyId);
  const personalSnapshot = await personalQuery.get();
  const personalDocs = personalSnapshot.docs.map(doc => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data()
  }));
  console.log(`   👥 Empleados: ${personalDocs.length}`);
  
  // 6. Obtener vehículos
  const vehiculosPath = getTenantPath('vehiculos');
  const vehiculosQuery = db.collection(vehiculosPath)
    .where('companyId', '==', mainCompanyId);
  const vehiculosSnapshot = await vehiculosQuery.get();
  const vehiculosDocs = vehiculosSnapshot.docs.map(doc => ({
    id: doc.id,
    ref: doc.ref,
    data: doc.data()
  }));
  console.log(`   🚗 Vehículos: ${vehiculosDocs.length}`);
  
  console.log('');
  
  if (isDryRun) {
    console.log('🔍 MODO DRY-RUN: Analizando asignaciones...\n');
  }
  
  // Analizar y asignar documentos
  const assignments = {
    ypf: { uploaded: [], approved: [], required: [] },
    rda: { uploaded: [], approved: [], required: [] },
    personal: [],
    vehiculos: []
  };
  
  // Documentos subidos
  for (const doc of uploadedDocs) {
    const docName = doc.data.name || '';
    const clientId = determineClientByName(docName, clients.ypf.id, clients.rda.id);
    const clientName = clientId === clients.ypf.id ? 'YPF' : 'RDA';
    
    if (clientId === clients.ypf.id) {
      assignments.ypf.uploaded.push({ id: doc.id, name: docName });
    } else {
      assignments.rda.uploaded.push({ id: doc.id, name: docName });
    }
  }
  
  // Documentos aprobados
  for (const doc of approvedDocs) {
    const docName = doc.data.name || '';
    const clientId = determineClientByName(docName, clients.ypf.id, clients.rda.id);
    const clientName = clientId === clients.ypf.id ? 'YPF' : 'RDA';
    
    if (clientId === clients.ypf.id) {
      assignments.ypf.approved.push({ id: doc.id, name: docName });
    } else {
      assignments.rda.approved.push({ id: doc.id, name: docName });
    }
  }
  
  // Documentos requeridos
  for (const doc of requiredDocs) {
    const docName = doc.data.name || '';
    const clientId = determineClientByName(docName, clients.ypf.id, clients.rda.id);
    
    if (clientId === clients.ypf.id) {
      assignments.ypf.required.push({ id: doc.id, name: docName });
    } else {
      assignments.rda.required.push({ id: doc.id, name: docName });
    }
  }
  
  // Empleados y vehículos van a RDA
  assignments.rda.personal = personalDocs.map(doc => ({ id: doc.id, name: doc.data.nombre || doc.id }));
  assignments.rda.vehiculos = vehiculosDocs.map(doc => ({ id: doc.id, name: doc.id }));
  
  // Mostrar resumen de asignaciones
  console.log('📊 RESUMEN DE ASIGNACIONES:');
  console.log('');
  console.log(`🟦 CLIENTE YPF (${clients.ypf.id}):`);
  console.log(`   📤 Documentos subidos: ${assignments.ypf.uploaded.length}`);
  console.log(`   ✅ Documentos aprobados: ${assignments.ypf.approved.length}`);
  console.log(`   📋 Documentos requeridos: ${assignments.ypf.required.length}`);
  if (assignments.ypf.uploaded.length > 0) {
    console.log(`   📄 Ejemplos de documentos subidos:`);
    assignments.ypf.uploaded.slice(0, 3).forEach(doc => {
      console.log(`      - ${doc.name.substring(0, 60)}`);
    });
  }
  console.log('');
  
  console.log(`🟩 CLIENTE RDA (${clients.rda.id}):`);
  console.log(`   📤 Documentos subidos: ${assignments.rda.uploaded.length}`);
  console.log(`   ✅ Documentos aprobados: ${assignments.rda.approved.length}`);
  console.log(`   📋 Documentos requeridos: ${assignments.rda.required.length}`);
  console.log(`   👥 Empleados: ${assignments.rda.personal.length}`);
  console.log(`   🚗 Vehículos: ${assignments.rda.vehiculos.length}`);
  if (assignments.rda.uploaded.length > 0) {
    console.log(`   📄 Ejemplos de documentos subidos:`);
    assignments.rda.uploaded.slice(0, 3).forEach(doc => {
      console.log(`      - ${doc.name.substring(0, 60)}`);
    });
  }
  console.log('');
  
  if (isDryRun) {
    console.log('💡 Para ejecutar la asignación real, ejecuta el script sin --dry-run');
    console.log('');
    return;
  }
  
  // Ejecutar asignaciones
  console.log('⚡ Ejecutando asignaciones...\n');
  
  let totalUpdated = 0;
  
  // Actualizar documentos subidos
  if (uploadedDocs.length > 0) {
    console.log('📤 Asignando documentos subidos...');
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of uploadedDocs) {
      const docName = doc.data.name || '';
      const clientId = determineClientByName(docName, clients.ypf.id, clients.rda.id);
      
      // Solo actualizar si no tiene clientId o es diferente
      if (!doc.data.clientId || doc.data.clientId !== clientId) {
        batch.update(doc.ref, { clientId });
        batchCount++;
        totalUpdated++;
        
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✅ Lote de ${batchCount} documentos actualizado`);
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Lote final de ${batchCount} documentos actualizado`);
    }
    console.log(`   ✅ ${totalUpdated} documentos subidos asignados`);
    totalUpdated = 0;
  }
  
  // Actualizar documentos aprobados
  if (approvedDocs.length > 0) {
    console.log('✅ Asignando documentos aprobados...');
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of approvedDocs) {
      const docName = doc.data.name || '';
      const clientId = determineClientByName(docName, clients.ypf.id, clients.rda.id);
      
      if (!doc.data.clientId || doc.data.clientId !== clientId) {
        batch.update(doc.ref, { clientId });
        batchCount++;
        totalUpdated++;
        
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✅ Lote de ${batchCount} documentos actualizado`);
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Lote final de ${batchCount} documentos actualizado`);
    }
    console.log(`   ✅ ${totalUpdated} documentos aprobados asignados`);
    totalUpdated = 0;
  }
  
  // Actualizar documentos requeridos (appliesTo.clients)
  if (requiredDocs.length > 0) {
    console.log('📋 Actualizando documentos requeridos...');
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of requiredDocs) {
      const docName = doc.data.name || '';
      const clientId = determineClientByName(docName, clients.ypf.id, clients.rda.id);
      
      const currentAppliesTo = doc.data.appliesTo || { main: true, clients: null };
      let newClients = Array.isArray(currentAppliesTo.clients) ? [...currentAppliesTo.clients] : [];
      
      // Agregar el cliente si no está ya incluido
      if (!newClients.includes(clientId)) {
        newClients.push(clientId);
      }
      
      // Si el documento está asignado a un cliente, poner main=false
      // (solo debe aparecer en el cliente, no en la empresa principal)
      batch.update(doc.ref, {
        appliesTo: {
          main: false, // Cambiar a false cuando está asignado a clientes
          clients: newClients
        }
      });
      batchCount++;
      totalUpdated++;
      
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`   ✅ Lote de ${batchCount} documentos actualizado`);
        batchCount = 0;
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Lote final de ${batchCount} documentos actualizado`);
    }
    console.log(`   ✅ ${totalUpdated} documentos requeridos actualizados`);
    totalUpdated = 0;
  }
  
  // Asignar empleados a RDA
  if (personalDocs.length > 0) {
    console.log('👥 Asignando empleados a RDA...');
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of personalDocs) {
      if (!doc.data.clientId || doc.data.clientId !== clients.rda.id) {
        batch.update(doc.ref, { clientId: clients.rda.id });
        batchCount++;
        totalUpdated++;
        
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✅ Lote de ${batchCount} empleados actualizado`);
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Lote final de ${batchCount} empleados actualizado`);
    }
    console.log(`   ✅ ${totalUpdated} empleados asignados a RDA`);
    totalUpdated = 0;
  }
  
  // Asignar vehículos a RDA
  if (vehiculosDocs.length > 0) {
    console.log('🚗 Asignando vehículos a RDA...');
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of vehiculosDocs) {
      if (!doc.data.clientId || doc.data.clientId !== clients.rda.id) {
        batch.update(doc.ref, { clientId: clients.rda.id });
        batchCount++;
        totalUpdated++;
        
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✅ Lote de ${batchCount} vehículos actualizado`);
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✅ Lote final de ${batchCount} vehículos actualizado`);
    }
    console.log(`   ✅ ${totalUpdated} vehículos asignados a RDA`);
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ ASIGNACIÓN COMPLETADA');
  console.log('='.repeat(80));
  console.log(`   🟦 YPF: ${assignments.ypf.uploaded.length} subidos, ${assignments.ypf.approved.length} aprobados, ${assignments.ypf.required.length} requeridos`);
  console.log(`   🟩 RDA: ${assignments.rda.uploaded.length} subidos, ${assignments.rda.approved.length} aprobados, ${assignments.rda.required.length} requeridos, ${assignments.rda.personal.length} empleados, ${assignments.rda.vehiculos.length} vehículos`);
  console.log('='.repeat(80));
  console.log('');
}

assignDocumentsToClients()
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

