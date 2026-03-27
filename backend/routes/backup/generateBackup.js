// backend/routes/backups/generateBackup.js
import express from "express"
import { db } from "../../firebaseconfig.js"
import { uploadFile } from "../../services/backblazeService.js"

import axios from "axios"
import archiver from "archiver"
import { PDFDocument } from "pdf-lib"
import fs from "fs"
import path from "path"
import os from "os"

const router = express.Router()

// Middleware de autenticación Firebase
import { authenticateFirebaseUser } from "../../middleware/authenticateFirebaseUser.js"
import { requireRole } from "../../middleware/requireRole.js"

// Helpers
const toDate = (val) => {
  if (!val) return null
  if (typeof val === "string") return new Date(val)
  if (val.toDate) return val.toDate()
  if (val.seconds) return new Date(val.seconds * 1000)
  return null
}

// Descarga un archivo de una URL y lo guarda temporalmente
async function downloadFile(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" })
  return Buffer.from(response.data)
}

// Une varios PDFs usando pdf-lib
async function mergePDFs(buffers) {
  const mergedPdf = await PDFDocument.create()
  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer)
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    copiedPages.forEach((page) => mergedPdf.addPage(page))
  }
  return await mergedPdf.save()
}

// Agrupa documentos por estructura lógica
function groupDocuments(docs, clientMap = {}) {
  const groups = {}
  for (const doc of docs) {
    const { companyName, entityType, entityName, clientId } = doc
    // Usar originalName como prioridad para agrupamiento
    const documentName = doc.originalName || doc.name || doc.documentName || 'documento'
    const clientName = clientId ? (clientMap[clientId] || 'Principal') : 'Principal'
    
    const folder = path.join(
      sanitize(companyName),
      clientName !== 'Principal' ? sanitize(clientName) : '',
      sanitize(entityType),
      ["employee", "vehicle"].includes(entityType) ? sanitize(entityName) : "",
      sanitize(documentName)
    )
    if (!groups[folder]) groups[folder] = []
    groups[folder].push(doc)
  }
  return groups
}

function sanitize(str) {
  return (str || "desconocido").replace(/[^a-zA-Z0-9_\- ]/g, "_").replace(/\s+/g, "_")
}

