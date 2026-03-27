//backend/utils/generateMonthlyBackup.js
import { PDFDocument } from 'pdf-lib';
import archiver from 'archiver';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../firebaseconfig.js';
import { uploadFile } from '../services/backblazeService.js';
import { logAction } from './logAction.js';

const MAX_FILE_SIZE_MB = 500;
const BACKUP_DIR = process.env.BACKUP_DIR || '/tmp';
const MAX_PARALLEL_DOWNLOADS = 5;

export async function generateMonthlyBackup(tenantId = 'default') {
  try {
    const today = new Date();
    if (today.getDate() !== 28) {
      throw new Error('Backup solo permitido el día 28');
    }

    // Usar rutas del tenant
    const tenantApprovedDocsPath = `tenants/${tenantId}/approvedDocuments`;
    const tenantCompaniesPath = `tenants/${tenantId}/companies`;
    const tenantBackupsPath = `tenants/${tenantId}/backups`;

    // 1. Obtener datos en paralelo usando rutas del tenant
    const [docsSnapshot, companiesSnap] = await Promise.all([
      db.collection(tenantApprovedDocsPath).get(),
      db.collection(tenantCompaniesPath).get()
    ]);

    // 2. Mapear empresas y clientes más eficientemente
    const companyMap = companiesSnap.docs.reduce((acc, doc) => {
      const data = doc.data();
      acc[doc.id] = data.companyName || `Empresa-${doc.id}`;
      return acc;
    }, {});

    // Mapa de clientes (empresas con type === 'client')
    const clientMap = companiesSnap.docs.reduce((acc, doc) => {
      const data = doc.data();
      if (data.type === 'client') {
        acc[doc.id] = data.companyName || `Cliente-${doc.id}`;
      }
      return acc;
    }, {});

    // 3. Estructurar documentos optimizado + Extraer metadata agregada
    const metadata = {
      companyIds: new Set(),
      companyNames: new Set(),
      clientIds: new Set(),
      clientNames: new Set(),
      entityTypes: new Set(),
      entityNames: new Set(),
      documentNames: new Set()
    };

    const estructura = docsSnapshot.docs.reduce((acc, doc) => {
      const data = doc.data();
      const companyName = companyMap[data.companyId] || 'Desconocida';
      const clientName = data.clientId ? (clientMap[data.clientId] || 'Principal') : 'Principal';
      
      // Extraer metadata agregada
      if (data.companyId) {
        metadata.companyIds.add(data.companyId);
        metadata.companyNames.add(companyName);
      }
      if (data.clientId) {
        metadata.clientIds.add(data.clientId);
        metadata.clientNames.add(clientName);
      }
      if (data.entityType) metadata.entityTypes.add(data.entityType);
      if (data.entityName) metadata.entityNames.add(data.entityName);
      const docName = data.originalName || data.name || data.documentName;
      if (docName) metadata.documentNames.add(docName);
      
      // Agrupar por empresa y cliente
      const groupKey = `${companyName}${clientName !== 'Principal' ? `_${clientName}` : ''}`;
      acc[groupKey] = acc[groupKey] || {};
      acc[groupKey][data.entityType || 'otros'] = acc[groupKey][data.entityType || 'otros'] || {};
      acc[groupKey][data.entityType || 'otros'][data.entityName || 'general'] = 
        acc[groupKey][data.entityType || 'otros'][data.entityName || 'general'] || {};
      // Usar originalName como prioridad para agrupamiento en backup mensual
      const documentName = data.originalName || data.name || data.documentName || 'documento';
      acc[groupKey][data.entityType || 'otros'][data.entityName || 'general'][documentName] = 
        (acc[groupKey][data.entityType || 'otros'][data.entityName || 'general'][documentName] || [])
        .concat({ url: data.fileURL, clientId: data.clientId, clientName });

      return acc;
    }, {});
    
    // Convertir Sets a Arrays
    const aggregatedMetadata = {
      companyIds: Array.from(metadata.companyIds),
      companyNames: Array.from(metadata.companyNames),
      clientIds: Array.from(metadata.clientIds),
      clientNames: Array.from(metadata.clientNames),
      entityTypes: Array.from(metadata.entityTypes),
      entityNames: Array.from(metadata.entityNames),
      documentNames: Array.from(metadata.documentNames),
      documentCount: docsSnapshot.size,
      companiesCount: metadata.companyIds.size,
      clientsCount: metadata.clientIds.size,
      entitiesCount: metadata.entityNames.size
    };

    // 4. Crear ZIP con manejo de errores
    const zipPath = path.join(BACKUP_DIR, `backup-${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('warning', err => logAction({
      tenantId,
      action: 'BACKUP_WARNING',
      actorUid: 'system',
      actorEmail: 'system@controldoc.app',
      actorRole: 'system',
      target: 'system/backup',
      message: 'Advertencia en backup',
      meta: { error: err.message }
    }));
    archive.on('error', err => {
      throw new Error(`Error al crear ZIP: ${err.message}`);
    });

    archive.pipe(output);

    // 5. Procesar PDFs en paralelo por grupo
    const processingPromises = [];
    for (const [groupKey, entityTypes] of Object.entries(estructura)) {
      for (const [entityType, entidades] of Object.entries(entityTypes)) {
        for (const [entityName, docsPorNombre] of Object.entries(entidades)) {
          for (const [nombreDoc, urls] of Object.entries(docsPorNombre)) {
            if (!urls.length) continue;
            
            processingPromises.push(
              processDocumentGroup(archive, groupKey, entityType, entityName, nombreDoc, urls, tenantId)
            );
          }
        }
      }
    }

    await Promise.all(processingPromises);
    await archive.finalize();

    // 6. Subir y registrar backup con mejoras
    const zipBuffer = fs.readFileSync(zipPath);
    if (zipBuffer.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
      fs.unlinkSync(zipPath); // Limpiar archivo temporal antes de lanzar error
      throw new Error(`El archivo ZIP supera el límite de ${MAX_FILE_SIZE_MB}MB`);
    }

    // Formato de fecha y hora para el nombre del backup
    const fechaHora = today.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '-')
      .slice(0, 16);
    const backupFileName = `backup-${tenantId}-${fechaHora}.zip`;

    // Subir a Backblaze
    const uploadResult = await uploadFile(zipBuffer, 'application/zip', {
      folder: 'backups',
      fileName: backupFileName
    });

    // Verificar duplicados usando ruta del tenant
    const existingBackup = await db.collection(tenantBackupsPath)
      .where('fileName', '==', backupFileName)
      .limit(1)
      .get();

    if (!existingBackup.empty) {
      await logAction({
        tenantId,
        action: 'BACKUP_DUPLICATE_WARNING',
        actorUid: 'system',
        actorEmail: 'system@controldoc.app',
        actorRole: 'system',
        target: 'system/backup',
        message: 'Backup con este nombre ya existe',
        meta: { fileName: backupFileName }
      });
    }

    // Guardar en Firestore del tenant con metadatos adicionales
    const backupData = {
      name: `Backup Mensual ${today.toISOString().slice(0,10)}`,
      fileName: backupFileName,
      fileType: 'application/zip',
      fileSize: zipBuffer.length,
      fileURL: uploadResult.url,
      uploadedAt: new Date(),
      uploadedBy: 'system',
      uploadedByEmail: 'system@controldoc.app',
      backupInfo: {
        tipo: 'monthly',
        metadata: aggregatedMetadata
      },
      comentario: 'Backup mensual automático',
      // Metadata agregada del contenido
      companyIds: aggregatedMetadata.companyIds,
      companyNames: aggregatedMetadata.companyNames,
      entityTypes: aggregatedMetadata.entityTypes,
      entityNames: aggregatedMetadata.entityNames,
      documentNames: aggregatedMetadata.documentNames,
      // Campos para filtrado rápido
      companyId: aggregatedMetadata.companyIds.length === 1 ? aggregatedMetadata.companyIds[0] : 
                 (aggregatedMetadata.companyIds.length > 1 ? 'multiple' : null),
      companyName: aggregatedMetadata.companyNames.length === 1 ? aggregatedMetadata.companyNames[0] :
                   (aggregatedMetadata.companyNames.length > 1 ? 'Multiple' : 'Todos'),
      documentCount: aggregatedMetadata.documentCount,
      companiesCount: aggregatedMetadata.companiesCount,
      entitiesCount: aggregatedMetadata.entitiesCount,
      backupType: 'monthly',
      status: 'completed',
      isTemporary: false,
      checksum: crypto.createHash('sha256').update(zipBuffer).digest('hex'),
      tenantId: tenantId
    };

    await db.collection(tenantBackupsPath).add(backupData);

    // Eliminar archivo temporal
    try {
      fs.unlinkSync(zipPath);
      await logAction({
        tenantId,
        action: 'BACKUP_CLEANUP_SUCCESS',
        actorUid: 'system',
        actorEmail: 'system@controldoc.app',
        actorRole: 'system',
        target: 'system/backup',
        message: 'Limpieza de archivo temporal exitosa',
        meta: {
          path: zipPath,
          size: `${(zipBuffer.length / (1024 * 1024)).toFixed(2)}MB`
        }
      });
    } catch (cleanupError) {
      await logAction({
        tenantId,
        action: 'BACKUP_CLEANUP_FAILED',
        actorUid: 'system',
        actorEmail: 'system@controldoc.app',
        actorRole: 'system',
        target: 'system/backup',
        message: 'Error en limpieza de archivo temporal',
        meta: {
          error: cleanupError.message,
          path: zipPath
        }
      });
    }

    await logAction({
      tenantId,
      action: 'BACKUP_SUCCESS',
      actorUid: 'system',
      actorEmail: 'system@controldoc.app',
      actorRole: 'system',
      target: 'system/backup',
      message: 'Backup mensual completado exitosamente',
      meta: {
        size: zipBuffer.length,
        url: uploadResult.url,
        fileName: backupFileName,
        documentCount: Object.keys(estructura).length
      }
    });

    return {
      url: uploadResult.url,
      fileName: backupFileName,
      size: zipBuffer.length
    };

  } catch (error) {
    await logAction({
      tenantId: tenantId || 'default',
      action: 'BACKUP_FAILED',
      actorUid: 'system',
      actorEmail: 'system@controldoc.app',
      actorRole: 'system',
      target: 'system/backup',
      message: 'Error en backup mensual',
      meta: { 
        error: error.message,
        stack: error.stack 
      }
    });
    throw error;
  }
}

async function processDocumentGroup(archive, groupKey, entityType, entityName, nombreDoc, urls, tenantId) {
  try {
    // Extraer URLs del nuevo formato (puede ser array de strings o array de objetos)
    const urlArray = urls.map(item => typeof item === 'string' ? item : item.url).filter(Boolean);
    const merged = await mergePDFs(urlArray, tenantId);
    const buffer = await merged.save();
    // groupKey ya incluye empresa y cliente si aplica
    const safePath = `${groupKey}/${entityType}/${entityName}/${nombreDoc}.pdf`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-./]/g, '');
    
    archive.append(buffer, { name: safePath });
  } catch (error) {
    logAction({
      tenantId,
      action: 'PDF_MERGE_ERROR',
      actorUid: 'system',
      actorEmail: 'system@controldoc.app',
      actorRole: 'system',
      target: 'system/backup',
      message: 'Error al fusionar PDFs',
      meta: {
        document: nombreDoc,
        error: error.message
      }
    });
    throw error;
  }
}

async function mergePDFs(urls, tenantId) {
  const mergedPdf = await PDFDocument.create();
  const validUrls = urls.filter(url => 
    url && url.startsWith('https://cdn.controldoc.app/')
  );

  // Procesar PDFs en paralelo
  const pdfs = await Promise.all(
    validUrls.map(async url => {
      try {
        const response = await axios.get(url, { 
          responseType: 'arraybuffer',
          maxContentLength: 10 * 1024 * 1024 // 10MB max por archivo
        });
        return PDFDocument.load(response.data);
      } catch (error) {
        logAction({
          tenantId,
          action: 'PDF_DOWNLOAD_ERROR',
          actorUid: 'system',
          actorEmail: 'system@controldoc.app',
          actorRole: 'system',
          target: 'system/backup',
          message: 'Error al descargar PDF',
          meta: { url, error: error.message }
        });
        return null;
      }
    })
  );

  // Merge solo de PDFs válidos
  for (const pdf of pdfs.filter(Boolean)) {
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }

  return mergedPdf;
}