import express from 'express';
import { db } from '../firebaseconfig.js';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';
import { requireRole } from '../middleware/requireRole.js';
import { getTenantCollections, tenantMiddleware } from '../utils/tenantUtils.js';

const router = express.Router();

// Middleware para verificar que el usuario es superadmin
const requireSuperAdmin = requireRole(['max']);

/**
 * GET /api/tenants/is-empty
 * Verificar si el tenant actual está vacío (sin usuarios)
 */
router.get('/is-empty', (req, res, next) => {
  // Si se pasa tenant como parámetro, usarlo; sino usar middleware
  if (req.query.tenant) {
    req.tenantId = req.query.tenant;
    req.getTenantCollectionPath = (collectionName) => `tenants/${req.tenantId}/${collectionName}`;
    req.getTenantCollections = () => getTenantCollections(req.tenantId);
    console.log('🔍 [TenantRoutes] Tenant desde parámetro:', req.tenantId);
    next();
  } else {
    tenantMiddleware(req, res, next);
  }
}, async (req, res) => {
  try {
    const tenantUsersPath = req.getTenantCollectionPath('users');
    console.log('🔍 [TenantRoutes] Verificando tenant vacío en ruta:', tenantUsersPath);
    console.log('🔍 [TenantRoutes] Tenant ID detectado:', req.tenantId);
    console.log('🔍 [TenantRoutes] Host:', req.headers.host);
    
    // Verificar si la colección users existe y está vacía
    let isEmpty = true;
    let userCount = 0;
    
    try {
      const usersSnap = await db.collection(tenantUsersPath).limit(1).get();
      userCount = usersSnap.size;
      isEmpty = usersSnap.empty;
      
      console.log('🔍 [TenantRoutes] Usuarios encontrados:', userCount);
      
      // Si hay usuarios, listar todos para debug
      if (!isEmpty) {
        console.log('🔍 [TenantRoutes] Usuarios en el tenant:');
        const allUsersSnap = await db.collection(tenantUsersPath).get();
        allUsersSnap.docs.forEach(doc => {
          const data = doc.data();
          console.log(`- ID: ${doc.id}, Email: ${data.realemail || data.email}, Rol: ${data.role}`);
        });
      } else {
        console.log('🔍 [TenantRoutes] Colección users está vacía o no existe');
      }
    } catch (collectionError) {
      console.log('🔍 [TenantRoutes] Error accediendo a colección users (probablemente no existe):', collectionError.message);
      // Si hay error accediendo a la colección, asumir que está vacía
      isEmpty = true;
      userCount = 0;
    }
    
    console.log('🔍 [TenantRoutes] Resultado isEmpty:', isEmpty, 'userCount:', userCount);
    res.json({ isEmpty });
  } catch (error) {
    console.error('❌ [TenantRoutes] Error verificando si tenant está vacío:', error);
    // En caso de error, asumir que está vacío para permitir crear superadmin
    res.json({ isEmpty: true });
  }
});

/**
 * GET /api/tenants
 * Listar todos los tenants (solo superadmin)
 */
