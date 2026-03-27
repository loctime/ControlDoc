#!/usr/bin/env node

/**
 * Script de migración: Agregar campos parentCompanyId, type y active a empresas existentes
 * Este script agrega los campos necesarios para el sistema de empresas padre → clientes
 * sin romper la compatibilidad con datos existentes
 */

import { db } from '../firebaseconfig.js';
import { getCurrentTenantId } from '../utils/tenantUtils.js';

async function migrateCompaniesToParentClient() {
  console.log('🚀 Iniciando migración de empresas a sistema padre-cliente...');
  
  try {
    // Obtener todos los tenants
    const tenantsSnapshot = await db.collection('tenants').get();
    
    if (tenantsSnapshot.empty) {
      console.log('⚠️ No se encontraron tenants. Creando tenant por defecto...');
      await createDefaultTenant();
      const tenantsSnapshot = await db.collection('tenants').get();
      await processTenants(tenantsSnapshot);
    } else {
      await processTenants(tenantsSnapshot);
    }
    
    console.log('✅ Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

async function createDefaultTenant() {
  const tenantRef = db.collection('tenants').doc('default');
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
  }
}

async function processTenants(tenantsSnapshot) {
  let totalMigrated = 0;
  
  for (const tenantDoc of tenantsSnapshot.docs) {
    const tenantId = tenantDoc.id;
    console.log(`\n📋 Procesando tenant: ${tenantId}`);
    
    const companiesPath = `tenants/${tenantId}/companies`;
    const companiesSnapshot = await db.collection(companiesPath).get();
    
    if (companiesSnapshot.empty) {
      console.log(`  ℹ️ No hay empresas en tenant ${tenantId}`);
      continue;
    }
    
    let migrated = 0;
    let skipped = 0;
    
    for (const companyDoc of companiesSnapshot.docs) {
      const companyData = companyDoc.data();
      const companyId = companyDoc.id;
      
      // Verificar si ya tiene los campos (evitar sobrescribir)
      const needsUpdate = 
        companyData.parentCompanyId === undefined ||
        companyData.type === undefined ||
        companyData.active === undefined;
      
      if (!needsUpdate) {
        skipped++;
        continue;
      }
      
      // Preparar actualización
      const updateData = {};
      
      if (companyData.parentCompanyId === undefined) {
        updateData.parentCompanyId = null;
      }
      
      if (companyData.type === undefined) {
        updateData.type = 'main';
      }
      
      if (companyData.active === undefined) {
        updateData.active = true;
      }
      
      // Actualizar documento
      await db.collection(companiesPath).doc(companyId).update({
        ...updateData,
        migratedAt: new Date()
      });
      
      migrated++;
      console.log(`  ✅ Migrada: ${companyData.companyName || companyData.name || companyId}`);
    }
    
    console.log(`  📊 Tenant ${tenantId}: ${migrated} migradas, ${skipped} ya actualizadas`);
    totalMigrated += migrated;
  }
  
  console.log(`\n📊 Total de empresas migradas: ${totalMigrated}`);
}

// Ejecutar migración
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateCompaniesToParentClient()
    .then(() => {
      console.log('\n✅ Proceso finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}

export { migrateCompaniesToParentClient };

