// backend/routes/registerDocument.js
// Registra un documento en Firestore después de que el frontend subió el archivo a ControlFile.
// Contiene la misma lógica de negocio que upload.js pero sin la parte de subida a Backblaze.
//
// POST /api/register-document
// Body: { fileId, fileName, fileType, fileSize, folder, metadata }
// Returns: { success, docId }

import express from 'express';
import { db } from '../firebaseconfig.js';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';

const router = express.Router();

router.post('/', authenticateFirebaseUser, async (req, res) => {
  try {
    const { fileId, fileName, fileType, fileSize, folder, metadata = {} } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'fileId es requerido' });
    }
    if (!fileName) {
      return res.status(400).json({ error: 'fileName es requerido' });
    }

    const isAdminRequest = metadata.isAdmin === true || req.body.isAdmin === 'true';
    if (isAdminRequest && req.user.role !== 'admin' && req.user.role !== 'max') {
      return res.status(403).json({ error: 'Se requieren privilegios de administrador' });
    }

    const ext = fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : '';
    const expirationValue = metadata.expirationDate || metadata.vencimiento || null;
    if (expirationValue && isNaN(new Date(expirationValue))) {
      return res.status(400).json({ error: 'Formato de fecha inválido' });
    }

    const effectiveFolder = folder || (isAdminRequest ? 'admin/general' : `empresas/${req.user.companyId}`);

    // ── CASO 1: Backup ZIP ────────────────────────────────────────────────────
    if (metadata.type === 'backup' && ext === '.zip') {
      const backupInfo = metadata.backupInfo || {};
      const documentMetadata = backupInfo.metadata || {};

      const companyIds = documentMetadata.companyIds || [];
      const companyNames = documentMetadata.companyNames || [];
      const entityTypes = documentMetadata.entityTypes || [];
      const entityNames = documentMetadata.entityNames || [];
      const documentNames = documentMetadata.documentNames || [];

      const backupData = {
        name: metadata.name || fileName.split('.')[0],
        fileName,
        fileType: fileType || '',
        fileSize: fileSize || 0,
        fileId,                          // ← ControlFile fileId
        uploadedAt: new Date(),
        uploadedBy: req.user.uid,
        uploadedByEmail: req.user.email,
        backupInfo,
        comentario: metadata.comentario || '',
        companyIds,
        companyNames,
        entityTypes,
        entityNames,
        documentNames,
        companyId: companyIds.length === 1 ? companyIds[0] : (companyIds.length > 1 ? 'multiple' : null),
        companyName: companyNames.length === 1 ? companyNames[0] : (companyNames.length > 1 ? 'Multiple' : 'Todos'),
        documentCount: documentMetadata.documentCount || 0,
        companiesCount: documentMetadata.companiesCount || 0,
        entitiesCount: documentMetadata.entitiesCount || 0,
        backupType: backupInfo.tipo || 'unknown',
      };

      const tenantBackupsPath = req.getTenantCollectionPath('backups');
      const ref = await db.collection(tenantBackupsPath).add(backupData);
      console.log('✅ Backup registrado en Firestore:', ref.id);
      return res.json({ success: true, fileId, fileName, docId: ref.id });
    }

    // ── CASO 2: Carpeta de admin ──────────────────────────────────────────────
    if (effectiveFolder.startsWith('admin/folders/')) {
      const folderName = effectiveFolder.replace('admin/folders/', '');

      const fileData = {
        fileName,
        fileDescription: metadata.fileDescription || '',
        fileType: fileType || '',
        fileId,                          // ← ControlFile fileId
        size: fileSize || 0,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user.uid,
        uploadedByEmail: req.user.email,
        uploadedByName: req.user.displayName || '',
        folderPath: folderName,
        documentCategory: metadata.documentCategory || '',
        entityType: metadata.entityType || '',
        entityId: metadata.entityId || '',
        entityName: metadata.entityName || '',
        visibility: metadata.visibility || 'private',
        permissions: metadata.permissions || ['max'],
        versionNumber: metadata.versionNumber || 1,
        versionHistory: metadata.versionHistory || [],
        analyzed: metadata.analyzed || false,
        analysisData: metadata.analysisData || {},
      };

      const adminFoldersPath = req.getTenantCollectionPath('adminFolders');
      const fileRef = db.collection(`${adminFoldersPath}/${folderName}/files`).doc();
      await fileRef.set(fileData);
      console.log('✅ Archivo de admin folder registrado:', fileRef.id);
      return res.json({ success: true, fileId, fileName, docId: fileRef.id });
    }

    // ── CASO 3: Documento normal ──────────────────────────────────────────────
    const mainCompanyId = req.user.companyId;
    const activeCompanyId = metadata.activeCompanyId || mainCompanyId;
    const clientId = (metadata.entityClientId !== undefined && metadata.entityClientId !== null)
      ? metadata.entityClientId
      : ((activeCompanyId && activeCompanyId !== mainCompanyId) ? activeCompanyId : null);

    const docData = {
      name: metadata.name || fileName.split('.')[0],
      documentType: metadata.documentType || '',
      fileName,
      fileType: fileType || '',
      fileSize: fileSize || 0,
      fileId,                            // ← ControlFile fileId (no fileURL)
      uploadedAt: new Date(),
      status: 'Pendiente de revisión',
      uploadedBy: req.user.uid,
      uploadedByEmail: req.user.email,
      comentario: metadata.comentario || '',
      vencimiento: expirationValue,
      expirationDate: expirationValue,
      entityType: metadata.entityType || '',
      entityId: metadata.entityId || metadata.companyId || req.user.companyId,
      entityName: metadata.entityName || '',
      category: metadata.category || '',
      ...(isAdminRequest ? { isAdminUpload: true } : { companyId: req.user.companyId }),
      ...(metadata.companyId && { companyId: metadata.companyId }),
      clientId,
      requiredDocumentId: metadata.documentType || '',
      versionNumber: 1,
      versionString: '1.0',
      versionId: null,
    };

    const tenantDocumentsPath = req.getTenantCollectionPath('uploadedDocuments');

    // Verificar duplicados (mismo companyId + entityType + entityId + requiredDocumentId)
    const existingQuery = db.collection(tenantDocumentsPath)
      .where('companyId', '==', docData.companyId)
      .where('entityType', '==', docData.entityType)
      .where('entityId', '==', docData.entityId || docData.companyId)
      .where('requiredDocumentId', '==', docData.requiredDocumentId);

    const existingDocs = await existingQuery.get();

    // Calcular versión máxima desde uploadedDocuments
    let maxVersion = 0;
    for (const doc of existingDocs.docs) {
      const v = doc.data().versionNumber || 0;
      if (v > maxVersion) maxVersion = v;
    }

    // Calcular versión máxima desde approvedDocuments (mismo clientId)
    try {
      const approvedPath = req.getTenantCollectionPath('approvedDocuments');
      const approvedQuery = db.collection(approvedPath)
        .where('companyId', '==', docData.companyId)
        .where('entityId', '==', docData.entityId || docData.companyId)
        .where('requiredDocumentId', '==', docData.requiredDocumentId || '');

      const approvedDocs = await approvedQuery.get();
      for (const doc of approvedDocs.docs) {
        const data = doc.data();
        if ((data.clientId || null) === clientId) {
          const v = data.versionNumber || data.version || 0;
          if (v > maxVersion) maxVersion = v;
        }
      }
    } catch (err) {
      console.warn('Error buscando en approvedDocuments:', err.message);
    }

    docData.versionNumber = maxVersion + 1;
    docData.versionString = `${maxVersion + 1}.0`;

    let docId;
    if (!existingDocs.empty) {
      // Re-upload: actualizar doc existente, resetear a Pendiente de revisión
      const existingDoc = existingDocs.docs[0];
      delete docData.reviewedAt;
      delete docData.reviewedBy;
      delete docData.approvedAt;
      delete docData.approvedBy;
      docData.uploadedAt = new Date();
      docData.uploadedBy = req.user.uid;
      docData.uploadedByEmail = req.user.email;

      await existingDoc.ref.update(docData);
      docId = existingDoc.id;
      console.log(`✅ Documento actualizado (re-upload): ${docId}, versión ${docData.versionNumber}`);
    } else {
      const newRef = await db.collection(tenantDocumentsPath).add(docData);
      docId = newRef.id;
      console.log(`✅ Documento creado: ${docId}, versión ${docData.versionNumber}`);
    }

    return res.json({ success: true, fileId, fileName, docId });

  } catch (error) {
    console.error('❌ Error en /api/register-document:', error.message || error);
    return res.status(500).json({ error: 'Error al registrar documento: ' + error.message });
  }
});

export default router;
