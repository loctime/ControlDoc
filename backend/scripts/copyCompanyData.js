#!/usr/bin/env node

/**
 * Script para copiar todos los datos de una empresa a otra
 * 
 * Uso: node copyCompanyData.js [tenantId] [sourceCompanyId] [targetCompanyId] [--dry-run] [--backup]
 * 
 * Copia:
 * - Documentos requeridos (requiredDocuments)
 * - Documentos subidos (uploadedDocuments)
 * - Documentos aprobados (approvedDocuments)
 * - Empleados (personal)
 * - Vehículos (vehiculos)
 * 
 * Ejemplo: node copyCompanyData.js hise 30708512547 22222222222 --dry-run
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
const DEFAULT_SOURCE_COMPANY_ID = '30708512547'; // SegPro srl
const DEFAULT_TARGET_COMPANY_ID = '22222222222';

const args = process.argv.slice(2);
const regularArgs = args.filter(arg => !arg.startsWith('--'));
const flags = args.filter(arg => arg.startsWith('--'));

const [tenantIdArg, sourceCompanyIdArg, targetCompanyIdArg] = regularArgs;
const tenantId = tenantIdArg || DEFAULT_TENANT_ID;
const sourceCompanyId = sourceCompanyIdArg || DEFAULT_SOURCE_COMPANY_ID;
const targetCompanyId = targetCompanyIdArg || DEFAULT_TARGET_COMPANY_ID;
const isDryRun = flags.includes('--dry-run');
const shouldBackup = flags.includes('--backup');

if (sourceCompanyId === targetCompanyId) {
  console.error('❌ Error: El ID de origen y destino no pueden ser iguales');
  process.exit(1);
}

console.log('📝 Configuración:');
console.log(`   Tenant ID: ${tenantId} ${tenantIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Empresa origen: ${sourceCompanyId} ${sourceCompanyIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Empresa destino: ${targetCompanyId} ${targetCompanyIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Modo dry-run: ${isDryRun ? 'Sí (no se guardarán cambios)' : 'No (se guardarán cambios)'}`);
console.log(`   Backup: ${shouldBackup ? 'Sí' : 'No'}`);
console.log('');

const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

async function copyCompanyData() {
  console.log('🔍 Verificando empresas...\n');
  
  // Verificar que la empresa origen exista
  const companiesPath = getTenantPath('companies');
  const sourceCompanyRef = db.collection(companiesPath).doc(sourceCompanyId);
  const sourceCompanyDoc = await sourceCompanyRef.get();
  
  if (!sourceCompanyDoc.exists) {
    console.error(`❌ Error: La empresa origen "${sourceCompanyId}" no existe`);
    process.exit(1);
  }
  
  const sourceCompanyData = sourceCompanyDoc.data();
  console.log(`✅ Empresa origen encontrada: "${sourceCompanyData.companyName || sourceCompanyId}"`);
  
  // Verificar que la empresa destino exista
  const targetCompanyRef = db.collection(companiesPath).doc(targetCompanyId);
  const targetCompanyDoc = await targetCompanyRef.get();
  
  if (!targetCompanyDoc.exists) {
    console.error(`❌ Error: La empresa destino "${targetCompanyId}" no existe`);
    console.log('   Sugerencia: Crea primero la empresa destino o verifica el ID');
    process.exit(1);
  }
  
  const targetCompanyData = targetCompanyDoc.data();
  console.log(`✅ Empresa destino encontrada: "${targetCompanyData.companyName || targetCompanyId}"`);
  console.log('');
  
  // Crear backup si se solicita
  if (shouldBackup && !isDryRun) {
    console.log('💾 Creando backup de datos destino...\n');
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-before-copy-${tenantId}-${targetCompanyId}-${timestamp}.json`);
    
    // Obtener datos actuales de la empresa destino
    const collections = ['requiredDocuments', 'uploadedDocuments', 'approvedDocuments', 'personal', 'vehiculos'];
    const backupData = { timestamp: new Date().toISOString(), tenantId, targetCompanyId, data: {} };
    
    for (const collectionName of collections) {
      const collectionPath = getTenantPath(collectionName);
      const query = db.collection(collectionPath).where('companyId', '==', targetCompanyId);
      const snapshot = await query.get();
      backupData.data[collectionName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`✅ Backup creado: ${backupFile}`);
    console.log('');
  }
  
  console.log('📥 Obteniendo datos de la empresa origen...\n');
  
  // 1. Documentos requeridos
  const requiredPath = getTenantPath('requiredDocuments');
  const requiredQuery = db.collection(requiredPath)
    .where('companyId', '==', sourceCompanyId);
  const requiredSnapshot = await requiredQuery.get();
  const requiredDocs = requiredSnapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data()
  }));
  console.log(`   📋 Documentos requeridos: ${requiredDocs.length}`);
  
  // 2. Documentos subidos
  const uploadedPath = getTenantPath('uploadedDocuments');
  const uploadedQuery = db.collection(uploadedPath)
    .where('companyId', '==', sourceCompanyId);
  const uploadedSnapshot = await uploadedQuery.get();
  const uploadedDocs = uploadedSnapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data()
  }));
  console.log(`   📤 Documentos subidos: ${uploadedDocs.length}`);
  
  // 3. Documentos aprobados
  const approvedPath = getTenantPath('approvedDocuments');
  const approvedQuery = db.collection(approvedPath)
    .where('companyId', '==', sourceCompanyId);
  const approvedSnapshot = await approvedQuery.get();
  const approvedDocs = approvedSnapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data()
  }));
  console.log(`   ✅ Documentos aprobados: ${approvedDocs.length}`);
  
  // 4. Empleados
  const personalPath = getTenantPath('personal');
  const personalQuery = db.collection(personalPath)
    .where('companyId', '==', sourceCompanyId);
  const personalSnapshot = await personalQuery.get();
  const personalDocs = personalSnapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data()
  }));
  console.log(`   👥 Empleados: ${personalDocs.length}`);
  
  // 5. Vehículos
  const vehiculosPath = getTenantPath('vehiculos');
  const vehiculosQuery = db.collection(vehiculosPath)
    .where('companyId', '==', sourceCompanyId);
  const vehiculosSnapshot = await vehiculosQuery.get();
  const vehiculosDocs = vehiculosSnapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data()
  }));
  console.log(`   🚗 Vehículos: ${vehiculosDocs.length}`);
  
  console.log('');
  
  if (isDryRun) {
    console.log('🔍 MODO DRY-RUN: No se guardarán cambios\n');
  }
  
  // Función auxiliar para limpiar datos antes de copiar
  const cleanDataForCopy = (data, collectionName) => {
    const cleaned = { ...data };
    
    // Remover campos que no deben copiarse
    delete cleaned.id;
    
    // Actualizar companyId
    cleaned.companyId = targetCompanyId;
    
    // Actualizar timestamps
    cleaned.createdAt = admin.firestore.FieldValue.serverTimestamp();
    if (cleaned.uploadedAt) {
      cleaned.uploadedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    if (cleaned.aprobadoAt) {
      cleaned.aprobadoAt = admin.firestore.FieldValue.serverTimestamp();
    }
    if (cleaned.updatedAt) {
      cleaned.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    // Para documentos requeridos, ajustar appliesTo si es necesario
    if (collectionName === 'requiredDocuments' && cleaned.appliesTo) {
      // Mantener la estructura pero asegurar que aplica a la empresa principal
      cleaned.appliesTo = {
        main: true,
        clients: null // Por defecto aplica a todos los clientes (si los hay)
      };
    }
    
    // Para documentos subidos/aprobados, limpiar clientId si existe
    if (cleaned.clientId) {
      cleaned.clientId = null; // Los documentos copiados no tienen cliente asignado inicialmente
    }
    
    return cleaned;
  };
  
  // Procesar cada colección
  const collections = [
    { name: 'requiredDocuments', path: requiredPath, docs: requiredDocs, label: 'Documentos requeridos' },
    { name: 'uploadedDocuments', path: uploadedPath, docs: uploadedDocs, label: 'Documentos subidos' },
    { name: 'approvedDocuments', path: approvedPath, docs: approvedDocs, label: 'Documentos aprobados' },
    { name: 'personal', path: personalPath, docs: personalDocs, label: 'Empleados' },
    { name: 'vehiculos', path: vehiculosPath, docs: vehiculosDocs, label: 'Vehículos' }
  ];
  
  let totalCopied = 0;
  let totalSkipped = 0;
  
  for (const collection of collections) {
    if (collection.docs.length === 0) {
      console.log(`⏭️  ${collection.label}: 0 (sin datos para copiar)`);
      continue;
    }
    
    console.log(`📝 Copiando ${collection.label}...`);
    
    if (!isDryRun) {
      const batch = db.batch();
      let batchCount = 0;
      
      for (const docItem of collection.docs) {
        const cleanedData = cleanDataForCopy(docItem.data, collection.name);
        const newDocRef = db.collection(collection.path).doc();
        batch.set(newDocRef, cleanedData);
        batchCount++;
        totalCopied++;
        
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✅ Lote de ${batchCount} documentos guardado`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Lote final de ${batchCount} documentos guardado`);
      }
      
      console.log(`   ✅ ${collection.docs.length} ${collection.label.toLowerCase()} copiados`);
    } else {
      // En dry-run, solo mostrar ejemplos
      const examples = collection.docs.slice(0, 2);
      console.log(`   📋 Se copiarían ${collection.docs.length} documentos`);
      if (examples.length > 0) {
        console.log(`   📄 Ejemplo 1: ${examples[0].data.name || examples[0].data.nombre || examples[0].id}`);
        if (examples.length > 1) {
          console.log(`   📄 Ejemplo 2: ${examples[1].data.name || examples[1].data.nombre || examples[1].id}`);
        }
      }
      totalCopied += collection.docs.length;
    }
    console.log('');
  }
  
  console.log('='.repeat(80));
  if (isDryRun) {
    console.log('🔍 RESUMEN DRY-RUN');
  } else {
    console.log('✅ COPIA COMPLETADA');
  }
  console.log('='.repeat(80));
  console.log(`   📋 Documentos requeridos: ${requiredDocs.length}`);
  console.log(`   📤 Documentos subidos: ${uploadedDocs.length}`);
  console.log(`   ✅ Documentos aprobados: ${approvedDocs.length}`);
  console.log(`   👥 Empleados: ${personalDocs.length}`);
  console.log(`   🚗 Vehículos: ${vehiculosDocs.length}`);
  console.log(`   📊 Total copiado: ${totalCopied}`);
  console.log('='.repeat(80));
  console.log('');
  
  if (isDryRun) {
    console.log('💡 Para ejecutar la copia real, ejecuta el script sin --dry-run');
    console.log('');
  }
}

copyCompanyData()
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

