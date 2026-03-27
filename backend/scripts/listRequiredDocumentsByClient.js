#!/usr/bin/env node

/**
 * Script para listar documentos requeridos por cliente
 * 
 * Uso: node listRequiredDocumentsByClient.js [tenantId] [mainCompanyId]
 * 
 * Este script:
 * 1. Obtiene todos los clientes de la empresa principal
 * 2. Obtiene todos los documentos requeridos de esa empresa
 * 3. Lista qué documentos tiene asignado cada cliente
 * 4. Muestra documentos que solo aplican a la empresa principal
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
// ============================================

// Parsear argumentos
const args = process.argv.slice(2);
const regularArgs = args.filter(arg => !arg.startsWith('--'));

const [tenantIdArg, mainCompanyIdArg] = regularArgs;
const tenantId = tenantIdArg || DEFAULT_TENANT_ID;
const mainCompanyId = mainCompanyIdArg || DEFAULT_MAIN_COMPANY_ID;

console.log('📝 Configuración:');
console.log(`   Tenant ID: ${tenantId} ${tenantIdArg ? '(parámetro)' : '(default)'}`);
console.log(`   Empresa principal: ${mainCompanyId} ${mainCompanyIdArg ? '(parámetro)' : '(default)'}`);
console.log('');

// Rutas multi-tenant
const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

// Función para normalizar appliesTo (igual que en el frontend)
function normalizeAppliesTo(appliesTo) {
  if (!appliesTo) {
    return { main: true, clients: [] };
  }
  if (typeof appliesTo !== 'object') {
    return { main: true, clients: [] };
  }
  return {
    main: appliesTo.main !== false,
    clients: Array.isArray(appliesTo.clients) ? appliesTo.clients : (appliesTo.clients === null ? null : [])
  };
}

async function listRequiredDocumentsByClient() {
  console.log('🚀 Iniciando listado de documentos requeridos por cliente...\n');
  
  // 1. Obtener todos los clientes de la empresa principal
  const companiesPath = getTenantPath('companies');
  const clientsQuery = db.collection(companiesPath)
    .where('parentCompanyId', '==', mainCompanyId)
    .where('type', '==', 'client');
  
  const clientsSnapshot = await clientsQuery.get();
  const clients = clientsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`👥 Clientes encontrados: ${clients.length}`);
  clients.forEach((client, index) => {
    console.log(`   ${index + 1}. ${client.companyName || client.name || 'Sin nombre'} (ID: ${client.id})`);
  });
  console.log('');
  
  // 2. Obtener todos los documentos requeridos de la empresa principal
  const requiredPath = getTenantPath('requiredDocuments');
  const requiredQuery = db.collection(requiredPath)
    .where('companyId', '==', mainCompanyId);
  
  const requiredSnapshot = await requiredQuery.get();
  const requiredDocs = requiredSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`📋 Documentos requeridos encontrados: ${requiredDocs.length}\n`);
  
  // 3. Crear mapa de documentos por cliente
  const docsByClient = {};
  const docsOnlyMain = [];
  const docsWithNullClients = [];
  
  // Inicializar mapa para cada cliente
  clients.forEach(client => {
    docsByClient[client.id] = {
      clientName: client.companyName || client.name || 'Sin nombre',
      clientId: client.id,
      documents: []
    };
  });
  
  // Procesar cada documento requerido
  requiredDocs.forEach(doc => {
    const appliesTo = normalizeAppliesTo(doc.appliesTo);
    
    // Si clients es null, es especial (aplica a todos o ninguno según interpretación)
    if (appliesTo.clients === null) {
      docsWithNullClients.push({
        id: doc.id,
        name: doc.name,
        entityType: doc.entityType,
        appliesTo
      });
      return;
    }
    
    // Si clients es array vacío, solo aplica a empresa principal
    if (Array.isArray(appliesTo.clients) && appliesTo.clients.length === 0) {
      docsOnlyMain.push({
        id: doc.id,
        name: doc.name,
        entityType: doc.entityType,
        appliesTo
      });
      return;
    }
    
    // Si clients tiene elementos, asignar a cada cliente correspondiente
    if (Array.isArray(appliesTo.clients) && appliesTo.clients.length > 0) {
      appliesTo.clients.forEach(clientId => {
        const clientIdStr = String(clientId);
        if (docsByClient[clientIdStr]) {
          docsByClient[clientIdStr].documents.push({
            id: doc.id,
            name: doc.name,
            entityType: doc.entityType,
            appliesTo
          });
        }
      });
    }
  });
  
  // 4. Mostrar resultados
  console.log('='.repeat(80));
  console.log('📊 RESUMEN POR CLIENTE');
  console.log('='.repeat(80));
  console.log('');
  
  // Mostrar documentos por cliente
  Object.values(docsByClient).forEach((clientData, index) => {
    console.log(`\n${index + 1}. Cliente: ${clientData.clientName} (ID: ${clientData.clientId})`);
    console.log(`   Documentos asignados: ${clientData.documents.length}`);
    
    if (clientData.documents.length > 0) {
      clientData.documents.forEach((doc, docIndex) => {
        console.log(`      ${docIndex + 1}. [${doc.entityType || 'N/A'}] ${doc.name}`);
        console.log(`         ID: ${doc.id}`);
      });
    } else {
      console.log('      (Sin documentos asignados)');
    }
  });
  
  // Mostrar documentos solo para empresa principal
  console.log('\n' + '='.repeat(80));
  console.log('🏢 DOCUMENTOS SOLO PARA EMPRESA PRINCIPAL');
  console.log('='.repeat(80));
  console.log(`   Total: ${docsOnlyMain.length}`);
  
  if (docsOnlyMain.length > 0) {
    docsOnlyMain.forEach((doc, index) => {
      console.log(`   ${index + 1}. [${doc.entityType || 'N/A'}] ${doc.name}`);
      console.log(`      ID: ${doc.id}`);
    });
  } else {
    console.log('   (No hay documentos solo para empresa principal)');
  }
  
  // Mostrar documentos con clients: null (caso especial)
  if (docsWithNullClients.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  DOCUMENTOS CON clients: null (caso especial)');
    console.log('='.repeat(80));
    console.log(`   Total: ${docsWithNullClients.length}`);
    console.log('   Nota: Estos documentos tienen appliesTo.clients = null');
    console.log('   Según la lógica actual, NO aplican a ningún cliente (solo empresa principal)');
    console.log('');
    
    docsWithNullClients.forEach((doc, index) => {
      console.log(`   ${index + 1}. [${doc.entityType || 'N/A'}] ${doc.name}`);
      console.log(`      ID: ${doc.id}`);
    });
  }
  
  // Resumen final
  console.log('\n' + '='.repeat(80));
  console.log('📈 RESUMEN GENERAL');
  console.log('='.repeat(80));
  console.log(`   Total de documentos requeridos: ${requiredDocs.length}`);
  console.log(`   Documentos asignados a clientes: ${Object.values(docsByClient).reduce((sum, c) => sum + c.documents.length, 0)}`);
  console.log(`   Documentos solo para empresa principal: ${docsOnlyMain.length}`);
  console.log(`   Documentos con clients: null: ${docsWithNullClients.length}`);
  console.log('');
  
  // Verificar documentos duplicados (mismo documento en múltiples clientes)
  const docIdsInClients = new Set();
  const duplicateDocs = [];
  
  Object.values(docsByClient).forEach(clientData => {
    clientData.documents.forEach(doc => {
      if (docIdsInClients.has(doc.id)) {
        if (!duplicateDocs.find(d => d.id === doc.id)) {
          duplicateDocs.push(doc);
        }
      } else {
        docIdsInClients.add(doc.id);
      }
    });
  });
  
  if (duplicateDocs.length > 0) {
    console.log('⚠️  Documentos asignados a múltiples clientes:');
    duplicateDocs.forEach(doc => {
      const clientsWithDoc = Object.values(docsByClient)
        .filter(c => c.documents.some(d => d.id === doc.id))
        .map(c => c.clientName);
      console.log(`   - ${doc.name} (ID: ${doc.id})`);
      console.log(`     Asignado a: ${clientsWithDoc.join(', ')}`);
    });
  }
  
  console.log('\n✅ Listado completado');
}

// Ejecutar
listRequiredDocumentsByClient()
  .then(() => {
    console.log('\n✅ Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });


