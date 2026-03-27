#!/usr/bin/env node

/**
 * Script para crear backup de datos antes de migración
 * 
 * Uso: node createBackupOnly.js [tenantId] [mainCompanyId]
 * 
 * Este script crea un backup de todos los datos que podrían migrarse:
 * - Documentos subidos (uploadedDocuments)
 * - Documentos aprobados (approvedDocuments)
 * - Documentos requeridos (requiredDocuments)
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

console.log('📝 Configuración de backup:');
console.log(`   Tenant ID: ${tenantId} ${tenantIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Empresa principal: ${mainCompanyId} ${mainCompanyIdArg ? '(parámetro)' : '(default)'}`);
console.log('');

const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

async function createBackupOnly() {
  console.log('💾 Iniciando creación de backup...\n');
  
  // Crear directorio de backups si no existe
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('📁 Directorio de backups creado');
  }
  
  console.log('📥 Obteniendo datos de la empresa...\n');
  
  // 1. Documentos subidos
  const uploadedPath = getTenantPath('uploadedDocuments');
  const uploadedQuery = db.collection(uploadedPath)
    .where('companyId', '==', mainCompanyId);
  const uploadedSnapshot = await uploadedQuery.get();
  const uploadedDocs = uploadedSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  console.log(`   📤 Documentos subidos: ${uploadedDocs.length}`);
  
  // 2. Documentos aprobados
  const approvedPath = getTenantPath('approvedDocuments');
  const approvedQuery = db.collection(approvedPath)
    .where('companyId', '==', mainCompanyId);
  const approvedSnapshot = await approvedQuery.get();
  const approvedDocs = approvedSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  console.log(`   ✅ Documentos aprobados: ${approvedDocs.length}`);
  
  // 3. Documentos requeridos
  const requiredPath = getTenantPath('requiredDocuments');
  const requiredQuery = db.collection(requiredPath)
    .where('companyId', '==', mainCompanyId);
  const requiredSnapshot = await requiredQuery.get();
  const requiredDocs = requiredSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  console.log(`   📋 Documentos requeridos: ${requiredDocs.length}`);
  
  // 4. Empleados
  const personalPath = getTenantPath('personal');
  const personalQuery = db.collection(personalPath)
    .where('companyId', '==', mainCompanyId);
  const personalSnapshot = await personalQuery.get();
  const personalDocs = personalSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  console.log(`   👥 Empleados: ${personalDocs.length}`);
  
  // 5. Vehículos
  const vehiculosPath = getTenantPath('vehiculos');
  const vehiculosQuery = db.collection(vehiculosPath)
    .where('companyId', '==', mainCompanyId);
  const vehiculosSnapshot = await vehiculosQuery.get();
  const vehiculosDocs = vehiculosSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  console.log(`   🚗 Vehículos: ${vehiculosDocs.length}`);
  
  // Crear archivo de backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${tenantId}-${mainCompanyId}-${timestamp}.json`);
  
  const backupData = {
    timestamp: new Date().toISOString(),
    tenantId,
    mainCompanyId,
    summary: {
      uploadedDocuments: uploadedDocs.length,
      approvedDocuments: approvedDocs.length,
      requiredDocuments: requiredDocs.length,
      personal: personalDocs.length,
      vehiculos: vehiculosDocs.length
    },
    data: {
      uploadedDocuments: uploadedDocs,
      approvedDocuments: approvedDocs,
      requiredDocuments: requiredDocs,
      personal: personalDocs,
      vehiculos: vehiculosDocs
    }
  };
  
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  
  const fileSize = (fs.statSync(backupFile).size / 1024).toFixed(2);
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ BACKUP CREADO EXITOSAMENTE');
  console.log('='.repeat(80));
  console.log(`   📁 Archivo: ${backupFile}`);
  console.log(`   📊 Tamaño: ${fileSize} KB`);
  console.log(`   📤 Documentos subidos: ${uploadedDocs.length}`);
  console.log(`   ✅ Documentos aprobados: ${approvedDocs.length}`);
  console.log(`   📋 Documentos requeridos: ${requiredDocs.length}`);
  console.log(`   👥 Empleados: ${personalDocs.length}`);
  console.log(`   🚗 Vehículos: ${vehiculosDocs.length}`);
  console.log('='.repeat(80));
  console.log('');
}

createBackupOnly()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });


