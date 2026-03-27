#!/usr/bin/env node

/**
 * Script para analizar datos de una empresa antes de migrar a cliente
 * 
 * Uso: node analyzeCompanyData.js [tenantId] [mainCompanyId]
 * 
 * Este script muestra:
 * - Clientes existentes
 * - Documentos requeridos
 * - Documentos subidos (uploadedDocuments)
 * - Documentos aprobados (approvedDocuments)
 * - Empleados (personal)
 * - Vehículos (vehiculos)
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
const DEFAULT_MAIN_COMPANY_ID = '30708512547'; // SegPro srl

const args = process.argv.slice(2);
const regularArgs = args.filter(arg => !arg.startsWith('--'));

const [tenantIdArg, mainCompanyIdArg] = regularArgs;
const tenantId = tenantIdArg || DEFAULT_TENANT_ID;
const mainCompanyId = mainCompanyIdArg || DEFAULT_MAIN_COMPANY_ID;

console.log('📝 Configuración:');
console.log(`   Tenant ID: ${tenantId} ${tenantIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Empresa principal: ${mainCompanyId} ${mainCompanyIdArg ? '(parámetro)' : '(default)'}`);
console.log('');

const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

async function analyzeCompanyData() {
  console.log('🔍 Analizando datos de la empresa...\n');
  
  // 1. Clientes
  const companiesPath = getTenantPath('companies');
  const clientsQuery = db.collection(companiesPath)
    .where('parentCompanyId', '==', mainCompanyId)
    .where('type', '==', 'client');
  
  const clientsSnapshot = await clientsQuery.get();
  const clients = clientsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log('='.repeat(80));
  console.log('👥 CLIENTES');
  console.log('='.repeat(80));
  console.log(`   Total: ${clients.length}`);
  if (clients.length > 0) {
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.companyName || client.name || 'Sin nombre'} (ID: ${client.id})`);
      console.log(`      Estado: ${client.status || 'N/A'}`);
    });
  } else {
    console.log('   ⚠️  No hay clientes creados aún');
  }
  console.log('');
  
  // 2. Documentos requeridos
  const requiredPath = getTenantPath('requiredDocuments');
  const requiredQuery = db.collection(requiredPath)
    .where('companyId', '==', mainCompanyId);
  
  const requiredSnapshot = await requiredQuery.get();
  const requiredDocs = requiredSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const requiredWithClients = requiredDocs.filter(doc => {
    const appliesTo = doc.appliesTo || {};
    return Array.isArray(appliesTo.clients) && appliesTo.clients.length > 0;
  });
  
  const requiredOnlyMain = requiredDocs.filter(doc => {
    const appliesTo = doc.appliesTo || {};
    return (!appliesTo.clients || (Array.isArray(appliesTo.clients) && appliesTo.clients.length === 0));
  });
  
  console.log('='.repeat(80));
  console.log('📋 DOCUMENTOS REQUERIDOS');
  console.log('='.repeat(80));
  console.log(`   Total: ${requiredDocs.length}`);
  console.log(`   - Asignados a clientes: ${requiredWithClients.length}`);
  console.log(`   - Solo empresa principal: ${requiredOnlyMain.length}`);
  console.log('');
  
  // 3. Documentos subidos (uploadedDocuments)
  const uploadedPath = getTenantPath('uploadedDocuments');
  const uploadedQuery = db.collection(uploadedPath)
    .where('companyId', '==', mainCompanyId);
  
  const uploadedSnapshot = await uploadedQuery.get();
  const uploadedDocs = uploadedSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const uploadedWithoutClient = uploadedDocs.filter(doc => !doc.clientId);
  const uploadedWithClient = uploadedDocs.filter(doc => doc.clientId);
  
  console.log('='.repeat(80));
  console.log('📤 DOCUMENTOS SUBIDOS (uploadedDocuments)');
  console.log('='.repeat(80));
  console.log(`   Total: ${uploadedDocs.length}`);
  console.log(`   - Sin clientId (disponibles para migrar): ${uploadedWithoutClient.length}`);
  console.log(`   - Con clientId (ya migrados): ${uploadedWithClient.length}`);
  
  if (uploadedWithoutClient.length > 0 && uploadedWithoutClient.length <= 10) {
    console.log('\n   Ejemplos de documentos sin clientId:');
    uploadedWithoutClient.slice(0, 5).forEach((doc, index) => {
      console.log(`      ${index + 1}. ${doc.fileName || doc.name || 'Sin nombre'} (ID: ${doc.id})`);
      console.log(`         Tipo: ${doc.entityType || 'N/A'}, Estado: ${doc.status || 'N/A'}`);
    });
  }
  console.log('');
  
  // 4. Documentos aprobados (approvedDocuments)
  const approvedPath = getTenantPath('approvedDocuments');
  const approvedQuery = db.collection(approvedPath)
    .where('companyId', '==', mainCompanyId);
  
  const approvedSnapshot = await approvedQuery.get();
  const approvedDocs = approvedSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const approvedWithoutClient = approvedDocs.filter(doc => !doc.clientId);
  const approvedWithClient = approvedDocs.filter(doc => doc.clientId);
  
  console.log('='.repeat(80));
  console.log('✅ DOCUMENTOS APROBADOS (approvedDocuments)');
  console.log('='.repeat(80));
  console.log(`   Total: ${approvedDocs.length}`);
  console.log(`   - Sin clientId (disponibles para migrar): ${approvedWithoutClient.length}`);
  console.log(`   - Con clientId (ya migrados): ${approvedWithClient.length}`);
  
  if (approvedWithoutClient.length > 0 && approvedWithoutClient.length <= 10) {
    console.log('\n   Ejemplos de documentos sin clientId:');
    approvedWithoutClient.slice(0, 5).forEach((doc, index) => {
      console.log(`      ${index + 1}. ${doc.fileName || doc.name || 'Sin nombre'} (ID: ${doc.id})`);
      console.log(`         Tipo: ${doc.entityType || 'N/A'}, Estado: ${doc.status || 'N/A'}`);
    });
  }
  console.log('');
  
  // 5. Empleados (personal)
  const personalPath = getTenantPath('personal');
  const personalQuery = db.collection(personalPath)
    .where('companyId', '==', mainCompanyId);
  
  const personalSnapshot = await personalQuery.get();
  const personalDocs = personalSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const personalWithoutClient = personalDocs.filter(doc => !doc.clientId);
  const personalWithClient = personalDocs.filter(doc => doc.clientId);
  
  console.log('='.repeat(80));
  console.log('👥 EMPLEADOS (personal)');
  console.log('='.repeat(80));
  console.log(`   Total: ${personalDocs.length}`);
  console.log(`   - Sin clientId (disponibles para migrar): ${personalWithoutClient.length}`);
  console.log(`   - Con clientId (ya migrados): ${personalWithClient.length}`);
  
  if (personalWithoutClient.length > 0 && personalWithoutClient.length <= 10) {
    console.log('\n   Ejemplos de empleados sin clientId:');
    personalWithoutClient.slice(0, 5).forEach((doc, index) => {
      const nombre = doc.nombre || doc.name || 'Sin nombre';
      const dni = doc.dni || 'N/A';
      console.log(`      ${index + 1}. ${nombre} (DNI: ${dni})`);
    });
  }
  console.log('');
  
  // 6. Vehículos (vehiculos)
  const vehiculosPath = getTenantPath('vehiculos');
  const vehiculosQuery = db.collection(vehiculosPath)
    .where('companyId', '==', mainCompanyId);
  
  const vehiculosSnapshot = await vehiculosQuery.get();
  const vehiculosDocs = vehiculosSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const vehiculosWithoutClient = vehiculosDocs.filter(doc => !doc.clientId);
  const vehiculosWithClient = vehiculosDocs.filter(doc => doc.clientId);
  
  console.log('='.repeat(80));
  console.log('🚗 VEHÍCULOS (vehiculos)');
  console.log('='.repeat(80));
  console.log(`   Total: ${vehiculosDocs.length}`);
  console.log(`   - Sin clientId (disponibles para migrar): ${vehiculosWithoutClient.length}`);
  console.log(`   - Con clientId (ya migrados): ${vehiculosWithClient.length}`);
  
  if (vehiculosWithoutClient.length > 0 && vehiculosWithoutClient.length <= 10) {
    console.log('\n   Ejemplos de vehículos sin clientId:');
    vehiculosWithoutClient.slice(0, 5).forEach((doc, index) => {
      const patente = doc.patente || doc.plate || 'N/A';
      const marca = doc.marca || doc.brand || 'N/A';
      console.log(`      ${index + 1}. ${marca} - Patente: ${patente}`);
    });
  }
  console.log('');
  
  // Resumen final
  console.log('='.repeat(80));
  console.log('📊 RESUMEN PARA MIGRACIÓN');
  console.log('='.repeat(80));
  console.log(`   📋 Documentos requeridos a actualizar: ${requiredOnlyMain.length}`);
  console.log(`   📤 Documentos subidos a migrar: ${uploadedWithoutClient.length}`);
  console.log(`   ✅ Documentos aprobados a migrar: ${approvedWithoutClient.length}`);
  console.log(`   👥 Empleados a migrar: ${personalWithoutClient.length}`);
  console.log(`   🚗 Vehículos a migrar: ${vehiculosWithoutClient.length}`);
  console.log('');
  
  if (clients.length === 0) {
    console.log('⚠️  IMPORTANTE: No hay clientes creados aún.');
    console.log('   Primero debes crear el cliente desde el dashboard antes de migrar datos.');
  } else {
    console.log('✅ Hay clientes disponibles. Puedes ejecutar el script de migración.');
    console.log('   Ejemplo: node migrateDocumentsToClient.js --dry-run hise 30708512547 [nombre-cliente]');
  }
  console.log('');
}

analyzeCompanyData()
  .then(() => {
    console.log('✅ Análisis completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });


