import express from 'express';
import { uploadFile } from '../services/backblazeService.js';
import { db } from '../firebaseconfig.js';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';
import { cleanFileName } from '../../src/utils/cleanFileName.js';

const router = express.Router();

export default (upload) => {
  router.post('/',
    authenticateFirebaseUser,
    upload.single('file'),
    async (req, res) => {
      try {
        console.log('--- Nueva solicitud de subida recibida ---');
        console.log('Usuario autenticado:', req.user);
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        console.log('Archivo recibido:', req.file && {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        });

        const isAdminRequest = req.body.isAdmin === 'true';
        if (isAdminRequest && req.user.role !== 'admin') {
          console.warn('Intento de subida admin sin privilegios:', req.user.email);
          return res.status(403).json({ error: 'Se requieren privilegios de administrador' });
        }

        if (!req.file?.buffer) {
          console.warn('No se recibió buffer de archivo');
          return res.status(400).json({ error: 'No se recibió ningún archivo válido' });
        }

        if (req.file.size > 400 * 1024 * 1024) {
          console.warn('Archivo excede el tamaño permitido:', req.file.size);
          return res.status(400).json({ error: 'El archivo supera el límite de 400MB (máximo permitido por backup)' });
        }

        const blockedExtensions = ['.exe', '.sh', '.bat', '.cmd', '.scr', '.js', '.msi', '.vbs', '.php', '.py'];
        const lowerName = req.file.originalname.toLowerCase();
        const ext = lowerName.includes('.') ? `.${lowerName.split('.').pop()}` : '';
        if (blockedExtensions.includes(ext)) {
          console.warn('Intento de subida con extensión bloqueada:', ext);
          return res.status(400).json({ error: `La extensión ${ext} no está permitida por razones de seguridad.` });
        }

        const rawFileName = req.body.fileName || req.file.originalname;
        // Si ya viene con timestamp del frontend, usarlo directamente
        // Solo usar cleanFileName si no viene nombre del frontend
        const finalFileName = cleanFileName(rawFileName) || cleanFileName("archivo.zip");

        console.log('Nombre original:', rawFileName, '→ Nombre final:', finalFileName);

        const folder = req.body.folder || (isAdminRequest ? 'admin/general' : `empresas/${req.user.companyId}`);
        const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
        console.log('Folder destino:', folder);
        console.log('Metadata recibida:', metadata);

        // ✅ Subida a Backblaze
        let uploadResult;
        try {
          uploadResult = await uploadFile(req.file.buffer, req.file.mimetype, {
            folder,
            fileName: finalFileName
          });
          console.log('Resultado de uploadFile:', uploadResult);
        } catch (uploadError) {
          console.error('❌ Error al subir a Backblaze:', uploadError.message || uploadError);
          return res.status(500).json({ error: `Error al subir archivo a Backblaze: ${uploadError.message}` });
        }

        if (!uploadResult?.url) {
          console.error('⚠️ Backblaze no devolvió una URL. uploadResult:', uploadResult);
          return res.status(500).json({ error: 'Backblaze no devolvió la URL del archivo' });
        }

        const expirationValue = metadata.expirationDate || metadata.vencimiento || null;
        if (expirationValue && isNaN(new Date(expirationValue))) {
          console.warn('Fecha de expiración inválida:', expirationValue);
          return res.status(400).json({ error: 'Formato de fecha inválido' });
        }

        // --- Lógica para backups ZIP ---
        if (metadata.type === 'backup' && ext === '.zip') {
          const backupInfo = metadata.backupInfo || {};
          const documentMetadata = backupInfo.metadata || {};
          
          // Extraer metadata agregada
          const companyIds = documentMetadata.companyIds || [];
          const companyNames = documentMetadata.companyNames || [];
          const entityTypes = documentMetadata.entityTypes || [];
          const entityNames = documentMetadata.entityNames || [];
          const documentNames = documentMetadata.documentNames || [];
          
          const backupData = {
            name: metadata.name || finalFileName.split('.')[0],
            fileName: finalFileName,
            fileType: req.file.mimetype,
            fileSize: req.file.size,
            fileURL: uploadResult.url,
            uploadedAt: new Date(),
            uploadedBy: req.user.uid,
            uploadedByEmail: req.user.email,
            backupInfo: backupInfo,
            comentario: metadata.comentario || '',
            // Metadata agregada del contenido
            companyIds: companyIds,
            companyNames: companyNames,
            entityTypes: entityTypes,
            entityNames: entityNames,
            documentNames: documentNames,
            // Campos para filtrado rápido (primer companyId si hay uno, null si son múltiples)
            companyId: companyIds.length === 1 ? companyIds[0] : (companyIds.length > 1 ? 'multiple' : null),
            companyName: companyNames.length === 1 ? companyNames[0] : (companyNames.length > 1 ? 'Multiple' : 'Todos'),
            documentCount: documentMetadata.documentCount || 0,
            companiesCount: documentMetadata.companiesCount || 0,
            entitiesCount: documentMetadata.entitiesCount || 0,
            backupType: backupInfo.tipo || 'unknown'
          };
          console.log('Datos a guardar en Firestore (backup):', backupData);
          const tenantBackupsPath = req.getTenantCollectionPath('backups');
          await db.collection(tenantBackupsPath).add(backupData);
          console.log('Backup guardado exitosamente en Firestore.');
          return res.json({ success: true, url: uploadResult.url, fileURL: uploadResult.url, fileName: finalFileName });
        }
        // --- Lógica para archivos de carpetas de admin ---
        if (folder.startsWith('admin/folders/')) {
          const folderName = folder.replace('admin/folders/', '');
          console.log('Guardando archivo en carpeta de admin:', folderName);
          
          const fileData = {
            fileName: finalFileName,
            fileDescription: metadata.fileDescription || '',
            fileType: req.file.mimetype,
            fileId: Date.now().toString() + '_' + Math.random().toString(36).slice(2),
            fileURL: uploadResult.url,
            size: req.file.size,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user.uid,
            uploadedByEmail: req.user.email,
            uploadedByName: req.user.displayName || '',
            folderPath: folderName,
            // Campos adicionales para compatibilidad con FileStorage
            documentCategory: metadata.documentCategory || '',
            entityType: metadata.entityType || '',
            entityId: metadata.entityId || '',
            entityName: metadata.entityName || '',
            visibility: metadata.visibility || 'private',
            permissions: metadata.permissions || ['max'],
            versionNumber: metadata.versionNumber || 1,
            versionHistory: metadata.versionHistory || [],
            analyzed: metadata.analyzed || false,
            analysisData: metadata.analysisData || {}
          };
          
          const adminFoldersPath = req.getTenantCollectionPath('adminFolders');
          const fileRef = db.collection(`${adminFoldersPath}/${folderName}/files`).doc();
          await fileRef.set(fileData);
          console.log('Archivo guardado en carpeta de admin exitosamente.');
          res.json({ success: true, url: uploadResult.url, fileURL: uploadResult.url, fileName: finalFileName, fileId: fileRef.id });
          return;
        }

        // --- Lógica normal para documentos ---
        // clientId: priorizar el cliente de la entidad (persona/vehículo) para que al subir desde vista principal se mantenga el cliente
        const mainCompanyId = req.user.companyId;
        const activeCompanyId = metadata.activeCompanyId || mainCompanyId;
        const clientId = (metadata.entityClientId !== undefined && metadata.entityClientId !== null)
          ? metadata.entityClientId
          : ((activeCompanyId && activeCompanyId !== mainCompanyId) ? activeCompanyId : null);

        const docData = {
          name: metadata.name || finalFileName.split('.')[0],
          documentType: metadata.documentType || '',
          fileName: finalFileName,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          fileURL: uploadResult.url,
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
          clientId: clientId, // null si es empresa principal, ID del cliente si es subempresa
          requiredDocumentId: metadata.documentType || '',
          // Inicializar campos de versión
          versionNumber: 1,
          versionString: '1.0',
          versionId: null
        };
        console.log('Datos a guardar en Firestore:', docData);

        const tenantDocumentsPath = req.getTenantCollectionPath('uploadedDocuments');
        
        // Verificar si ya existe un documento para evitar duplicados
        console.log('🔍 Buscando duplicados con parámetros:', {
          companyId: docData.companyId,
          entityType: docData.entityType, 
          entityId: docData.entityId,
          requiredDocumentId: docData.requiredDocumentId,
          tenantPath: tenantDocumentsPath
        });
        
        const existingQuery = db.collection(tenantDocumentsPath)
          .where('companyId', '==', docData.companyId)
          .where('entityType', '==', docData.entityType)
          .where('entityId', '==', docData.entityId || docData.companyId)
          .where('requiredDocumentId', '==', docData.requiredDocumentId);
        
        const existingDocs = await existingQuery.get();
        console.log(`🔍 Documentos existentes encontrados: ${existingDocs.docs.length}`);
        
        // Calcular versión correcta basándose en documentos existentes y aprobados
        let nextVersionNumber = 1;
        
        // Buscar en uploadedDocuments
        let maxVersion = 0;
        for (const existingDoc of existingDocs.docs) {
          const existingData = existingDoc.data();
          const versionNum = existingData.versionNumber || 0;
          if (versionNum > maxVersion) {
            maxVersion = versionNum;
          }
        }
        
        // También buscar en approvedDocuments para obtener la versión más alta
        // Usar campos estables: entityId + requiredDocumentId (no name que puede cambiar)
        try {
          const approvedDocumentsPath = req.getTenantCollectionPath('approvedDocuments');
          const documentClientId = docData.clientId || null;
          const entityId = docData.entityId || docData.companyId;
          const requiredDocumentId = docData.requiredDocumentId || '';
          
          // Buscar usando campos estables (entityId + requiredDocumentId)
          // Esto asegura encontrar todas las versiones del mismo documento
          const approvedQuery = db.collection(approvedDocumentsPath)
            .where('companyId', '==', docData.companyId)
            .where('entityId', '==', entityId)
            .where('requiredDocumentId', '==', requiredDocumentId);
          
          const approvedDocs = await approvedQuery.get();
          console.log(`🔍 Documentos aprobados encontrados (entityId=${entityId}, requiredDocumentId=${requiredDocumentId || 'vacío'}): ${approvedDocs.docs.length}`);
          
          for (const approvedDoc of approvedDocs.docs) {
            const approvedData = approvedDoc.data();
            const docClientId = approvedData.clientId || null;
            
            // IMPORTANTE: Solo considerar documentos con el mismo clientId
            // Esto evita que documentos de diferentes clientes afecten el versionado
            if (docClientId === documentClientId) {
              const versionNum = approvedData.versionNumber || approvedData.version || 0;
              if (versionNum > maxVersion) {
                maxVersion = versionNum;
              }
            }
          }
          
          console.log(`📊 Versión máxima encontrada en approvedDocuments (clientId: ${documentClientId || 'null'}): ${maxVersion}`);
        } catch (error) {
          console.warn('Error buscando en approvedDocuments:', error.message);
        }
        
        nextVersionNumber = maxVersion + 1;
        
        // Actualizar docData con la versión correcta
        docData.versionNumber = nextVersionNumber;
        docData.versionString = `${nextVersionNumber}.0`;
        
        if (existingDocs.docs.length > 0) {
          console.log('📄 Documentos duplicados encontrados:', existingDocs.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            entityId: doc.data().entityId,
            companyId: doc.data().companyId,
            status: doc.data().status,
            versionNumber: doc.data().versionNumber || 0
          })));
          console.log(`🔄 Nueva versión calculada: ${nextVersionNumber}`);
        }
        
        let docId;
        if (!existingDocs.empty) {
          // Si existe, actualizar el documento existente
          const existingDoc = existingDocs.docs[0];
          const existingData = existingDoc.data();
          
          // NUEVA LÓGICA: Siempre permitir nueva subida = nueva revisión
          // Un re-upload debe volver siempre a "Pendiente de revisión" 
          // para que el admin pueda revisar la nueva versión del documento
          console.log('Re-upload de documento - estableciendo a Pendiente de revisión');
          
          // Limpiar campos de revisión previa para nueva evaluación
          delete docData.reviewedAt;
          delete docData.reviewedBy;
          delete docData.approvedAt;
          delete docData.approvedBy;
          // Mantener status como "Pendiente de revisión" (ya está seteado en docData)
          // Forzar nueva fecha de subida y usuario de subida
          docData.uploadedAt = new Date();
          docData.uploadedBy = req.user.uid;
          docData.uploadedByEmail = req.user.email;
          
          console.log('Documento existente encontrado, actualizando:', existingDoc.id);
          await existingDoc.ref.update(docData);
          docId = existingDoc.id;
          console.log('Documento actualizado exitosamente en Firestore.');
        } else {
          // Si no existe, crear nuevo documento
          console.log('Creando nuevo documento en Firestore...');
          const newDocRef = await db.collection(tenantDocumentsPath).add(docData);
          docId = newDocRef.id;
          console.log('Nuevo documento creado exitosamente en Firestore con ID:', docId);
        }
        
        // El response es exitoso SOLO si Firestore se ejecutó sin errores arriba
        console.log('✅ Upload proceso completo - Docs en Firestore procesado:', docId);
        res.json({ 
          success: true, 
          url: uploadResult.url, 
          fileURL: uploadResult.url, 
          fileName: finalFileName,
          docId: docId
        });

      } catch (error) {
        console.error('❌ Error general en /api/upload:', error.message || error);
        res.status(500).json({ error: 'Error al procesar la carga: ' + error.message });
      }
    }
  );

  return router;
};
