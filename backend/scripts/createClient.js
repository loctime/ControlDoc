#!/usr/bin/env node

/**
 * Script para crear un cliente (subempresa) para una empresa principal
 * 
 * Uso: node createClient.js [tenantId] [mainCompanyId] [clientName] [--approve]
 * 
 * Ejemplo: node createClient.js hise 30708512547 "YPF" --approve
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
const flags = args.filter(arg => arg.startsWith('--'));

const [tenantIdArg, mainCompanyIdArg, clientNameArg] = regularArgs;
const tenantId = tenantIdArg || DEFAULT_TENANT_ID;
const mainCompanyId = mainCompanyIdArg || DEFAULT_MAIN_COMPANY_ID;
const clientName = clientNameArg;
const shouldApprove = flags.includes('--approve');

if (!clientName) {
  console.error('❌ Error: Debes proporcionar el nombre del cliente');
  console.log('');
  console.log('Uso: node createClient.js [tenantId] [mainCompanyId] [clientName] [--approve]');
  console.log('');
  console.log('Ejemplo:');
  console.log('  node createClient.js hise 30708512547 "YPF" --approve');
  console.log('');
  process.exit(1);
}

console.log('📝 Configuración:');
console.log(`   Tenant ID: ${tenantId} ${tenantIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Empresa principal: ${mainCompanyId} ${mainCompanyIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Nombre del cliente: ${clientName}`);
console.log(`   Aprobar automáticamente: ${shouldApprove ? 'Sí' : 'No'}`);
console.log('');

const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

async function createClient() {
  console.log('🔍 Validando empresa principal...\n');
  
  // 1. Validar que la empresa padre exista
  const companiesPath = getTenantPath('companies');
  const parentCompanyRef = db.collection(companiesPath).doc(mainCompanyId);
  const parentCompanyDoc = await parentCompanyRef.get();
  
  if (!parentCompanyDoc.exists) {
    console.error(`❌ Error: La empresa principal con ID "${mainCompanyId}" no existe`);
    process.exit(1);
  }
  
  const parentData = parentCompanyDoc.data();
  
  // 2. Validar que la empresa padre sea del tipo "main"
  if (parentData.type !== 'main') {
    console.error(`❌ Error: La empresa "${mainCompanyId}" no es una empresa principal (tipo: ${parentData.type})`);
    process.exit(1);
  }
  
  console.log(`✅ Empresa principal encontrada: "${parentData.companyName || mainCompanyId}"`);
  console.log('');
  
  // 3. Verificar que no exista un cliente con el mismo nombre
  console.log('🔍 Verificando si ya existe un cliente con ese nombre...\n');
  const existingQuery = db.collection(companiesPath)
    .where('parentCompanyId', '==', mainCompanyId)
    .where('companyName', '==', clientName);
  
  const existingSnapshot = await existingQuery.get();
  
  if (!existingSnapshot.empty) {
    const existingClient = existingSnapshot.docs[0].data();
    console.error(`❌ Error: Ya existe un cliente con el nombre "${clientName}"`);
    console.log(`   ID del cliente existente: ${existingSnapshot.docs[0].id}`);
    console.log(`   Estado: ${existingClient.status || 'N/A'}`);
    process.exit(1);
  }
  
  console.log(`✅ No existe un cliente con el nombre "${clientName}"`);
  console.log('');
  
  // 4. Crear el cliente
  console.log('📝 Creando cliente...\n');
  
  const newClient = {
    companyName: clientName,
    parentCompanyId: mainCompanyId,
    type: 'client',
    createdBy: 'script', // Identificador para saber que fue creado por script
    active: true,
    status: shouldApprove ? 'approved' : 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(shouldApprove && { approvedAt: admin.firestore.FieldValue.serverTimestamp() })
  };
  
  const docRef = await db.collection(companiesPath).add(newClient);
  
  console.log('='.repeat(80));
  console.log('✅ CLIENTE CREADO EXITOSAMENTE');
  console.log('='.repeat(80));
  console.log(`   📋 Nombre: ${clientName}`);
  console.log(`   🆔 ID: ${docRef.id}`);
  console.log(`   🏢 Empresa padre: ${parentData.companyName || mainCompanyId} (${mainCompanyId})`);
  console.log(`   📊 Estado: ${shouldApprove ? 'Aprobado' : 'Pendiente de aprobación'}`);
  console.log(`   ✅ Activo: Sí`);
  console.log('='.repeat(80));
  console.log('');
  
  if (!shouldApprove) {
    console.log('⚠️  Nota: El cliente está pendiente de aprobación.');
    console.log('   Para aprobarlo automáticamente, ejecuta el script con la bandera --approve');
    console.log('');
  }
  
  return { id: docRef.id, ...newClient };
}

createClient()
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

