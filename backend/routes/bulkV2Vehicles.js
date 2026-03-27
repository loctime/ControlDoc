/**
 * Bulk Upload V2 — Vehicle: routes for job lifecycle, staging, analysis and decision.
 * Base path: /api/bulk/v2/vehicles
 */
import express from 'express';
import axios from 'axios';
import { db } from '../firebaseconfig.js';
import { FieldValue } from 'firebase-admin/firestore';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';
import { uploadToStaging } from '../services/bulkV2StagingService.js';
import {
  detectPatentes,
  detectDatesAndNumbers,
  suggestVehicle,
  suggestRequired
} from '../services/bulkV2SuggestionEngine.js';
import { copyStagingToFinal, deleteStagingFile } from '../services/bulkV2CopyToFinalService.js';
import crypto from 'crypto';

const router = express.Router();

const MAX_FILE_SIZE = 400 * 1024 * 1024; // 400 MB
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILES_PER_JOB = 100;

function validateJobAccess(req, jobDoc) {
  if (!jobDoc?.exists) return false;
  const data = jobDoc.data();
  return data.companyId === req.user.companyId && data.tenantId === req.tenantId;
}

// POST /api/bulk/v2/vehicles/jobs — create job
router.post('/jobs', authenticateFirebaseUser, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'companyId no disponible en el token' });
    }
    const { clientId } = req.body || {};
    const jobId = crypto.randomUUID();
    const bulkJobsPath = req.getTenantCollectionPath('bulkJobs');
    const jobRef = db.collection(bulkJobsPath).doc(jobId);
    const now = new Date();
    await jobRef.set({
      tenantId: req.tenantId,
      createdBy: { uid: req.user.uid, email: req.user.email || '' },
      companyId,
      clientId: clientId || null,
      mode: 'vehicle',
      status: 'uploading',
      counts: { total: 0, processed: 0, needsReview: 0, confirmed: 0, errors: 0 },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return res.status(201).json({ jobId });
  } catch (err) {
    console.error('[bulkV2Vehicles] POST /jobs:', err);
    return res.status(500).json({ error: err.message || 'Error al crear el job' });
  }
});

// GET /api/bulk/v2/vehicles/jobs/:jobId
router.get('/jobs/:jobId', authenticateFirebaseUser, async (req, res) => {
  try {
    const { jobId } = req.params;
    const bulkJobsPath = req.getTenantCollectionPath('bulkJobs');
    const jobDoc = await db.collection(bulkJobsPath).doc(jobId).get();
    if (!validateJobAccess(req, jobDoc)) {
      return res.status(404).json({ error: 'Job no encontrado o sin acceso' });
    }
    return res.json({ id: jobDoc.id, ...jobDoc.data() });
  } catch (err) {
    console.error('[bulkV2Vehicles] GET /jobs/:jobId:', err);
    return res.status(500).json({ error: err.message || 'Error al obtener el job' });
  }
});

// POST /api/bulk/v2/vehicles/jobs/:jobId/files — upload file to staging (multipart: file)
router.post('/jobs/:jobId/files', authenticateFirebaseUser, (req, res, next) => {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });
  upload.single('file')(req, res, async (multerErr) => {
    if (multerErr) {
      return res.status(400).json({ error: multerErr.message || 'Error al subir archivo' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { jobId } = req.params;
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ error: 'No se recibió ningún archivo (campo "file")' });
    }
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido. Use PDF, JPG o PNG.' });
    }
    const bulkJobsPath = req.getTenantCollectionPath('bulkJobs');
    const jobRef = db.collection(bulkJobsPath).doc(jobId);
    const jobDoc = await jobRef.get();
    if (!validateJobAccess(req, jobDoc)) {
      return res.status(404).json({ error: 'Job no encontrado o sin acceso' });
    }
    const jobData = jobDoc.data();
    if (jobData.status !== 'uploading' && jobData.status !== 'review') {
      return res.status(400).json({ error: 'El job no acepta más archivos en este estado' });
    }
    const filesPathCheck = `${bulkJobsPath}/${jobId}/files`;
    const existingFilesSnap = await db.collection(filesPathCheck).get();
    if (existingFilesSnap.size >= MAX_FILES_PER_JOB) {
      return res.status(400).json({ error: `Máximo ${MAX_FILES_PER_JOB} archivos por job` });
    }
    const fileId = crypto.randomUUID();
    const staging = await uploadToStaging(file.buffer, file.mimetype, {
      tenantId: req.tenantId,
      jobId,
      fileId
    });
    const filesPath = `${bulkJobsPath}/${jobId}/files`;
    const fileRef = db.collection(filesPath).doc(fileId);
    const now = new Date();
    await fileRef.set({
      originalName: file.originalname || fileId,
      mime: file.mimetype,
      size: file.size,
      staging: { bucket: staging.bucket, path: staging.path, url: staging.url },
      status: 'uploaded',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    const counts = jobData.counts || { total: 0, processed: 0, needsReview: 0, confirmed: 0, errors: 0 };
    await jobRef.update({
      counts: { ...counts, total: (counts.total || 0) + 1 },
      updatedAt: FieldValue.serverTimestamp()
    });
    return res.status(201).json({ fileId, staging: { bucket: staging.bucket, path: staging.path, url: staging.url } });
  } catch (err) {
    console.error('[bulkV2Vehicles] POST /jobs/:jobId/files:', err);
    return res.status(500).json({ error: err.message || 'Error al subir archivo a staging' });
  }
});

// GET /api/bulk/v2/vehicles/jobs/:jobId/files
router.get('/jobs/:jobId/files', authenticateFirebaseUser, async (req, res) => {
  try {
    const { jobId } = req.params;
    const bulkJobsPath = req.getTenantCollectionPath('bulkJobs');
    const jobDoc = await db.collection(bulkJobsPath).doc(jobId).get();
    if (!validateJobAccess(req, jobDoc)) {
      return res.status(404).json({ error: 'Job no encontrado o sin acceso' });
    }
    const filesPath = `${bulkJobsPath}/${jobId}/files`;
    const snapshot = await db.collection(filesPath).get();
    const files = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    return res.json({ files });
  } catch (err) {
    console.error('[bulkV2Vehicles] GET /jobs/:jobId/files:', err);
    return res.status(500).json({ error: err.message || 'Error al listar archivos' });
  }
});

// POST /api/bulk/v2/vehicles/jobs/:jobId/start — run OCR + suggestion engine on all uploaded files
router.post('/jobs/:jobId/start', authenticateFirebaseUser, async (req, res) => {
  try {
    const { jobId } = req.params;
    const bulkJobsPath = req.getTenantCollectionPath('bulkJobs');
    const jobRef = db.collection(bulkJobsPath).doc(jobId);
    const jobDoc = await jobRef.get();
    if (!validateJobAccess(req, jobDoc)) {
      return res.status(404).json({ error: 'Job no encontrado o sin acceso' });
    }
    const jobData = jobDoc.data();
    if (jobData.status !== 'uploading' && jobData.status !== 'review') {
      return res.status(400).json({ error: 'El job no puede iniciar análisis en este estado' });
    }
    const companyId = req.user.companyId;
    const clientId = jobData.clientId ?? null;
    const protocol = req.protocol || 'https';
    const host = req.get('host') || '';
    const baseURL = `${protocol}://${host}`;

    await jobRef.update({ status: 'processing', updatedAt: FieldValue.serverTimestamp() });

    const filesPath = `${bulkJobsPath}/${jobId}/files`;
    const filesSnap = await db.collection(filesPath).get();
    const uploadedFiles = filesSnap.docs.filter((d) => d.data().status === 'uploaded');
    let processed = 0;
    let needsReview = 0;
    let errors = 0;

    for (const fileDoc of uploadedFiles) {
      const fileId = fileDoc.id;
      const fileData = fileDoc.data();
      const fileRef = fileDoc.ref;
      const stagingUrl = fileData.staging?.url;
      try {
        if (!stagingUrl) {
          await fileRef.update({
            status: 'error',
            errors: ['Sin URL de staging'],
            updatedAt: FieldValue.serverTimestamp()
          });
          errors += 1;
          continue;
        }
        const analyzeRes = await axios.post(
          `${baseURL}/api/analyze-file`,
          { fileURL: stagingUrl, lang: 'spa' },
          { timeout: 120000, validateStatus: () => true }
        );
        const ocrText = analyzeRes.data?.text || '';
        const words = analyzeRes.data?.words || [];
        const patentes = detectPatentes(ocrText);
        const { fechas, numbers } = detectDatesAndNumbers(ocrText);
        const primaryPatente = patentes[0] || null;

        const vehicleResult = await suggestVehicle(
          db,
          req.tenantId,
          companyId,
          clientId,
          primaryPatente
        );
        const requiredResult = await suggestRequired(
          db,
          req.tenantId,
          companyId,
          clientId,
          ocrText
        );

        const status = (vehicleResult.confidenceVehicle === 'low' || requiredResult.confidenceRequired < 0.1)
          ? 'needs_review'
          : 'analyzed';
        if (status === 'needs_review') needsReview += 1;
        processed += 1;

        await fileRef.update({
          status,
          analysis: {
            ocrText: ocrText.slice(0, 5000),
            detected: {
              patentes,
              fechas,
              numbers,
              possibleExpirationDate: fechas[0] || null
            },
            suggestions: {
              vehicleCandidates: vehicleResult.vehicleCandidates.map((v) => ({ id: v.id, patente: v.patente, clientId: v.clientId })),
              requiredCandidates: requiredResult.requiredCandidates,
              suggestedVehicleId: vehicleResult.suggestedVehicleId,
              suggestedRequiredId: requiredResult.suggestedRequiredId,
              confidenceVehicle: vehicleResult.confidenceVehicle,
              confidenceRequired: requiredResult.confidenceRequired
            }
          },
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (fileErr) {
        console.error('[bulkV2Vehicles] Error analizando file', fileId, fileErr.message);
        await fileRef.update({
          status: 'error',
          errors: [fileErr.message || 'Error en análisis'],
          updatedAt: FieldValue.serverTimestamp()
        });
        errors += 1;
      }
    }

    const counts = jobData.counts || { total: 0, processed: 0, needsReview: 0, confirmed: 0, errors: 0 };
    await jobRef.update({
      status: 'review',
      counts: {
        ...counts,
        processed: (counts.processed || 0) + processed,
        needsReview: (counts.needsReview || 0) + needsReview,
        errors: (counts.errors || 0) + errors
      },
      updatedAt: FieldValue.serverTimestamp()
    });
    return res.json({ success: true, processed, needsReview, errors });
  } catch (err) {
    console.error('[bulkV2Vehicles] POST /jobs/:jobId/start:', err);
    return res.status(500).json({ error: err.message || 'Error al iniciar análisis' });
  }
});

// PATCH /api/bulk/v2/vehicles/jobs/:jobId/files/:fileId/decision — save user decision
router.patch('/jobs/:jobId/files/:fileId/decision', authenticateFirebaseUser, async (req, res) => {
  try {
    const { jobId, fileId } = req.params;
    const body = req.body || {};
    const { finalVehicleId, finalRequiredId, finalExpirationDate } = body;
    const bulkJobsPath = req.getTenantCollectionPath('bulkJobs');
    const jobDoc = await db.collection(bulkJobsPath).doc(jobId).get();
    if (!validateJobAccess(req, jobDoc)) {
      return res.status(404).json({ error: 'Job no encontrado o sin acceso' });
    }
    const filesPath = `${bulkJobsPath}/${jobId}/files`;
    const fileRef = db.collection(filesPath).doc(fileId);
    const fileDoc = await fileRef.get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const decision = {
      finalVehicleId: finalVehicleId ?? null,
      finalRequiredId: finalRequiredId ?? null,
      finalExpirationDate: finalExpirationDate ?? null,
      confirmedBy: { uid: req.user.uid, email: req.user.email || '' },
      confirmedAt: new Date().toISOString()
    };
    await fileRef.update({
      decision,
      status: 'confirmed',
      updatedAt: FieldValue.serverTimestamp()
    });
    const jobData = jobDoc.data();
    const counts = jobData.counts || { total: 0, processed: 0, needsReview: 0, confirmed: 0, errors: 0 };
    const filesSnap = await db.collection(filesPath).get();
    const confirmedCount = filesSnap.docs.filter((d) => d.data().status === 'confirmed').length;
    await jobDoc.ref.update({
      counts: { ...counts, confirmed: confirmedCount },
      updatedAt: FieldValue.serverTimestamp()
    });
    return res.json({ success: true, decision });
  } catch (err) {
    console.error('[bulkV2Vehicles] PATCH decision:', err);
    return res.status(500).json({ error: err.message || 'Error al guardar decisión' });
  }
});

// POST /api/bulk/v2/vehicles/jobs/:jobId/commit — copy to final path, create uploadedDocuments, update requiredDocuments, delete staging
router.post('/jobs/:jobId/commit', authenticateFirebaseUser, async (req, res) => {
  try {
    const { jobId } = req.params;
    const companyId = req.user.companyId;
    const bulkJobsPath = req.getTenantCollectionPath('bulkJobs');
    const jobRef = db.collection(bulkJobsPath).doc(jobId);
    const jobDoc = await jobRef.get();
    if (!validateJobAccess(req, jobDoc)) {
      return res.status(404).json({ error: 'Job no encontrado o sin acceso' });
    }
    const jobData = jobDoc.data();
    if (jobData.status !== 'review') {
      return res.status(400).json({ error: 'El job debe estar en estado review para hacer commit' });
    }

    const filesPath = `${bulkJobsPath}/${jobId}/files`;
    const filesSnap = await db.collection(filesPath).get();
    const toCommit = filesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((f) => f.decision?.finalVehicleId && f.decision?.finalRequiredId && f.status === 'confirmed');

    if (toCommit.length === 0) {
      return res.status(400).json({ error: 'No hay archivos confirmados con vehículo y documento requerido' });
    }

    const vehiculosPath = req.getTenantCollectionPath('vehiculos');
    const requiredPath = req.getTenantCollectionPath('requiredDocuments');
    const uploadedPath = req.getTenantCollectionPath('uploadedDocuments');
    const approvedPath = req.getTenantCollectionPath('approvedDocuments');
    const committed = [];
    const stagingUrlsToDelete = [];

    for (const file of toCommit) {
      const { finalVehicleId, finalRequiredId, finalExpirationDate } = file.decision;
      const vehicleDoc = await db.collection(vehiculosPath).doc(finalVehicleId).get();
      const requiredDoc = await db.collection(requiredPath).doc(finalRequiredId).get();
      if (!vehicleDoc.exists || !requiredDoc.exists) {
        await db.collection(filesPath).doc(file.id).update({ status: 'error', errors: ['Vehículo o documento requerido no encontrado'], updatedAt: FieldValue.serverTimestamp() });
        continue;
      }
      const vehicleData = vehicleDoc.data();
      const requiredData = requiredDoc.data();
      if (requiredData.entityType !== 'vehicle' && requiredData.entityType !== 'vehiculo') {
        await db.collection(filesPath).doc(file.id).update({ status: 'error', errors: ['Documento requerido no es de tipo vehicle'], updatedAt: FieldValue.serverTimestamp() });
        continue;
      }
      if (vehicleData.companyId !== companyId) {
        await db.collection(filesPath).doc(file.id).update({ status: 'error', errors: ['Vehículo no pertenece a la empresa'], updatedAt: FieldValue.serverTimestamp() });
        continue;
      }

      const clientId = vehicleData.clientId ?? jobData.clientId ?? null;
      const entityId = finalVehicleId;
      const requiredDocumentId = finalRequiredId;

      let finalUrl, finalFileName;
      try {
        const copyResult = await copyStagingToFinal(
          file.staging?.url,
          companyId,
          finalVehicleId,
          finalRequiredId,
          file.originalName,
          file.mime
        );
        finalUrl = copyResult.finalUrl;
        finalFileName = copyResult.fileName;
      } catch (copyErr) {
        console.error('[bulkV2Vehicles] Error copiando file', file.id, copyErr);
        await db.collection(filesPath).doc(file.id).update({ status: 'error', errors: [copyErr.message], updatedAt: FieldValue.serverTimestamp() });
        continue;
      }

      const documentClientId = clientId;
      const existingUploaded = await db.collection(uploadedPath)
        .where('companyId', '==', companyId)
        .where('entityType', '==', 'vehicle')
        .where('entityId', '==', entityId)
        .where('requiredDocumentId', '==', requiredDocumentId)
        .get();
      let maxVersion = 0;
      for (const d of existingUploaded.docs) {
        const v = d.data().versionNumber || 0;
        if (v > maxVersion) maxVersion = v;
      }
      const approvedSnap = await db.collection(approvedPath)
        .where('companyId', '==', companyId)
        .where('entityId', '==', entityId)
        .where('requiredDocumentId', '==', requiredDocumentId)
        .get();
      for (const d of approvedSnap.docs) {
        const data = d.data();
        if ((data.clientId || null) === documentClientId) {
          const v = data.versionNumber || data.version || 0;
          if (v > maxVersion) maxVersion = v;
        }
      }
      const nextVersionNumber = maxVersion + 1;

      const docData = {
        name: requiredData.name || file.originalName?.split('.')[0] || 'documento',
        documentType: requiredDocumentId,
        fileName: finalFileName,
        fileType: file.mime || 'application/octet-stream',
        fileSize: file.size || 0,
        fileURL: finalUrl,
        uploadedAt: new Date(),
        status: 'Pendiente de revisión',
        uploadedBy: req.user.uid,
        uploadedByEmail: req.user.email || '',
        comentario: '',
        vencimiento: finalExpirationDate || null,
        expirationDate: finalExpirationDate || null,
        entityType: 'vehicle',
        entityId,
        entityName: vehicleData.patente || vehicleData.marca || entityId,
        companyId,
        clientId: documentClientId,
        requiredDocumentId,
        versionNumber: nextVersionNumber,
        versionString: `${nextVersionNumber}.0`,
        versionId: null
      };

      if (existingUploaded.empty) {
        await db.collection(uploadedPath).add(docData);
      } else {
        const existingDoc = existingUploaded.docs[0];
        await existingDoc.ref.update({
          ...docData,
          uploadedAt: new Date(),
          uploadedBy: req.user.uid,
          uploadedByEmail: req.user.email || ''
        });
      }

      await db.collection(requiredPath).doc(requiredDocumentId).update({
        archivoSubido: true,
        status: 'Subido',
        uploadedBy: { uid: req.user.uid, email: req.user.email || '' },
        uploadedAt: FieldValue.serverTimestamp()
      });

      await db.collection(filesPath).doc(file.id).update({
        status: 'committed',
        updatedAt: FieldValue.serverTimestamp()
      });
      committed.push(file.id);
      if (file.staging?.url) stagingUrlsToDelete.push(file.staging.url);
    }

    const counts = jobData.counts || { total: 0, processed: 0, needsReview: 0, confirmed: 0, errors: 0 };
    await jobRef.update({
      status: 'committed',
      counts: { ...counts, confirmed: committed.length },
      updatedAt: FieldValue.serverTimestamp()
    });

    for (const url of stagingUrlsToDelete) {
      try {
        await deleteStagingFile(url);
      } catch (e) {
        console.warn('[bulkV2Vehicles] No se pudo eliminar staging:', url, e.message);
      }
    }

    return res.json({ success: true, committed: committed.length });
  } catch (err) {
    console.error('[bulkV2Vehicles] POST commit:', err);
    return res.status(500).json({ error: err.message || 'Error en commit' });
  }
});

export default router;
