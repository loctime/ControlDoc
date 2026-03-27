import { useState } from 'react';
import { Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Download } from '@mui/icons-material';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { uploadFile } from '../utils/FileUploadService';
import { marcarArchivosBackupConMetadata } from '../utils/MetadataService';
import { getAuth } from 'firebase/auth';

// Mapea MIME type a extensión
const getExtensionFromType = (type) => {
  const map = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'text/plain': '.txt',
    'application/zip': '.zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return map[type] || '';
};

// Fallback si el tipo MIME no tiene extensión conocida
const guessExtensionFromFilename = (name) => {
  const match = name.match(/\.[^/.]+$/);
  return match ? match[0] : '.bin';
};

// Función helper para extraer metadata agregada de documentos
const extractDocumentsMetadata = (documents) => {
  const metadata = {
    companyIds: new Set(),
    companyNames: new Set(),
    clientIds: new Set(),
    clientNames: new Set(),
    entityTypes: new Set(),
    entityNames: new Set(),
    documentNames: new Set()
  };

  documents.forEach(doc => {
    if (doc.companyId) metadata.companyIds.add(doc.companyId);
    if (doc.companyName) metadata.companyNames.add(doc.companyName);
    if (doc.clientId) metadata.clientIds.add(doc.clientId);
    if (doc.clientName) metadata.clientNames.add(doc.clientName);
    if (doc.entityType) metadata.entityTypes.add(doc.entityType);
    if (doc.entityName) metadata.entityNames.add(doc.entityName);
    const docName = doc.name || doc.filename || doc.documentName;
    if (docName) metadata.documentNames.add(docName);
  });

  return {
    companyIds: Array.from(metadata.companyIds),
    companyNames: Array.from(metadata.companyNames),
    clientIds: Array.from(metadata.clientIds),
    clientNames: Array.from(metadata.clientNames),
    entityTypes: Array.from(metadata.entityTypes),
    entityNames: Array.from(metadata.entityNames),
    documentNames: Array.from(metadata.documentNames),
    documentCount: documents.length,
    companiesCount: metadata.companyIds.size,
    clientsCount: metadata.clientIds.size,
    entitiesCount: metadata.entityNames.size
  };
};

