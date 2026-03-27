// Script para migrar versionNumbers a documentos existentes
import { db } from '../firebaseconfig.js';
import { getTenantCollectionPath } from '../utils/tenantUtils.js';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';

const DEFAULT_TENANT_ID = 'default';

async function migrateVersionNumbers() {
  console.log('🔄 Iniciando migración de versionNumbers...');
  
  try {
    // Migrar uploadedDocuments
    await migrateCollection('uploadedDocuments');
    
    // Migrar approvedDocuments  
    await migrateCollection('approvedDocuments');
    
    console.log('✅ Migración completada exitosamente');
  } catch (error) {
    console.error('❌ Error en migración:', error);
  }
}

async function migrateCollection(collectionName) {
  console.log(`📄 Migrando ${collectionName}...`);
  
  const tenantPath = getTenantCollectionPath(collectionName);
  const snapshot = await getDocs(collection(db, tenantPath));
  
  let migrated = 0;
  let skipped = 0;
  
  for (const document of snapshot.docs) {
    const data = document.data();
    
    // Solo migrar documentos que no tienen versionNumber
    if (!data.versionNumber) {
      try {
        // Calcular versión basándose en documentos similares
        const versionNumber = await calculateVersionNumber(data, collectionName);
        
        await updateDoc(doc(db, tenantPath, document.id), {
          versionNumber: versionNumber,
          versionString: `${versionNumber}.0`
        });
        
        migrated++;
        console.log(`✅ Migrado ${collectionName}/${document.id} -> versión ${versionNumber}`);
      } catch (error) {
        console.warn(`⚠️ Error migrando ${collectionName}/${document.id}:`, error.message);
      }
    } else {
      skipped++;
    }
  }
  
  console.log(`📊 ${collectionName}: ${migrated} migrados, ${skipped} omitidos`);
}

async function calculateVersionNumber(documentData, sourceCollection) {
  // Buscar documentos similares para determinar la versión correcta
  const { companyId, entityType, entityId, requiredDocumentId } = documentData;
  
  let maxVersion = 0;
  
  // Buscar en uploadedDocuments
  try {
    const uploadedPath = getTenantCollectionPath('uploadedDocuments');
    const uploadedQuery = query(
      collection(db, uploadedPath),
      where('companyId', '==', companyId),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId || companyId),
      where('requiredDocumentId', '==', requiredDocumentId)
    );
    
    const uploadedSnapshot = await getDocs(uploadedQuery);
    for (const doc of uploadedSnapshot.docs) {
      const version = doc.data().versionNumber || 0;
      if (version > maxVersion) {
        maxVersion = version;
      }
    }
  } catch (error) {
    console.warn('Error buscando en uploadedDocuments:', error.message);
  }
  
  // Buscar en approvedDocuments
  try {
    const approvedPath = getTenantCollectionPath('approvedDocuments');
    const approvedQuery = query(
      collection(db, approvedPath),
      where('companyId', '==', companyId),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId || companyId),
      where('requiredDocumentId', '==', requiredDocumentId)
    );
    
    const approvedSnapshot = await getDocs(approvedQuery);
    for (const doc of approvedSnapshot.docs) {
      const version = doc.data().versionNumber || 0;
      if (version > maxVersion) {
        maxVersion = version;
      }
    }
  } catch (error) {
    console.warn('Error buscando en approvedDocuments:', error.message);
  }
  
  // Si no se encontraron versiones, usar 1
  return maxVersion > 0 ? maxVersion + 1 : 1;
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateVersionNumbers();
}

export { migrateVersionNumbers };

