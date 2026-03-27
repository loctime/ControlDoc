// backend/routes/adminRoutes.js
import { Router } from "express"
import { db, auth } from "../firebaseconfig.js"
import { authenticateFirebaseUser } from "../middleware/authenticateFirebaseUser.js"
import { requireRole } from "../middleware/requireRole.js"
import { logAction } from "../utils/logAction.js"
import { initB2 } from '../services/backblazeService.js';
import axios from 'axios';
const router = Router()

// ✅ aSchedule admin user for deletion (24h grace period)
router.post("/schedule-delete-admin", authenticateFirebaseUser, requireRole("max"), async (req, res) => {
  const { userId, userUid } = req.body

  if (!userId) {
    return res.status(400).json({ error: "userId es requerido" })
  }

  try {
    // Usar la colección de administradores del tenant
    const tenantAdminsPath = req.getTenantCollectionPath('admins');
    
    // 1. Get user data before scheduling deletion
    const userDoc = await db.collection(tenantAdminsPath).doc(userId).get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Administrador no encontrado en este tenant" })
    }

    const userData = userDoc.data()
    const email = userData.email || "Sin email"

    // 2. Mark for deletion with 24h grace period
    await db
      .collection(tenantAdminsPath)
      .doc(userId)
      .update({
        deletionScheduled: true,
        deletionDate: new Date(),
        deletedBy: req.user.uid,
        deletedByEmail: req.user.email,
        originalStatus: userData.status || "active",
        status: "scheduled_for_deletion",
      })

    // 3. Disable in Firebase Auth temporarily
    if (userUid) {
      try {
        await auth.updateUser(userUid, { disabled: true })
      } catch (authError) {
        console.warn(`[WARN] No se pudo deshabilitar usuario en Auth ${userUid}: ${authError.message}`)
      }
    }

    // 4. Log the action
    await logAction({
      tenantId: req.tenantId,
      action: "schedule-delete-admin",
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      target: `${tenantAdminsPath}/${userId}`,
      message: "Administrador programado para eliminación (24h grace period)",
      meta: {
        targetUserEmail: email,
        targetUserUid: userUid,
        gracePeriodHours: 24,
        tenantId: req.tenantId
      },
    })

    console.log(`[OK] Administrador ${email} programado para eliminación.`)
    res.json({
      success: true,
      message: "Administrador programado para eliminación. Tienes 24 horas para revertir esta acción.",
    })
  } catch (error) {
    console.error("[ERROR] Al programar eliminación de administrador:", error)
    res.status(500).json({
      error: "Error al programar eliminación de administrador",
      details: error.message,
    })
  }
})

// ✅ Revert admin user deletion
router.post("/revert-delete-admin", authenticateFirebaseUser, requireRole("max"), async (req, res) => {
  const { userId, userUid } = req.body

  if (!userId) {
    return res.status(400).json({ error: "userId es requerido" })
  }

  try {
    // Usar la colección de administradores del tenant
    const tenantAdminsPath = req.getTenantCollectionPath('admins');
    
    // 1. Get user data
    const userDoc = await db.collection(tenantAdminsPath).doc(userId).get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Administrador no encontrado en este tenant" })
    }

    const userData = userDoc.data()
    const email = userData.email || "Sin email"

    // 2. Check if still within grace period
    const deletionDate = userData.deletionDate?.toDate()
    const now = new Date()
    const hoursDiff = (now - deletionDate) / (1000 * 60 * 60)

    if (hoursDiff > 24) {
      return res.status(400).json({ error: "El período de gracia de 24 horas ha expirado" })
    }

    // 3. Restore user
    await db
      .collection(tenantAdminsPath)
      .doc(userId)
      .update({
        deletionScheduled: false,
        deletionDate: null,
        deletedBy: null,
        deletedByEmail: null,
        status: userData.originalStatus || "active",
      })

    // 4. Re-enable in Firebase Auth
    if (userUid) {
      try {
        await auth.updateUser(userUid, { disabled: false })
      } catch (authError) {
        console.warn(`[WARN] No se pudo habilitar usuario en Auth ${userUid}: ${authError.message}`)
      }
    }

    // 5. Log the action
    await logAction({
      tenantId: req.tenantId,
      action: "revert-delete-admin",
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      target: `${tenantAdminsPath}/${userId}`,
      message: "Eliminación de administrador revertida",
      meta: {
        targetUserEmail: email,
        targetUserUid: userUid,
        hoursBeforeExpiry: 24 - hoursDiff,
        tenantId: req.tenantId
      },
    })

    console.log(`[OK] Eliminación de administrador ${email} revertida.`)
    res.json({
      success: true,
      message: "Eliminación revertida exitosamente. El administrador está activo nuevamente.",
    })
  } catch (error) {
    console.error("[ERROR] Al revertir eliminación de administrador:", error)
    res.status(500).json({
      error: "Error al revertir eliminación de administrador",
      details: error.message,
    })
  }
})

// ✅ Schedule company for deletion (24h grace period)
router.post("/schedule-delete-company", authenticateFirebaseUser, requireRole("max"), async (req, res) => {
  const { companyId } = req.body

  if (!companyId) {
    return res.status(400).json({ error: "companyId es requerido" })
  }

  try {
    // Usar rutas de tenant
    const tenantCompaniesPath = req.getTenantCollectionPath('companies');
    const tenantUsersPath = req.getTenantCollectionPath('users');
    
    // 1. Get company data before scheduling deletion
    const companyDoc = await db.collection(tenantCompaniesPath).doc(companyId).get()
    if (!companyDoc.exists) {
      return res.status(404).json({ error: "Empresa no encontrada en este tenant" })
    }

    const companyData = companyDoc.data()
    const companyName = companyData.name || companyData.companyName || ""

    // 2. Mark company for deletion with 24h grace period
    await db
      .collection(tenantCompaniesPath)
      .doc(companyId)
      .update({
        deletionScheduled: true,
        deletionDate: new Date(),
        deletedBy: req.user.uid,
        deletedByEmail: req.user.email,
        originalStatus: companyData.status || "active",
        status: "scheduled_for_deletion",
      })

    // 3. Disable all associated users temporarily
    const usersSnapshot = await db.collection(tenantUsersPath).where("companyId", "==", companyId).get()

    const disablePromises = []
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data()
      const uid = userData.uid || userData.firebaseUid

      // Mark user for deletion too
      disablePromises.push(
        db
          .collection(tenantUsersPath)
          .doc(userDoc.id)
          .update({
            deletionScheduled: true,
            deletionDate: new Date(),
            deletedBy: req.user.uid,
            deletedByEmail: req.user.email,
            originalStatus: userData.status || "active",
            status: "scheduled_for_deletion",
          }),
      )

      // Disable in Firebase Auth
      if (uid) {
        disablePromises.push(
          auth.updateUser(uid, { disabled: true }).catch((err) => {
            console.warn(`[WARN] No se pudo deshabilitar usuario Auth ${uid}: ${err.message}`)
          }),
        )
      }
    })

    await Promise.all(disablePromises)

    // 4. Log the action
    await logAction({
      tenantId: req.tenantId,
      action: "schedule-delete-company",
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      target: `companies/${companyId}`,
      message: "Empresa programada para eliminación (24h grace period)",
      meta: {
        companyName,
        companyId,
        affectedUsers: usersSnapshot.size,
        gracePeriodHours: 24,
      },
    })

    console.log(`[OK] Empresa ${companyName} programada para eliminación con ${usersSnapshot.size} usuarios.`)
    res.json({
      success: true,
      message: "Empresa programada para eliminación. Tienes 24 horas para revertir esta acción.",
    })
  } catch (error) {
    console.error("[ERROR] Al programar eliminación de empresa:", error)
    res.status(500).json({
      error: "Error al programar eliminación de empresa",
      details: error.message,
    })
  }
})

// ✅ Revert company deletion
router.post("/revert-delete-company", authenticateFirebaseUser, requireRole("max"), async (req, res) => {
  const { companyId } = req.body

  if (!companyId) {
    return res.status(400).json({ error: "companyId es requerido" })
  }

  try {
    // Usar rutas de tenant
    const tenantCompaniesPath = req.getTenantCollectionPath('companies');
    const tenantUsersPath = req.getTenantCollectionPath('users');
    
    // 1. Get company data
    const companyDoc = await db.collection(tenantCompaniesPath).doc(companyId).get()
    if (!companyDoc.exists) {
      return res.status(404).json({ error: "Empresa no encontrada en este tenant" })
    }

    const companyData = companyDoc.data()
    const companyName = companyData.name || companyData.companyName || ""

    // 2. Check if still within grace period
    const deletionDate = companyData.deletionDate?.toDate()
    const now = new Date()
    const hoursDiff = (now - deletionDate) / (1000 * 60 * 60)

    if (hoursDiff > 24) {
      return res.status(400).json({ error: "El período de gracia de 24 horas ha expirado" })
    }

    // 3. Restore company
    await db
      .collection(tenantCompaniesPath)
      .doc(companyId)
      .update({
        deletionScheduled: false,
        deletionDate: null,
        deletedBy: null,
        deletedByEmail: null,
        status: companyData.originalStatus || "active",
      })

    // 4. Restore all associated users
    const usersSnapshot = await db
      .collection(tenantUsersPath)
      .where("companyId", "==", companyId)
      .where("deletionScheduled", "==", true)
      .get()

    const restorePromises = []
    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data()
      const uid = userData.uid || userData.firebaseUid

      // Restore user
      restorePromises.push(
        db
          .collection(tenantUsersPath)
          .doc(userDoc.id)
          .update({
            deletionScheduled: false,
            deletionDate: null,
            deletedBy: null,
            deletedByEmail: null,
            status: userData.originalStatus || "active",
          }),
      )

      // Re-enable in Firebase Auth
      if (uid) {
        restorePromises.push(
          auth.updateUser(uid, { disabled: false }).catch((err) => {
            console.warn(`[WARN] No se pudo habilitar usuario Auth ${uid}: ${err.message}`)
          }),
        )
      }
    })

    await Promise.all(restorePromises)

    // 5. Log the action
    await logAction({
      tenantId: req.tenantId,
      action: "revert-delete-company",
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      target: `companies/${companyId}`,
      message: "Eliminación de empresa revertida",
      meta: {
        companyName,
        companyId,
        restoredUsers: usersSnapshot.size,
        hoursBeforeExpiry: 24 - hoursDiff,
      },
    })

    console.log(`[OK] Eliminación de empresa ${companyName} revertida con ${usersSnapshot.size} usuarios.`)
    res.json({
      success: true,
      message: "Eliminación revertida exitosamente. La empresa y sus usuarios están activos nuevamente.",
    })
  } catch (error) {
    console.error("[ERROR] Al revertir eliminación de empresa:", error)
    res.status(500).json({
      error: "Error al revertir eliminación de empresa",
      details: error.message,
    })
  }
})

// ✅ Cleanup expired deletions (run this periodically)
router.post("/cleanup-expired-deletions", authenticateFirebaseUser, requireRole("max"), async (req, res) => {
  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Usar la colección de administradores del tenant
    const tenantAdminsPath = req.getTenantCollectionPath('admins');

    // Find expired admin deletions
    const expiredAdminsSnapshot = await db
      .collection(tenantAdminsPath)
      .where("deletionScheduled", "==", true)
      .where("deletionDate", "<=", twentyFourHoursAgo)
      .get()

    // Find expired company deletions
    const expiredCompaniesSnapshot = await db
      .collection("companies")
      .where("deletionScheduled", "==", true)
      .where("deletionDate", "<=", twentyFourHoursAgo)
      .get()

    let deletedAdmins = 0
    let deletedCompanies = 0

    // Delete expired admins
    for (const adminDoc of expiredAdminsSnapshot.docs) {
      const adminData = adminDoc.data()
      const uid = adminData.uid || adminData.firebaseUid

      // Delete from Firebase Auth
      if (uid) {
        try {
          await auth.deleteUser(uid)
        } catch (authError) {
          console.warn(`[WARN] No se pudo eliminar usuario Auth ${uid}: ${authError.message}`)
        }
      }

      // Delete from Firestore
      await adminDoc.ref.delete()
      deletedAdmins++
    }

    // Delete expired companies and their documents
    const tenantUploadedDocsPath = req.getTenantCollectionPath('uploadedDocuments');
    const tenantRequiredDocsPath = req.getTenantCollectionPath('requiredDocuments');
    
    for (const companyDoc of expiredCompaniesSnapshot.docs) {
      const companyData = companyDoc.data()
      const companyId = companyDoc.id

      // Delete all uploaded documents
      const uploadedDocsSnapshot = await db.collection(tenantUploadedDocsPath).where("companyId", "==", companyId).get()

      for (const doc of uploadedDocsSnapshot.docs) {
        await doc.ref.delete()
      }

      // Delete all required documents
      const requiredDocsSnapshot = await db.collection(tenantRequiredDocsPath).where("companyId", "==", companyId).get()

      for (const doc of requiredDocsSnapshot.docs) {
        await doc.ref.delete()
      }

      // Delete the company
      await companyDoc.ref.delete()
      deletedCompanies++
    }

    // Log the cleanup action
    await logAction({
      tenantId: req.tenantId,
      action: "cleanup-expired-deletions",
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      target: "system/cleanup",
      message: "Limpieza de eliminaciones expiradas",
      meta: {
        deletedAdmins,
        deletedCompanies,
        tenantId: req.tenantId
      },
    })

    console.log(`[OK] Limpieza completada: ${deletedAdmins} administradores y ${deletedCompanies} empresas eliminadas.`)
    res.json({
      success: true,
      message: `Limpieza completada: ${deletedAdmins} administradores y ${deletedCompanies} empresas eliminadas.`,
      deletedAdmins,
      deletedCompanies,
    })
  } catch (error) {
    console.error("[ERROR] En limpieza de eliminaciones expiradas:", error)
    res.status(500).json({
      error: "Error en limpieza de eliminaciones expiradas",
      details: error.message,
    })
  }
})

// ✅ Delete admin user immediately
router.post("/delete-admin-immediately", authenticateFirebaseUser, requireRole("max"), async (req, res) => {
  const { userId, userUid } = req.body

  if (!userId) {
    return res.status(400).json({ error: "userId es requerido" })
  }

  try {
    // Usar la colección de usuarios del tenant (donde están los administradores)
    const tenantUsersPath = req.getTenantCollectionPath('users');
    
    // 1. Get user data before deleting
    const userDoc = await db.collection(tenantUsersPath).doc(userId).get()
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Administrador no encontrado en este tenant" })
    }

    const userData = userDoc.data()
    const email = userData.email || "Sin email"

    // 2. Delete admin's private folder if exists
    const privateFolderQuery = await db.collection("adminFolders")
      .where("ownerId", "==", userId)
      .where("visibility", "==", "private")
      .limit(1)
      .get()
    
    if (!privateFolderQuery.empty) {
      await privateFolderQuery.docs[0].ref.delete()
    }

    // 3. Delete from Firebase Auth
    if (userUid) {
      try {
        await auth.deleteUser(userUid)
      } catch (authError) {
        console.warn(`[WARN] No se pudo eliminar usuario Auth ${userUid}: ${authError.message}`)
      }
    }

    // 4. Delete from Firestore
    await userDoc.ref.delete()

    // 5. Log the action
    await logAction({
      tenantId: req.tenantId,
      action: "delete-admin-immediately",
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      target: `${tenantAdminsPath}/${userId}`,
      message: "Administrador eliminado inmediatamente",
      meta: {
        targetUserEmail: email,
        targetUserUid: userUid,
        privateFolderDeleted: !privateFolderQuery.empty,
        tenantId: req.tenantId
      },
    })

    console.log(`[OK] Administrador ${email} eliminado inmediatamente.`)
    res.json({
      success: true,
      message: "Administrador y su carpeta privada eliminados exitosamente",
    })
  } catch (error) {
    console.error("[ERROR] Al eliminar administrador:", error)
    res.status(500).json({
      error: "Error al eliminar administrador",
      details: error.message,
    })
  }
})

// ✅ Endpoint seguro para eliminar documento requerido
router.post(
  '/delete-required-document',
  authenticateFirebaseUser,
  requireRole('max'),
  async (req, res) => {
    const { docId } = req.body;

    if (!docId) {
      return res.status(400).json({ error: 'docId es requerido' });
    }

    try {
      // Usar rutas de tenant
      const tenantRequiredDocsPath = req.getTenantCollectionPath('requiredDocuments');
      const tenantCompaniesPath = req.getTenantCollectionPath('companies');
      
      // 1. Verificar si el documento existe
      const docRef = db.collection(tenantRequiredDocsPath).doc(docId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return res.status(404).json({ error: 'Documento no encontrado en este tenant' });
      }

      // 🟢 Obtener companyId y companyName antes de borrar
      const docData = docSnap.data();
      const companyId = docData.companyId || '';
      let companyName = '';
      if (companyId) {
        const companyDoc = await db.collection(tenantCompaniesPath).doc(companyId).get();
        const companyData = companyDoc.exists ? companyDoc.data() : {};
        companyName = companyData.name || companyData.companyName || '';
      }

      // 2. Eliminar el documento
      await docRef.delete();

      // 3. Registrar la acción
      await logAction({
        tenantId: req.tenantId,
        action: 'delete-required-document',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        target: `requiredDocuments/${docId}`,
        message: 'Documento requerido eliminado',
        meta: {
          documentName: docData.name || 'Sin nombre',
          companyName,
          companyId
        }
      });

      res.json({ success: true, message: 'Documento eliminado correctamente' });
    } catch (error) {
      console.error('[ERROR] Al eliminar documento requerido:', error);
      res.status(500).json({
        error: 'Error al eliminar documento',
        details: error.message,
      });
    }
  }
);

// ✅ Endpoint para eliminación múltiple
export async function deleteRequiredDocumentsBatch(docIds, tenantId) {
  const batch = db.batch();
  const tenantRequiredDocsPath = `tenants/${tenantId}/requiredDocuments`;
  
  docIds.forEach(docId => {
    const docRef = db.collection(tenantRequiredDocsPath).doc(docId);
    batch.delete(docRef);
  });

  await batch.commit();
}

router.post(
  '/delete-required-documents',
  authenticateFirebaseUser,
  requireRole('max'),
  async (req, res) => {
    const { docIds } = req.body;

    if (!docIds || !Array.isArray(docIds)) {
      return res.status(400).json({ error: 'docIds debe ser un array' });
    }

    try {
      // Usar rutas de tenant
      const tenantRequiredDocsPath = req.getTenantCollectionPath('requiredDocuments');
      const tenantCompaniesPath = req.getTenantCollectionPath('companies');
      
      // 🟢 Obtener companyId y companyName si todos los documentos pertenecen a la misma empresa
      let companyId = '';
      let companyName = '';
      if (docIds.length > 0) {
        // Buscar el primer documento para obtener el companyId
        const firstDoc = await db.collection(tenantRequiredDocsPath).doc(docIds[0]).get();
        const firstData = firstDoc.exists ? firstDoc.data() : {};
        companyId = firstData.companyId || '';
        if (companyId) {
          const companyDoc = await db.collection(tenantCompaniesPath).doc(companyId).get();
          const companyData = companyDoc.exists ? companyDoc.data() : {};
          companyName = companyData.name || companyData.companyName || '';
        }
      }
      
      // Eliminar documentos usando batch
      const batch = db.batch();
      docIds.forEach(docId => {
        const docRef = db.collection(tenantRequiredDocsPath).doc(docId);
        batch.delete(docRef);
      });
      await batch.commit();
      
      await logAction({
        tenantId: req.tenantId,
        action: 'delete-required-documents',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        target: `requiredDocuments/batch-delete`,
        message: `Eliminados ${docIds.length} documentos requeridos`,
        meta: {
          count: docIds.length,
          companyName,
          companyId
        }
      });

      res.json({ success: true, message: `Documentos eliminados: ${docIds.length}` });
    } catch (error) {
      console.error('[ERROR] Al eliminar documentos requeridos:', error);
      res.status(500).json({
        error: 'Error al eliminar documentos',
        details: error.message,
      });
    }
  }
);

// ✅ Endpoint para actualizar contraseña de empresa
router.post(
  '/update-company-password',
  authenticateFirebaseUser,
  requireRole(['admin', 'max']),
  async (req, res) => {
    const { companyId, newPassword } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
      // Usar rutas de tenant
      const tenantCompaniesPath = req.getTenantCollectionPath('companies');
      
      // 1. Verificar que la empresa existe
      const companyDoc = await db.collection(tenantCompaniesPath).doc(companyId).get();
      if (!companyDoc.exists) {
        return res.status(404).json({ error: 'Empresa no encontrada' });
      }

      const companyData = companyDoc.data();
      const companyEmail = companyData.email || companyData.realEmail;

      if (!companyEmail) {
        return res.status(400).json({ error: 'La empresa no tiene un email válido' });
      }

      // 2. Actualizar contraseña en Firebase Auth
      try {
        // Buscar el usuario por email
        const userRecord = await auth.getUserByEmail(companyEmail);
        
        // Actualizar la contraseña
        await auth.updateUser(userRecord.uid, {
          password: newPassword
        });

        console.log(`[OK] Contraseña actualizada para empresa ${companyData.companyName || companyData.name} (${companyEmail})`);
      } catch (authError) {
        console.error('[ERROR] Al actualizar contraseña en Firebase Auth:', authError);
        return res.status(500).json({ 
          error: 'Error al actualizar contraseña en Firebase Auth',
          details: authError.message 
        });
      }

      // 3. Registrar la acción
      await logAction({
        tenantId: req.tenantId,
        action: 'update-company-password',
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        target: `companies/${companyId}`,
        message: 'Contraseña de empresa actualizada',
        meta: {
          companyName: companyData.companyName || companyData.name,
          companyEmail,
          updatedBy: req.user.email
        }
      });

      res.json({ 
        success: true, 
        message: 'Contraseña actualizada correctamente' 
      });
    } catch (error) {
      console.error('[ERROR] Al actualizar contraseña de empresa:', error);
      res.status(500).json({
        error: 'Error al actualizar contraseña',
        details: error.message,
      });
    }
  }
);

// ✅ Endpoint de prueba para verificar que las rutas funcionan
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes working correctly' });
});

// ✅ Endpoint para debuggear el rol del usuario
router.get('/debug-user', authenticateFirebaseUser, async (req, res) => {
  try {
    const db = admin.firestore();
    const uid = req.user?.uid;
    const tenantId = req.tenantId;
    
    // Buscar en usuarios
    const tenantUsersPath = `tenants/${tenantId}/users`;
    const userDoc = await db.collection(tenantUsersPath).doc(uid).get();
    
    // Buscar en administradores
    const tenantAdminsPath = `tenants/${tenantId}/admins`;
    const adminDoc = await db.collection(tenantAdminsPath).doc(uid).get();
    
    // Buscar en la colección global de administradores (fallback)
    const globalAdminsPath = 'admins';
    const globalAdminDoc = await db.collection(globalAdminsPath).doc(uid).get();
    
    res.json({
      message: 'Información del usuario autenticado',
      user: {
        uid: req.user?.uid,
        email: req.user?.email,
        role: req.user?.role,
        companyId: req.user?.companyId
      },
      tenant: {
        id: tenantId,
        usersPath: tenantUsersPath,
        adminsPath: tenantAdminsPath
      },
      searchResults: {
        foundInUsers: userDoc.exists,
        foundInAdmins: adminDoc.exists,
        foundInGlobalAdmins: globalAdminDoc.exists,
        userData: userDoc.exists ? userDoc.data() : null,
        adminData: adminDoc.exists ? adminDoc.data() : null,
        globalAdminData: globalAdminDoc.exists ? globalAdminDoc.data() : null
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error al buscar información del usuario',
      details: error.message
    });
  }
});

export default router;