export default function MultiDownloadZipButton({
  files = [], // Array de { url, filename }
  label = 'Descargar ZIP',
  iconOnly = false,
  startIcon = true,
  variant = 'contained',
  size = 'medium',
  disabled = false,
  zipName = 'archivos.zip',
  createBackup = true // Nuevo parámetro para controlar si se crea backup
}) {
  const [loading, setLoading] = useState(false);

  async function subirBackupZip(zipBlob, files = []) {
    console.log('[MultiDownloadZipButton] INICIO subirBackupZip', { files, zipBlob });
    try {
      const fecha = new Date();
      const nombreZip = `backup_${fecha.toISOString().slice(0,10)}.zip`;
      const zipFile = new File([zipBlob], nombreZip, { type: "application/zip" });

      // Extraer metadata agregada de los documentos
      const aggregatedMetadata = extractDocumentsMetadata(files);

      const metadata = {
        type: "backup",
        name: nombreZip,
        fecha: fecha.toISOString(),
        cantidadArchivos: files.length,
        archivos: files.map(f => f.filename),
        comentario: "Backup manual generado por usuario desde ZIP",
        backupInfo: {
          tipo: "manual",
          metadata: aggregatedMetadata
        }
      };
      console.log('[MultiDownloadZipButton] Subiendo ZIP a Backblaze', { nombreZip, metadata, aggregatedMetadata });

      // Subir ZIP y obtener respuesta con la URL pública
      const uploadResponse = await uploadFile(zipFile, "Admin/backups", metadata);
      console.log('[MultiDownloadZipButton] uploadFile response:', uploadResponse);
      const backupURL = uploadResponse?.url || uploadResponse?.fileURL || uploadResponse?.downloadURL || '';
      const backupId = nombreZip;

      // Obtener usuario actual de Firebase
      let user = undefined;
      try {
        const auth = getAuth();
        user = auth.currentUser ? {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          realemail: auth.currentUser.email
        } : undefined;
        console.log('[MultiDownloadZipButton] Usuario detectado:', user);
      } catch (e) {
        user = undefined;
        console.warn('[MultiDownloadZipButton] No se pudo obtener usuario actual', e);
      }

      // Usar la función moderna para marcar metadata en approvedDocuments
      console.log('[MultiDownloadZipButton] Llamando a marcarArchivosBackupConMetadata', {
        files,
        backupType: 'generalBackup',
        backupURL,
        backupId,
        user
      });
      const errores = await marcarArchivosBackupConMetadata({
        files,
        backupType: 'generalBackup',
        backupURL,
        backupId,
        user
      });
      console.log('[MultiDownloadZipButton] Resultado de marcarArchivosBackupConMetadata:', errores);

      if (errores.length > 0) {
        alert('Backup subido, pero algunos archivos no pudieron marcarse en Firestore.');
      } else {
        alert('Backup subido correctamente a Backblaze y Firestore. Archivos marcados como backupeados.');
      }
    } catch (err) {
      console.error('[MultiDownloadZipButton] ERROR en subirBackupZip:', err);
      alert('Error al subir el backup: ' + (err.message || err));
    }
    console.log('[MultiDownloadZipButton] FIN subirBackupZip');
  }

  const handleDownloadZip = async () => {
    console.log('[MultiDownloadZipButton] INICIO handleDownloadZip', { files });
    if (!files || files.length === 0) {
      console.warn('[MultiDownloadZipButton] No hay archivos para descargar');
      return;
    }
    setLoading(true);
    const zip = new JSZip();

    // Clave lógica idéntica al frontend (incluye version y sanitiza)
    function getLogicalGroupKey(file) {
      const clientName = file.clientName || (file.clientId ? 'CLIENTE' : '');
      return [
        file.name || file.documentName || file.nombreOriginal || '',
        file.entityName || '',
        file.entityType === 'vehicle' ? 'VEHICULO' : file.entityType === 'employee' ? 'EMPLEADO' : (file.entityType || ''),
        file.companyName || '',
        clientName,
        file.version || ''
      ]
        .filter(Boolean)
        .join('_')
        .replace(/\s+/g, '_')
        .replace(/[^\w\-\.]/g, '');
    }

    const fileGroups = {};
    await Promise.all(
      files.map(async (file) => {
        try {
          console.log('[MultiDownloadZipButton] Descargando archivo', file);
          const response = await fetch(file.url);
          if (!response.ok) throw new Error(`Error al descargar ${file.filename}`);
          const blob = await response.blob();

          // DEPURACIÓN: loguear tamaño y tipo del blob
          console.log(`[DEPURACIÓN ZIP] Archivo: ${file.filename}, Tipo: ${blob.type}, Tamaño: ${blob.size}`);
          if (blob.size === 0) {
            console.warn(`[ADVERTENCIA ZIP] El archivo '${file.filename}' recibido está vacío (size=0)`);
          }

          // Determinar extensión preferentemente por fileType, si no por filename, si no .bin
          const extByType = getExtensionFromType(file.fileType);
          const extByName = guessExtensionFromFilename(file.filename);
          const finalExt = extByType || extByName || '.bin';
          const groupKey = getLogicalGroupKey(file);

          if (!fileGroups[groupKey]) fileGroups[groupKey] = [];
          fileGroups[groupKey].push({
            blob,
            finalExt,
            type: file.fileType,
            original: file.filename,
            date: response.headers.get('Last-Modified') || ''
          });
        } catch (err) {
          console.error(`[MultiDownloadZipButton] ❌ Error con ${file.filename}:`, err);
        }
      })
    );

    console.log('[MultiDownloadZipButton] Agrupación de archivos para ZIP', fileGroups);
    for (const [groupKey, group] of Object.entries(fileGroups)) {
      // Log de depuración para cada archivo del grupo
      group.forEach(({ original, finalExt, type }) => {
        console.log('[MultiDownloadZipButton] Archivo en grupo:', original, '→', finalExt, type);
      });

      const allArePDFs = group.every((f) => f.finalExt === '.pdf');

      if (allArePDFs && group.length > 1) {
        // PDF merging functionality removed - save individual files
        group.sort((a, b) => new Date(a.date) - new Date(b.date));
        group.forEach(({ blob, finalExt, original }, index) => {
          const fileName = `${groupKey}_${index + 1}${finalExt}`;
          zip.file(fileName, blob);
          console.log(`[MultiDownloadZipButton] PDF individual agregado al ZIP: ${fileName}`);
        });
      } else {
        // Si es solo un PDF o archivos mixtos, guardar cada uno con su extensión
        group.forEach(({ blob, finalExt, original }, index) => {
          const fileName = `${groupKey}_${index + 1}${finalExt}`;
          zip.file(fileName, blob);
          console.log(`[MultiDownloadZipButton] ✅ Archivo agregado al ZIP: ${fileName}`);
        });
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    console.log('[MultiDownloadZipButton] ZIP generado, iniciando descarga', { zipBlob, zipName, createBackup });
    saveAs(zipBlob, zipName);
    
    // Solo crear backup si createBackup es true
    if (createBackup) {
      await subirBackupZip(zipBlob, files);
    } else {
      console.log('[MultiDownloadZipButton] Backup omitido (createBackup=false)');
    }
    
    setLoading(false);
    console.log('[MultiDownloadZipButton] FIN handleDownloadZip');
  };

  const ButtonContent = loading ? <CircularProgress size={24} /> : <Download />;

  return iconOnly ? (
    <Tooltip title={label}>
      <span>
        <IconButton onClick={handleDownloadZip} disabled={disabled || loading} size={size}>
          {ButtonContent}
        </IconButton>
      </span>
    </Tooltip>
  ) : (
    <Button
      onClick={handleDownloadZip}
      disabled={disabled || loading}
      variant={variant}
      size={size}
      startIcon={startIcon && !loading ? <Download /> : null}
    >
      {loading ? <CircularProgress size={24} /> : label}
    </Button>
  );
}
