#!/usr/bin/env node

/**
 * Script de migración al sistema multi-tenant
 * Migra todos los datos existentes a la estructura de tenants
 */

import { db } from '../firebaseconfig.js';
import { getTenantCollections } from '../utils/tenantUtils.js';

const DEFAULT_TENANT_ID = 'default';

async function migrateToMultiTenant() {
  console.log('🚀 Iniciando migración al sistema multi-tenant...');
  
  try {
    // 1. Crear tenant por defecto si no existe
    await createDefaultTenant();
    
    // 2. Migrar empresas
    await migrateCompanies();
    
    // 3. Migrar usuarios
    await migrateUsers();
    
    // 4. Migrar documentos
    await migrateDocuments();
    
    // 5. Migrar documentos requeridos
    await migrateRequiredDocuments();
    
    // 6. Migrar personal
    await migratePersonal();
    
    // 7. Migrar vehículos
    await migrateVehiculos();
    
    // 8. Migrar tipos de entidades
    await migrateEntityTypes();
    
    // 9. Migrar logs
    await migrateLogs();
    
    console.log('✅ Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

async function createDefaultTenant() {
  console.log('📋 Creando tenant por defecto...');
  
  const tenantRef = db.collection('tenants').doc(DEFAULT_TENANT_ID);
  const tenantDoc = await tenantRef.get();
  
  if (!tenantDoc.exists) {
    await tenantRef.set({
      name: 'ControlDoc Principal',
      subdomain: 'default',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      description: 'Tenant principal de ControlDoc',
      settings: {
        maxCompanies: 1000,
        maxUsers: 10000,
        maxStorageGB: 100
      }
    });
    console.log('✅ Tenant por defecto creado');
  } else {
    console.log('ℹ️ Tenant por defecto ya existe');
  }
}

async function migrateCompanies() {
  console.log('🏢 Migrando empresas...');
  
  const oldCompanies = await db.collection('companies').get();
  const tenantCompaniesPath = getTenantCollections(DEFAULT_TENANT_ID).companies;
  
  let migrated = 0;
  for (const doc of oldCompanies.docs) {
    const data = doc.data();
    await db.collection(tenantCompaniesPath).doc(doc.id).set({
      ...data,
      tenantId: DEFAULT_TENANT_ID,
      migratedAt: new Date()
    });
    migrated++;
  }
  
  console.log(`✅ ${migrated} empresas migradas`);
}

async function migrateUsers() {
  console.log('👥 Migrando usuarios...');
  
  const oldUsers = await db.collection('users').get();
  const tenantUsersPath = getTenantCollections(DEFAULT_TENANT_ID).users;
  
  let migrated = 0;
  for (const doc of oldUsers.docs) {
    const data = doc.data();
    await db.collection(tenantUsersPath).doc(doc.id).set({
      ...data,
      tenantId: DEFAULT_TENANT_ID,
      migratedAt: new Date()
    });
    migrated++;
  }
  
  console.log(`✅ ${migrated} usuarios migrados`);
}

async function migrateDocuments() {
  console.log('📄 Migrando documentos...');
  
  const collections = ['uploadedDocuments', 'approvedDocuments', 'pendingDocuments'];
  const tenantCollections = getTenantCollections(DEFAULT_TENANT_ID);
  
  for (const collectionName of collections) {
    try {
      const oldDocs = await db.collection(collectionName).get();
      const tenantPath = tenantCollections.uploadedDocuments;
      
      let migrated = 0;
      for (const doc of oldDocs.docs) {
        const data = doc.data();
        await db.collection(tenantPath).doc(doc.id).set({
          ...data,
          tenantId: DEFAULT_TENANT_ID,
          originalCollection: collectionName,
          migratedAt: new Date()
        });
        migrated++;
      }
      
      console.log(`✅ ${migrated} documentos de ${collectionName} migrados`);
    } catch (error) {
      console.warn(`⚠️ Error migrando ${collectionName}:`, error.message);
    }
  }
}

async function migrateRequiredDocuments() {
  console.log('📋 Migrando documentos requeridos...');
  
  const oldDocs = await db.collection('requiredDocuments').get();
  const tenantPath = getTenantCollections(DEFAULT_TENANT_ID).requiredDocuments;
  
  let migrated = 0;
  for (const doc of oldDocs.docs) {
    const data = doc.data();
    await db.collection(tenantPath).doc(doc.id).set({
      ...data,
      tenantId: DEFAULT_TENANT_ID,
      migratedAt: new Date()
    });
    migrated++;
  }
  
  console.log(`✅ ${migrated} documentos requeridos migrados`);
}

async function migratePersonal() {
  console.log('👤 Migrando personal...');
  
  const oldPersonal = await db.collection('personal').get();
  const tenantPath = getTenantCollections(DEFAULT_TENANT_ID).personal;
  
  let migrated = 0;
  for (const doc of oldPersonal.docs) {
    const data = doc.data();
    await db.collection(tenantPath).doc(doc.id).set({
      ...data,
      tenantId: DEFAULT_TENANT_ID,
      migratedAt: new Date()
    });
    migrated++;
  }
  
  console.log(`✅ ${migrated} registros de personal migrados`);
}

async function migrateVehiculos() {
  console.log('🚗 Migrando vehículos...');
  
  const oldVehiculos = await db.collection('vehiculos').get();
  const tenantPath = getTenantCollections(DEFAULT_TENANT_ID).vehiculos;
  
  let migrated = 0;
  for (const doc of oldVehiculos.docs) {
    const data = doc.data();
    await db.collection(tenantPath).doc(doc.id).set({
      ...data,
      tenantId: DEFAULT_TENANT_ID,
      migratedAt: new Date()
    });
    migrated++;
  }
  
  console.log(`✅ ${migrated} vehículos migrados`);
}

async function migrateEntityTypes() {
  console.log('🏷️ Migrando tipos de entidades...');
  
  const oldTypes = await db.collection('documentEntityTypes').get();
  const tenantPath = getTenantCollections(DEFAULT_TENANT_ID).documentEntityTypes;
  
  let migrated = 0;
  for (const doc of oldTypes.docs) {
    const data = doc.data();
    await db.collection(tenantPath).doc(doc.id).set({
      ...data,
      tenantId: DEFAULT_TENANT_ID,
      migratedAt: new Date()
    });
    migrated++;
  }
  
  console.log(`✅ ${migrated} tipos de entidades migrados`);
}

async function migrateLogs() {
  console.log('📝 Migrando logs...');
  
  const oldLogs = await db.collection('logs').get();
  const tenantPath = getTenantCollections(DEFAULT_TENANT_ID).logs;
  
  let migrated = 0;
  for (const doc of oldLogs.docs) {
    const data = doc.data();
    await db.collection(tenantPath).doc(doc.id).set({
      ...data,
      tenantId: DEFAULT_TENANT_ID,
      migratedAt: new Date()
    });
    migrated++;
  }
  
  console.log(`✅ ${migrated} logs migrados`);
}

// Función para crear un nuevo tenant
async function createNewTenant(tenantData) {
  console.log(`🏗️ Creando nuevo tenant: ${tenantData.subdomain}`);
  
  const tenantRef = db.collection('tenants').doc(tenantData.subdomain);
  
  await tenantRef.set({
    name: tenantData.name,
    subdomain: tenantData.subdomain,
    description: tenantData.description || '',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    settings: {
      maxCompanies: 100,
      maxUsers: 1000,
      maxStorageGB: 10
    }
  });
  
  console.log(`✅ Tenant ${tenantData.subdomain} creado exitosamente`);
}

// Función para listar todos los tenants
async function listTenants() {
  console.log('📋 Listando todos los tenants...');
  
  const tenants = await db.collection('tenants').get();
  
  console.log('\n🏢 Tenants disponibles:');
  tenants.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: ${data.name} (${data.status})`);
  });
}

// Manejo de argumentos de línea de comandos
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'migrate':
    migrateToMultiTenant();
    break;
  case 'create-tenant':
    if (args.length < 4) {
      console.log('Uso: node migrateToMultiTenant.js create-tenant <subdomain> <name> <description>');
      process.exit(1);
    }
    createNewTenant({
      subdomain: args[1],
      name: args[2],
      description: args[3]
    });
    break;
  case 'list':
    listTenants();
    break;
  default:
    console.log(`
📋 Script de migración multi-tenant

Uso:
  node migrateToMultiTenant.js migrate          # Migrar datos existentes
  node migrateToMultiTenant.js create-tenant <subdomain> <name> <description>  # Crear nuevo tenant
  node migrateToMultiTenant.js list             # Listar tenants

Ejemplos:
  node migrateToMultiTenant.js migrate
  node migrateToMultiTenant.js create-tenant empresa1 "Empresa Ejemplo 1" "Descripción del tenant"
  node migrateToMultiTenant.js list
    `);
}



