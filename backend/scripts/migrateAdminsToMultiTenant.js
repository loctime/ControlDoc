#!/usr/bin/env node

/**
 * Script de migración para mover administradores a la estructura multi-tenant
 * Migra administradores de la colección global "users" a "tenants/{tenantId}/admins"
 */

import { db } from '../firebaseconfig.js';
import { getTenantCollectionPath } from '../utils/tenantUtils.js';

const DEFAULT_TENANT_ID = 'default';

async function migrateAdminsToMultiTenant() {
  console.log('🚀 Iniciando migración de administradores al sistema multi-tenant...');
  
  try {
    // 1. Obtener todos los administradores de la colección global "users"
    console.log('📋 Obteniendo administradores de la colección global...');
    const globalAdminsSnapshot = await db.collection('users')
      .where('role', '==', 'DhHkVja')
      .get();
    
    if (globalAdminsSnapshot.empty) {
      console.log('✅ No hay administradores para migrar');
      return;
    }
    
    console.log(`📊 Encontrados ${globalAdminsSnapshot.size} administradores para migrar`);
    
    // 2. Crear la colección de administradores del tenant por defecto
    const tenantAdminsPath = getTenantCollectionPath(DEFAULT_TENANT_ID, 'admins');
    console.log(`📁 Migrando a: ${tenantAdminsPath}`);
    
    // 3. Migrar cada administrador
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const adminDoc of globalAdminsSnapshot.docs) {
      try {
        const adminData = adminDoc.data();
        const adminId = adminDoc.id;
        
        console.log(`🔄 Migrando administrador: ${adminData.displayName || adminData.email}`);
        
        // Agregar información del tenant
        const migratedAdminData = {
          ...adminData,
          tenantId: DEFAULT_TENANT_ID,
          migratedAt: new Date().toISOString(),
          originalCollection: 'users'
        };
        
        // Guardar en la nueva ubicación
        await db.collection(tenantAdminsPath).doc(adminId).set(migratedAdminData);
        
        // Marcar como migrado en la ubicación original (opcional)
        await adminDoc.ref.update({
          migratedToTenant: true,
          migratedAt: new Date().toISOString(),
          tenantId: DEFAULT_TENANT_ID
        });
        
        migratedCount++;
        console.log(`✅ Administrador migrado: ${adminData.displayName || adminData.email}`);
        
      } catch (error) {
        console.error(`❌ Error migrando administrador ${adminDoc.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📈 Resumen de migración:');
    console.log(`✅ Administradores migrados exitosamente: ${migratedCount}`);
    console.log(`❌ Errores durante la migración: ${errorCount}`);
    console.log(`📁 Ubicación final: ${tenantAdminsPath}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 ¡Migración completada exitosamente!');
      console.log('💡 Los administradores ahora están organizados por tenant.');
    } else {
      console.log('\n⚠️  Migración completada con errores. Revisa los logs anteriores.');
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar la migración
migrateAdminsToMultiTenant()
  .then(() => {
    console.log('🏁 Script de migración finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal en el script:', error);
    process.exit(1);
  });
