import admin from 'firebase-admin';
import { getTenantCollectionPath } from '../utils/tenantUtils.js';
import 'dotenv/config';

// Inicializar Firebase Admin usando la misma configuración que el servidor
const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

// Solución temporal: reemplazar \\n por \n si es necesario
const fixedServiceAccount = {
  ...serviceAccount,
  private_key: serviceAccount.private_key.replace(/\\n/g, '\n')
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(fixedServiceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();

/**
 * Script para migrar y crear la estructura de searchHistory en Firestore
 * Este script crea la colección searchHistory para cada tenant existente
 */
async function migrateSearchHistory() {
  console.log('🚀 Iniciando migración de searchHistory...');

  try {
    // Obtener todos los tenants
    const tenantsSnapshot = await db.collection('tenants').get();
    
    if (tenantsSnapshot.empty) {
      console.log('❌ No se encontraron tenants para migrar');
      return;
    }

    console.log(`📋 Encontrados ${tenantsSnapshot.size} tenants`);

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data();
      
      console.log(`\n🔧 Procesando tenant: ${tenantId} (${tenantData.name || 'Sin nombre'})`);

      try {
        // Crear la colección searchHistory para este tenant
        const searchHistoryPath = getTenantCollectionPath(tenantId, 'searchHistory');
        
        // Verificar si ya existe la colección
        const searchHistoryRef = db.collection(searchHistoryPath);
        const existingDocs = await searchHistoryRef.limit(1).get();
        
        if (!existingDocs.empty) {
          console.log(`  ✅ searchHistory ya existe para tenant ${tenantId}`);
          continue;
        }

        // Crear un documento de ejemplo para inicializar la colección
        await searchHistoryRef.doc('_initialized').set({
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          tenantId: tenantId,
          description: 'Colección inicializada para historial de búsquedas'
        });

        console.log(`  ✅ searchHistory creada para tenant ${tenantId}`);

      } catch (error) {
        console.error(`  ❌ Error procesando tenant ${tenantId}:`, error.message);
      }
    }

    console.log('\n🎉 Migración de searchHistory completada exitosamente');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración si se llama directamente
console.log('🚀 Iniciando script de migración de searchHistory...');
console.log('📁 Directorio actual:', process.cwd());
console.log('🔧 Variables de entorno disponibles:', Object.keys(process.env).filter(key => key.includes('GOOGLE') || key.includes('FIREBASE')));

migrateSearchHistory()
  .then(() => {
    console.log('✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error en script:', error);
    process.exit(1);
  });

export { migrateSearchHistory };