router.get('/', authenticateFirebaseUser, requireSuperAdmin, async (req, res) => {
  try {
    const tenantsSnapshot = await db.collection('tenants').get();
    const tenants = [];
    
    for (const doc of tenantsSnapshot.docs) {
      const data = doc.data();
      const stats = await getTenantStats(doc.id);
      tenants.push({
        id: doc.id,
        ...data,
        stats
      });
    }
    
    res.json(tenants);
  } catch (error) {
    console.error('Error listando tenants:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/tenants/:id
 * Obtener información de un tenant específico
 */
router.get('/:id', authenticateFirebaseUser, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantDoc = await db.collection('tenants').doc(id).get();
    
    if (!tenantDoc.exists) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    
    const data = tenantDoc.data();
    const stats = await getTenantStats(id);
    
    res.json({
      id: tenantDoc.id,
      ...data,
      stats
    });
  } catch (error) {
    console.error('Error obteniendo tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/tenants
 * Crear un nuevo tenant (solo superadmin)
 */
router.post('/', authenticateFirebaseUser, requireSuperAdmin, async (req, res) => {
  try {
    const { name, subdomain, description, status = 'active' } = req.body;
    
    // Validaciones
    if (!name || !subdomain) {
      return res.status(400).json({ error: 'Nombre y subdominio son requeridos' });
    }
    
    // Verificar que el subdominio no exista
    const existingTenant = await db.collection('tenants')
      .where('subdomain', '==', subdomain)
      .get();
    
    if (!existingTenant.empty) {
      return res.status(400).json({ error: 'El subdominio ya existe' });
    }
    
    // Crear el tenant
    const tenantData = {
      name,
      subdomain,
      description: description || '',
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        maxCompanies: 100,
        maxUsers: 1000,
        maxStorageGB: 10
      }
    };
    
    const docRef = await db.collection('tenants').add(tenantData);
    
    res.status(201).json({
      id: docRef.id,
      ...tenantData
    });
  } catch (error) {
    console.error('Error creando tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/tenants/:id
 * Actualizar un tenant (solo superadmin)
 */
router.put('/:id', authenticateFirebaseUser, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subdomain, description, status, settings } = req.body;
    
    const tenantRef = db.collection('tenants').doc(id);
    const tenantDoc = await tenantRef.get();
    
    if (!tenantDoc.exists) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    
    // Verificar que el subdominio no esté en uso por otro tenant
    if (subdomain) {
      const existingTenant = await db.collection('tenants')
        .where('subdomain', '==', subdomain)
        .get();
      
      const existingDoc = existingTenant.docs.find(doc => doc.id !== id);
      if (existingDoc) {
        return res.status(400).json({ error: 'El subdominio ya está en uso por otro tenant' });
      }
    }
    
    // Actualizar el tenant
    const updateData = {
      updatedAt: new Date()
    };
    
    if (name) updateData.name = name;
    if (subdomain) updateData.subdomain = subdomain;
    if (description !== undefined) updateData.description = description;
    if (status) updateData.status = status;
    if (settings) updateData.settings = { ...tenantDoc.data().settings, ...settings };
    
    await tenantRef.update(updateData);
    
    res.json({ message: 'Tenant actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/tenants/:id
 * Eliminar un tenant (solo superadmin)
 */
router.delete('/:id', authenticateFirebaseUser, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const tenantRef = db.collection('tenants').doc(id);
    const tenantDoc = await tenantRef.get();
    
    if (!tenantDoc.exists) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    
    // Verificar que no sea el tenant por defecto
    if (id === 'default') {
      return res.status(400).json({ error: 'No se puede eliminar el tenant por defecto' });
    }
    
    // Eliminar el tenant
    await tenantRef.delete();
    
    res.json({ message: 'Tenant eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/tenants/:id/stats
 * Obtener estadísticas detalladas de un tenant
 */
router.get('/:id/stats', authenticateFirebaseUser, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const tenantRef = db.collection('tenants').doc(id);
    const tenantDoc = await tenantRef.get();
    
    if (!tenantDoc.exists) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    
    const stats = await getTenantStats(id);
    const detailedStats = await getDetailedTenantStats(id);
    
    res.json({
      basic: stats,
      detailed: detailedStats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas del tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/tenants/:id/backup
 * Crear backup de un tenant
 */
router.post('/:id/backup', authenticateFirebaseUser, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const tenantRef = db.collection('tenants').doc(id);
    const tenantDoc = await tenantRef.get();
    
    if (!tenantDoc.exists) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    
    // Crear backup del tenant
    const backupData = await createTenantBackup(id);
    
    res.json({
      message: 'Backup creado exitosamente',
      backupId: backupData.id,
      timestamp: backupData.timestamp
    });
  } catch (error) {
    console.error('Error creando backup del tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Funciones auxiliares

/**
 * Obtener estadísticas básicas de un tenant
 */
async function getTenantStats(tenantId) {
  try {
    const collections = ['companies', 'users', 'uploadedDocuments', 'requiredDocuments', 'personal', 'vehiculos'];
    const stats = {};
    
    for (const collectionName of collections) {
      const path = `tenants/${tenantId}/${collectionName}`;
      const snapshot = await db.collection(path).get();
      stats[collectionName] = snapshot.size;
    }
    
    return stats;
  } catch (error) {
    console.error('Error obteniendo estadísticas básicas:', error);
    return {};
  }
}

/**
 * Obtener estadísticas detalladas de un tenant
 */
async function getDetailedTenantStats(tenantId) {
  try {
    const collections = getTenantCollections(tenantId);
    const detailedStats = {};
    
    // Estadísticas de empresas
    const companiesSnapshot = await db.collection(collections.companies).get();
    detailedStats.companies = {
      total: companiesSnapshot.size,
      byStatus: {}
    };
    
    companiesSnapshot.docs.forEach(doc => {
      const status = doc.data().status || 'unknown';
      detailedStats.companies.byStatus[status] = (detailedStats.companies.byStatus[status] || 0) + 1;
    });
    
    // Estadísticas de documentos
    const documentsSnapshot = await db.collection(collections.uploadedDocuments).get();
    detailedStats.documents = {
      total: documentsSnapshot.size,
      byStatus: {},
      byType: {}
    };
    
    documentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'unknown';
      const type = data.entityType || 'unknown';
      
      detailedStats.documents.byStatus[status] = (detailedStats.documents.byStatus[status] || 0) + 1;
      detailedStats.documents.byType[type] = (detailedStats.documents.byType[type] || 0) + 1;
    });
    
    return detailedStats;
  } catch (error) {
    console.error('Error obteniendo estadísticas detalladas:', error);
    return {};
  }
}

/**
 * Crear backup de un tenant
 */
async function createTenantBackup(tenantId) {
  try {
    const collections = getTenantCollections(tenantId);
    const backupData = {
      tenantId,
      timestamp: new Date(),
      collections: {}
    };
    
    // Backup de cada colección
    for (const [collectionName, collectionPath] of Object.entries(collections)) {
      const snapshot = await db.collection(collectionPath).get();
      backupData.collections[collectionName] = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
    }
    
    // Guardar backup en Firestore
    const backupRef = await db.collection('tenantBackups').add(backupData);
    
    return {
      id: backupRef.id,
      timestamp: backupData.timestamp
    };
  } catch (error) {
    console.error('Error creando backup:', error);
    throw error;
  }
}

export default router;