router.post("/generate", authenticateFirebaseUser, requireRole(['max', 'admin']), async (req, res) => {
  console.log('🔍 [Backup Generate] Entrando en ruta /generate');
  console.log('🔍 [Backup Generate] req.tenantId:', req.tenantId);
  console.log('🔍 [Backup Generate] req.getTenantCollectionPath:', typeof req.getTenantCollectionPath);
  
  const { documentIds } = req.body;
  const user = req.user;
  const createdBy = user.email;
  const backupStart = new Date();
  let responded = false;

  let backupDocRef = null;
  let backupMeta = {
    name: null,
    fileURLs: [],
    size: 0,
    fileCount: 0,
    createdAt: backupStart,
    createdBy,
    status: "pendiente",
    filters: { documentIds: documentIds || null },
    errors: [],
  };

  try {
    const snapshot = await db.collection("approvedDocuments").get();
    let documents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (documentIds?.length > 0) {
      documents = documents.filter((doc) => documentIds.includes(doc.id));
    }
    if (documents.length === 0) {
      return res.status(400).json({ error: "No hay documentos para procesar" });
    }

    // Usar la ruta del tenant para backups
    const tenantBackupsPath = req.getTenantCollectionPath ? req.getTenantCollectionPath('backups') : 'backups';
    const tenantCompaniesPath = req.getTenantCollectionPath ? req.getTenantCollectionPath('companies') : 'companies';
    console.log('🔍 [Backup] Guardando en ruta:', tenantBackupsPath);
    console.log('🔍 [Backup] Tenant ID:', req.tenantId);
    backupDocRef = await db.collection(tenantBackupsPath).add({ ...backupMeta });

    // Obtener mapa de clientes
    const companiesSnapshot = await db.collection(tenantCompaniesPath).get();
    const clientMap = {};
    companiesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.type === 'client') {
        clientMap[doc.id] = data.companyName || `Cliente-${doc.id}`;
      }
    });

    const grouped = groupDocuments(documents, clientMap);
    let zipIndex = 1;
    let tmpZipPath = path.join(os.tmpdir(), `backup-${Date.now()}-${zipIndex}.zip`);
    let output = fs.createWriteStream(tmpZipPath);
    let archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);
    let fileCount = 0;
    let totalSize = 0;
    let currentZipSize = 0;
    let fileURLs = [];
    let failedFiles = [];

    const handleStreamError = (err) => {
      if (!responded) {
        responded = true;
        db.collection(tenantBackupsPath).doc(backupDocRef.id).update({
          ...backupMeta,
          status: "error",
          errors: backupMeta.errors.concat([err.message]),
        });
        res.status(500).json({ error: "Error generando ZIP", detail: err.message });
      }
    };
    output.on("error", handleStreamError);
    archive.on("error", handleStreamError);

    async function finalizeAndUploadZip() {
      return new Promise((resolve, reject) => {
        output.on("close", async () => {
          try {
            const b2Path = `admin/backups/backup-${Date.now()}-${zipIndex}.zip`;
            const zipBuffer = fs.readFileSync(tmpZipPath);
            const fileURL = await uploadFile(zipBuffer, 'application/zip', { fileName: b2Path });
            fileURLs.push(fileURL);
            fs.unlinkSync(tmpZipPath);
            resolve();
          } catch (err) {
            backupMeta.errors.push(`[UPLOAD ERROR ZIP ${zipIndex}] ${err.message}`);
            reject(err);
          }
        });
        archive.finalize().catch(reject);
      });
    }

    for (const [folderPath, files] of Object.entries(grouped)) {
      const pdfs = files.filter((f) => f.fileType === "application/pdf");
      const others = files.filter((f) => f.fileType !== "application/pdf");

      if (pdfs.length > 1) {
        try {
          const pdfBuffers = await Promise.all(
            pdfs.map(async (f) => {
              try { return await downloadFile(f.fileURL); } catch (e) { failedFiles.push(f.id); throw e; }
            })
          );
          const merged = await mergePDFs(pdfBuffers);
          archive.append(merged, { name: `${folderPath}.pdf` });
          fileCount++;
          totalSize += merged.length;
          currentZipSize += merged.length;
        } catch (err) {
          backupMeta.errors.push(`[MERGE PDF ERROR] ${folderPath}: ${err.message}`);
        }
      } else if (pdfs.length === 1) {
        try {
          const single = await downloadFile(pdfs[0].fileURL);
          archive.append(single, { name: `${folderPath}.pdf` });
          fileCount++;
          totalSize += single.length;
          currentZipSize += single.length;
        } catch (err) {
          failedFiles.push(pdfs[0].id);
          backupMeta.errors.push(`[DOWNLOAD PDF ERROR] ${pdfs[0].id}: ${err.message}`);
        }
      }

      for (const file of others) {
        try {
          const buffer = await downloadFile(file.fileURL);
          const ext = path.extname(file.fileName || file.name || "") || ".bin";
          archive.append(buffer, { name: `${folderPath}${ext}` });
          fileCount++;
          totalSize += buffer.length;
          currentZipSize += buffer.length;
        } catch (err) {
          failedFiles.push(file.id);
          backupMeta.errors.push(`[DOWNLOAD FILE ERROR] ${file.id}: ${err.message}`);
        }
      }

      if (currentZipSize >= 1024 * 1024 * 1024) {
        await finalizeAndUploadZip();
        zipIndex++;
        tmpZipPath = path.join(os.tmpdir(), `backup-${Date.now()}-${zipIndex}.zip`);
        output = fs.createWriteStream(tmpZipPath);
        archive = archiver("zip", { zlib: { level: 9 } });
        archive.pipe(output);
        output.on("error", handleStreamError);
        archive.on("error", handleStreamError);
        currentZipSize = 0;
      }
    }

    await finalizeAndUploadZip();

    backupMeta = {
      ...backupMeta,
      name: fileURLs.length === 1 ? path.basename(fileURLs[0]) : `backup-multiple-${backupStart.getTime()}`,
      fileURLs,
      size: totalSize,
      fileCount,
      createdAt: backupStart,
      createdBy,
      status: backupMeta.errors.length > 0 ? "completado_con_errores" : "completado",
      filters: { documentIds: documentIds || null },
      errors: backupMeta.errors,
      failedFiles,
    };
    await db.collection(tenantBackupsPath).doc(backupDocRef.id).set(backupMeta);
    if (!responded) {
      responded = true;
      res.status(200).json({ message: backupMeta.status === "completado" ? "Backup generado" : "Backup generado con errores", ...backupMeta });
    }
  } catch (err) {
    if (backupDocRef) {
      await db.collection(tenantBackupsPath).doc(backupDocRef.id).update({
        ...backupMeta,
        status: "error",
        errors: backupMeta.errors.concat([err.message]),
      });
    }
    if (!responded) {
      responded = true;
      console.error("[BACKUP ERROR]", err);
      res.status(500).json({ error: "Error generando backup", detail: err.message });
    }
  }
});

export default router
