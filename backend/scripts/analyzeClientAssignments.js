#!/usr/bin/env node

/**
 * Script para analizar las asignaciones de documentos a clientes
 * 
 * Uso: node analyzeClientAssignments.js [tenantId] [mainCompanyId]
 * 
 * Muestra:
 * - Documentos en la empresa principal (sin cliente)
 * - Documentos asignados a cada cliente
 * - Documentos requeridos y su campo appliesTo
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
const DEFAULT_MAIN_COMPANY_ID = '22222222222';

const args = process.argv.slice(2);
const regularArgs = args.filter(arg => !arg.startsWith('--'));

const [tenantIdArg, mainCompanyIdArg] = regularArgs;
const tenantId = tenantIdArg || DEFAULT_TENANT_ID;
const mainCompanyId = mainCompanyIdArg || DEFAULT_MAIN_COMPANY_ID;

console.log('📝 Configuración:');
console.log(`   Tenant ID: ${tenantId}`);
console.log(`   Empresa principal: ${mainCompanyId}`);
console.log('');

const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

async function analyzeAssignments() {
  console.log('🔍 Obteniendo clientes...\n');
  
  // Obtener clientes
  const companiesPath = getTenantPath('companies');
  const clientsQuery = db.collection(companiesPath)
    .where('parentCompanyId', '==', mainCompanyId)
    .where('type', '==', 'client');
  
  const clientsSnapshot = await clientsQuery.get();
  const clients = {};
  
  clientsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    clients[doc.id] = { id: doc.id, name: data.companyName };
  });
  
  console.log(`✅ Clientes encontrados: ${Object.keys(clients).length}`);
  Object.values(clients).forEach(client => {
    console.log(`   - ${client.name} (${client.id})`);
  });
  console.log('');
  
  // Función auxiliar para analizar una colección
  const analyzeCollection = async (collectionName, label) => {
    const collectionPath = getTenantPath(collectionName);
    const query = db.collection(collectionPath)
      .where('companyId', '==', mainCompanyId);
    
    const snapshot = await query.get();
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const stats = {
      main: [], // Sin clientId o clientId null
      byClient: {}
    };
    
    // Inicializar contadores por cliente
    Object.keys(clients).forEach(clientId => {
      stats.byClient[clientId] = [];
    });
    
    docs.forEach(doc => {
      const clientId = doc.clientId;
      
      if (!clientId) {
        stats.main.push({
          id: doc.id,
          name: doc.name || doc.nombre || doc.id
        });
      } else if (stats.byClient[clientId]) {
        stats.byClient[clientId].push({
          id: doc.id,
          name: doc.name || doc.nombre || doc.id
        });
      }
    });
    
    return { total: docs.length, stats };
  };
  
  // Analizar documentos requeridos (con appliesTo)
  console.log('📋 Analizando documentos requeridos...\n');
  const requiredPath = getTenantPath('requiredDocuments');
  const requiredQuery = db.collection(requiredPath)
    .where('companyId', '==', mainCompanyId);
  const requiredSnapshot = await requiredQuery.get();
  const requiredDocs = requiredSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  const requiredStats = {
    mainOnly: [], // appliesTo.main = true, clients = null o []
    byClient: {}
  };
  
  Object.keys(clients).forEach(clientId => {
    requiredStats.byClient[clientId] = [];
  });
  
  requiredDocs.forEach(doc => {
    const appliesTo = doc.appliesTo || { main: true, clients: null };
    const clientIds = Array.isArray(appliesTo.clients) ? appliesTo.clients : [];
    
    if (appliesTo.main && (!appliesTo.clients || appliesTo.clients.length === 0)) {
      requiredStats.mainOnly.push({
        id: doc.id,
        name: doc.name || doc.id,
        appliesTo
      });
    }
    
    clientIds.forEach(clientId => {
      if (requiredStats.byClient[clientId]) {
        requiredStats.byClient[clientId].push({
          id: doc.id,
          name: doc.name || doc.id,
          appliesTo
        });
      }
    });
  });
  
  console.log(`   Total: ${requiredDocs.length}`);
  console.log(`   📌 Solo empresa principal (main=true, clients=null/[]): ${requiredStats.mainOnly.length}`);
  Object.keys(clients).forEach(clientId => {
    const clientName = clients[clientId].name;
    console.log(`   📌 ${clientName}: ${requiredStats.byClient[clientId].length}`);
  });
  console.log('');
  
  if (requiredStats.mainOnly.length > 0) {
    console.log('   📄 Documentos solo en empresa principal:');
    requiredStats.mainOnly.slice(0, 5).forEach(doc => {
      console.log(`      - ${doc.name.substring(0, 60)}`);
    });
    if (requiredStats.mainOnly.length > 5) {
      console.log(`      ... y ${requiredStats.mainOnly.length - 5} más`);
    }
    console.log('');
  }
  
  // Analizar otras colecciones
  const collections = [
    { name: 'uploadedDocuments', label: 'Documentos subidos' },
    { name: 'approvedDocuments', label: 'Documentos aprobados' },
    { name: 'personal', label: 'Empleados' },
    { name: 'vehiculos', label: 'Vehículos' }
  ];
  
  for (const collection of collections) {
    console.log(`📊 Analizando ${collection.label}...\n`);
    const result = await analyzeCollection(collection.name, collection.label);
    
    console.log(`   Total: ${result.total}`);
    console.log(`   📌 Empresa principal (sin cliente): ${result.stats.main.length}`);
    Object.keys(clients).forEach(clientId => {
      const clientName = clients[clientId].name;
      console.log(`   📌 ${clientName}: ${result.stats.byClient[clientId].length}`);
    });
    console.log('');
    
    if (result.stats.main.length > 0) {
      console.log(`   📄 ${collection.label} en empresa principal:`);
      result.stats.main.slice(0, 3).forEach(doc => {
        console.log(`      - ${doc.name.substring(0, 60)}`);
      });
      if (result.stats.main.length > 3) {
        console.log(`      ... y ${result.stats.main.length - 3} más`);
      }
      console.log('');
    }
  }
  
  console.log('='.repeat(80));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(80));
  console.log(`   Empresa principal: ${mainCompanyId}`);
  console.log(`   Clientes: ${Object.keys(clients).length}`);
  console.log('');
  console.log('   Documentos requeridos:');
  console.log(`      - Solo empresa principal: ${requiredStats.mainOnly.length}`);
  Object.keys(clients).forEach(clientId => {
    const clientName = clients[clientId].name;
    console.log(`      - ${clientName}: ${requiredStats.byClient[clientId].length}`);
  });
  console.log('='.repeat(80));
  console.log('');
}

analyzeAssignments()
  .then(() => {
    console.log('✅ Análisis completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });

