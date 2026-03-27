// backend/routes/delete-admin.js
import { Router } from "express"
import { db, auth } from "../firebaseconfig.js"
import { authenticateFirebaseUser } from "../middleware/authenticateFirebaseUser.js"
import { requireRole } from "../middleware/requireRole.js"
import { logAction } from "../utils/logAction.js"
import { initB2 } from '../services/backblazeService.js';
import axios from 'axios';

async function deleteFileFromBackblaze(fileURL, authData) {
    const regex = /\/file\/(.+?)\/(.+)/;
    const match = fileURL.match(regex);
    if (!match || match.length < 3) return;
  
    const fileName = match[2];
    if (!fileName) return;
  
    const findRes = await axios.post(
      `${authData.apiUrl}/b2api/v2/b2_list_file_names`,
      {
        bucketId: authData.allowed.bucketId,
        prefix: fileName,
        maxFileCount: 1,
      },
      {
        headers: { Authorization: authData.authorizationToken },
      }
    );
  
    const file = findRes.data.files?.[0];
    if (!file) return;
  
    await axios.post(
      `${authData.apiUrl}/b2api/v2/b2_delete_file_version`,
      {
        fileName: file.fileName,
        fileId: file.fileId,
      },
      {
        headers: { Authorization: authData.authorizationToken },
      }
    );
  }
  
const router = Router()
router.post("/delete-company-immediately", authenticateFirebaseUser, requireRole("max"), async (req, res) => {
    const { companyId } = req.body;
  
    if (!companyId) {
      return res.status(400).json({ error: "companyId es requerido" });
    }
  
        try {
      // Usar rutas de tenant para todas las operaciones
      const tenantCompaniesPath = req.getTenantCollectionPath('companies');
      const tenantUploadedDocsPath = req.getTenantCollectionPath('uploadedDocuments');
      const tenantRequiredDocsPath = req.getTenantCollectionPath('requiredDocuments');
      const tenantUsersPath = req.getTenantCollectionPath('users');
      const tenantPersonalPath = req.getTenantCollectionPath('personal');
      const tenantVehiculosPath = req.getTenantCollectionPath('vehiculos');

      const companyDoc = await db.collection(tenantCompaniesPath).doc(companyId).get();
      if (!companyDoc.exists) {
        return res.status(404).json({ error: "Empresa no encontrada en este tenant" });
      }

      const companyData = companyDoc.data();
      const companyName = companyData.companyName || companyData.name || "";

      const authData = await initB2();

      // 🔴 Eliminar documentos subidos
      const uploadedDocs = await db.collection(tenantUploadedDocsPath).where("companyId", "==", companyId).get();
      for (const doc of uploadedDocs.docs) {
        const fileURL = doc.data().fileURL;
        if (fileURL) {
          try {
            await deleteFileFromBackblaze(fileURL, authData);
          } catch (err) {
            console.warn(`[WARN] No se pudo eliminar archivo B2 (${fileURL}): ${err.message}`);
          }
        }
        await doc.ref.delete();
      }

      // 🔴 Eliminar documentos requeridos
      const requiredDocs = await db.collection(tenantRequiredDocsPath).where("companyId", "==", companyId).get();
      for (const doc of requiredDocs.docs) {
        const fileURL = doc.data().exampleFileURL;
        if (fileURL) {
          try {
            await deleteFileFromBackblaze(fileURL, authData);
          } catch (err) {
            console.warn(`[WARN] No se pudo eliminar archivo ejemplo (${fileURL}): ${err.message}`);
          }
        }
        await doc.ref.delete();
      }

      // 🔴 Eliminar usuarios asociados
      const usersSnapshot = await db.collection(tenantUsersPath).where("companyId", "==", companyId).get();
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const uid = userData.uid || userData.firebaseUid;
        if (uid) {
          try {
            await auth.deleteUser(uid);
          } catch (err) {
            console.warn(`[WARN] No se pudo eliminar usuario Auth (${uid}): ${err.message}`);
          }
        }
        await userDoc.ref.delete();
      }

      // 🔴 Eliminar empleados asociados
      const employeesSnapshot = await db.collection(tenantPersonalPath).where("companyId", "==", companyId).get();
      for (const employeeDoc of employeesSnapshot.docs) {
        await employeeDoc.ref.delete();
      }

      // 🔴 Eliminar vehículos asociados
      const vehiclesSnapshot = await db.collection(tenantVehiculosPath).where("companyId", "==", companyId).get();
      for (const vehicleDoc of vehiclesSnapshot.docs) {
        await vehicleDoc.ref.delete();
      }

      // 🔴 Eliminar la empresa
      await companyDoc.ref.delete();

      await logAction({
        tenantId: req.tenantId,
        action: "delete-company-immediately",
        actorUid: req.user.uid,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        target: `companies/${companyId}`,
        message: "Empresa eliminada inmediatamente",
        meta: {
          companyName,
          deletedUsers: usersSnapshot.size,
          deletedEmployees: employeesSnapshot.size,
          deletedVehicles: vehiclesSnapshot.size,
          deletedUploadedDocs: uploadedDocs.size,
          deletedRequiredDocs: requiredDocs.size,
        },
      });
  
      console.log(`[OK] Empresa ${companyName} eliminada completamente.`);
      res.json({ success: true, message: `Empresa ${companyName} eliminada completamente.` });
  
    } catch (error) {
      console.error("[ERROR] Al eliminar empresa:", error);
      res.status(500).json({
        error: "Error al eliminar empresa",
        details: error.message,
      });
    }
  });
  
export default router;