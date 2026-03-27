// backend/routes/feedbackRoutes.js
import express from 'express';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';
import { db } from '../firebaseconfig.js';
import { analyzeFeedbackForDocument, updateExampleMetadataWithFeedback } from '../services/feedbackAnalyzer.js';

const router = express.Router();

/**
 * POST /api/feedback/classify
 * Guarda feedback de correcciones del usuario
 * 
 * Body:
 * {
 *   "timestamp": Date,
 *   "companyId": string,
 *   "originalSuggestion": {
 *     "requiredDocumentId": string,
 *     "requiredDocumentName": string,
 *     "confidence": number,
 *     "detectedFields": object,
 *     "text": string
 *   },
 *   "userCorrection": {
 *     "requiredDocumentId": string,
 *     "requiredDocumentName": string,
 *     "entityId": string,
 *     "entityName": string,
 *     "detectedFields": object
 *   },
 *   "fileName": string,
 *   "fileURL": string,
 *   "textExtracted": string,
 *   "words": array,
 *   "correctionType": string,
 *   "textSelections": array
 * }
 */
router.post('/classify', authenticateFirebaseUser, async (req, res) => {
  try {
    const {
      timestamp,
      companyId,
      originalSuggestion,
      userCorrection,
      fileName,
      fileURL,
      textExtracted,
      words,
      correctionType,
      textSelections = []
    } = req.body;

    // Validaciones básicas
    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    if (!originalSuggestion || !userCorrection) {
      return res.status(400).json({ error: 'originalSuggestion y userCorrection son requeridos' });
    }

    const userId = req.user.uid;
    const userEmail = req.user.email || '';
    const tenantPath = req.getTenantCollectionPath('classificationFeedback');

    // Detectar tipo de corrección si no se especifica
    let detectedCorrectionType = correctionType || [];
    if (!correctionType) {
      const corrections = [];
      if (originalSuggestion.requiredDocumentId !== userCorrection.requiredDocumentId) {
        corrections.push('document_type');
      }
      if (originalSuggestion.entityId !== userCorrection.entityId) {
        corrections.push('entity');
      }
      if (JSON.stringify(originalSuggestion.detectedFields) !== JSON.stringify(userCorrection.detectedFields)) {
        corrections.push('fields');
      }
      if (textSelections && textSelections.length > 0) {
        corrections.push('text_selection');
      }
      detectedCorrectionType = corrections.length > 0 ? corrections : ['none'];
    }

    // Crear documento de feedback
    const feedbackData = {
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      companyId,
      userId,
      userEmail,
      originalSuggestion: {
        requiredDocumentId: originalSuggestion.requiredDocumentId || null,
        requiredDocumentName: originalSuggestion.requiredDocumentName || null,
        confidence: originalSuggestion.confidence || 0,
        detectedFields: originalSuggestion.detectedFields || {},
        text: originalSuggestion.text || '',
        entityId: originalSuggestion.entityId || null,
        entityName: originalSuggestion.entityName || null
      },
      userCorrection: {
        requiredDocumentId: userCorrection.requiredDocumentId || null,
        requiredDocumentName: userCorrection.requiredDocumentName || null,
        entityId: userCorrection.entityId || null,
        entityName: userCorrection.entityName || null,
        detectedFields: userCorrection.detectedFields || {}
      },
      fileName: fileName || 'unknown',
      fileURL: fileURL || null,
      textExtracted: textExtracted || '',
      words: words || [],
      correctionType: Array.isArray(detectedCorrectionType) ? detectedCorrectionType : [detectedCorrectionType],
      textSelections: textSelections || [],
      createdAt: new Date(),
      createdBy: userId
    };

    // Guardar en Firestore
    const feedbackRef = await db.collection(tenantPath).add(feedbackData);
    
    console.log(`[Feedback] Feedback guardado: ${feedbackRef.id} para documento ${userCorrection.requiredDocumentId}`);

    // Verificar si debemos actualizar metadata (umbral: 5 correcciones)
    const FEEDBACK_UPDATE_THRESHOLD = parseInt(process.env.FEEDBACK_UPDATE_THRESHOLD || '5');
    const feedbackSnapshot = await db.collection(tenantPath)
      .where('userCorrection.requiredDocumentId', '==', userCorrection.requiredDocumentId)
      .where('companyId', '==', companyId)
      .get();

    if (feedbackSnapshot.size >= FEEDBACK_UPDATE_THRESHOLD) {
      console.log(`[Feedback] Umbral alcanzado (${feedbackSnapshot.size} >= ${FEEDBACK_UPDATE_THRESHOLD}), actualizando metadata...`);
      // Actualizar metadata en background (no bloquear respuesta)
      updateExampleMetadataWithFeedback(userCorrection.requiredDocumentId, companyId, tenantPath)
        .catch(err => console.error('[Feedback] Error actualizando metadata:', err));
    }

    return res.json({
      success: true,
      feedbackId: feedbackRef.id,
      metadataUpdateTriggered: feedbackSnapshot.size >= FEEDBACK_UPDATE_THRESHOLD
    });

  } catch (error) {
    console.error('[Feedback] Error guardando feedback:', error);
    return res.status(500).json({
      error: 'Error al guardar feedback',
      message: error.message
    });
  }
});

/**
 * POST /api/feedback/update-metadata
 * Actualiza exampleMetadata basado en feedback acumulado
 * 
 * Body:
 * {
 *   "requiredDocumentId": string,
 *   "companyId": string
 * }
 */
router.post('/update-metadata', authenticateFirebaseUser, async (req, res) => {
  try {
    const { requiredDocumentId, companyId } = req.body;

    if (!requiredDocumentId || !companyId) {
      return res.status(400).json({ error: 'requiredDocumentId y companyId son requeridos' });
    }

    const tenantPath = req.getTenantCollectionPath('classificationFeedback');
    
    const result = await updateExampleMetadataWithFeedback(requiredDocumentId, companyId, tenantPath);

    return res.json({
      success: true,
      message: 'Metadata actualizada exitosamente',
      ...result
    });

  } catch (error) {
    console.error('[Feedback] Error actualizando metadata:', error);
    return res.status(500).json({
      error: 'Error al actualizar metadata',
      message: error.message
    });
  }
});

/**
 * GET /api/feedback/analytics/overview
 * Métricas generales de clasificación
 */
router.get('/analytics/overview', authenticateFirebaseUser, async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    const tenantPath = req.getTenantCollectionPath('classificationFeedback');
    
    // Obtener todos los feedbacks de la empresa
    const feedbackSnapshot = await db.collection(tenantPath)
      .where('companyId', '==', companyId)
      .get();

    const feedbacks = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Calcular métricas
    const total = feedbacks.length;
    const byDocumentType = {};
    const byCorrectionType = {};
    const confidenceDistribution = { low: 0, medium: 0, high: 0 };

    feedbacks.forEach(feedback => {
      const docId = feedback.userCorrection.requiredDocumentId;
      if (!byDocumentType[docId]) {
        byDocumentType[docId] = { total: 0, corrections: 0 };
      }
      byDocumentType[docId].total++;
      byDocumentType[docId].corrections++;

      feedback.correctionType.forEach(type => {
        byCorrectionType[type] = (byCorrectionType[type] || 0) + 1;
      });

      const confidence = feedback.originalSuggestion.confidence || 0;
      if (confidence < 0.4) confidenceDistribution.low++;
      else if (confidence < 0.7) confidenceDistribution.medium++;
      else confidenceDistribution.high++;
    });

    return res.json({
      success: true,
      overview: {
        totalFeedbacks: total,
        byDocumentType,
        byCorrectionType,
        confidenceDistribution
      }
    });

  } catch (error) {
    console.error('[Feedback] Error obteniendo analytics:', error);
    return res.status(500).json({
      error: 'Error al obtener analytics',
      message: error.message
    });
  }
});

/**
 * GET /api/feedback/analytics/by-document
 * Métricas por documento requerido
 */
router.get('/analytics/by-document', authenticateFirebaseUser, async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    const tenantPath = req.getTenantCollectionPath('classificationFeedback');
    
    const feedbackSnapshot = await db.collection(tenantPath)
      .where('companyId', '==', companyId)
      .get();

    const feedbacks = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const byDocument = {};

    feedbacks.forEach(feedback => {
      const docId = feedback.userCorrection.requiredDocumentId;
      const docName = feedback.userCorrection.requiredDocumentName || docId;

      if (!byDocument[docId]) {
        byDocument[docId] = {
          documentId: docId,
          documentName: docName,
          totalCorrections: 0,
          averageConfidence: 0,
          correctionTypes: {},
          entities: {}
        };
      }

      byDocument[docId].totalCorrections++;
      byDocument[docId].averageConfidence += feedback.originalSuggestion.confidence || 0;

      feedback.correctionType.forEach(type => {
        byDocument[docId].correctionTypes[type] = (byDocument[docId].correctionTypes[type] || 0) + 1;
      });

      if (feedback.userCorrection.entityId) {
        const entityKey = `${feedback.userCorrection.entityId}-${feedback.userCorrection.entityName}`;
        byDocument[docId].entities[entityKey] = (byDocument[docId].entities[entityKey] || 0) + 1;
      }
    });

    // Calcular promedio de confianza
    Object.values(byDocument).forEach(doc => {
      doc.averageConfidence = doc.totalCorrections > 0 
        ? doc.averageConfidence / doc.totalCorrections 
        : 0;
    });

    return res.json({
      success: true,
      byDocument: Object.values(byDocument).sort((a, b) => b.totalCorrections - a.totalCorrections)
    });

  } catch (error) {
    console.error('[Feedback] Error obteniendo analytics por documento:', error);
    return res.status(500).json({
      error: 'Error al obtener analytics por documento',
      message: error.message
    });
  }
});

/**
 * GET /api/feedback/analytics/by-entity
 * Métricas por empleado/vehículo
 */
router.get('/analytics/by-entity', authenticateFirebaseUser, async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    const tenantPath = req.getTenantCollectionPath('classificationFeedback');
    
    const feedbackSnapshot = await db.collection(tenantPath)
      .where('companyId', '==', companyId)
      .get();

    const feedbacks = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const byEntity = {};

    feedbacks.forEach(feedback => {
      const entityId = feedback.userCorrection.entityId;
      if (!entityId) return;

      const entityKey = `${entityId}-${feedback.userCorrection.entityName || 'unknown'}`;
      
      if (!byEntity[entityKey]) {
        byEntity[entityKey] = {
          entityId,
          entityName: feedback.userCorrection.entityName || 'unknown',
          totalCorrections: 0,
          documents: {}
        };
      }

      byEntity[entityKey].totalCorrections++;
      
      const docId = feedback.userCorrection.requiredDocumentId;
      byEntity[entityKey].documents[docId] = (byEntity[entityKey].documents[docId] || 0) + 1;
    });

    return res.json({
      success: true,
      byEntity: Object.values(byEntity).sort((a, b) => b.totalCorrections - a.totalCorrections)
    });

  } catch (error) {
    console.error('[Feedback] Error obteniendo analytics por entidad:', error);
    return res.status(500).json({
      error: 'Error al obtener analytics por entidad',
      message: error.message
    });
  }
});

/**
 * GET /api/feedback/analytics/errors
 * Tipos de errores comunes
 */
router.get('/analytics/errors', authenticateFirebaseUser, async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    const tenantPath = req.getTenantCollectionPath('classificationFeedback');
    
    const feedbackSnapshot = await db.collection(tenantPath)
      .where('companyId', '==', companyId)
      .get();

    const feedbacks = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const errorPatterns = {
      document_type_errors: {},
      entity_errors: {},
      field_errors: {}
    };

    feedbacks.forEach(feedback => {
      // Errores de tipo de documento
      if (feedback.originalSuggestion.requiredDocumentId !== feedback.userCorrection.requiredDocumentId) {
        const from = feedback.originalSuggestion.requiredDocumentName || 'unknown';
        const to = feedback.userCorrection.requiredDocumentName || 'unknown';
        const key = `${from} -> ${to}`;
        errorPatterns.document_type_errors[key] = (errorPatterns.document_type_errors[key] || 0) + 1;
      }

      // Errores de entidad
      if (feedback.originalSuggestion.entityId !== feedback.userCorrection.entityId) {
        errorPatterns.entity_errors.total = (errorPatterns.entity_errors.total || 0) + 1;
      }

      // Errores de campos
      const originalFields = Object.keys(feedback.originalSuggestion.detectedFields || {});
      const correctedFields = Object.keys(feedback.userCorrection.detectedFields || {});
      if (JSON.stringify(originalFields) !== JSON.stringify(correctedFields)) {
        errorPatterns.field_errors.total = (errorPatterns.field_errors.total || 0) + 1;
      }
    });

    return res.json({
      success: true,
      errorPatterns
    });

  } catch (error) {
    console.error('[Feedback] Error obteniendo patrones de errores:', error);
    return res.status(500).json({
      error: 'Error al obtener patrones de errores',
      message: error.message
    });
  }
});

/**
 * GET /api/feedback/analytics/needs-improvement
 * Documentos que necesitan mejor exampleImage
 */
router.get('/analytics/needs-improvement', authenticateFirebaseUser, async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId es requerido' });
    }

    const tenantPath = req.getTenantCollectionPath('classificationFeedback');
    const requiredDocsPath = req.getTenantCollectionPath('requiredDocuments');
    
    // Obtener feedbacks
    const feedbackSnapshot = await db.collection(tenantPath)
      .where('companyId', '==', companyId)
      .get();

    const feedbacks = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Agrupar por documento requerido
    const byDocument = {};
    feedbacks.forEach(feedback => {
      const docId = feedback.userCorrection.requiredDocumentId;
      if (!byDocument[docId]) {
        byDocument[docId] = {
          documentId: docId,
          totalCorrections: 0,
          averageConfidence: 0,
          hasExampleImage: false
        };
      }
      byDocument[docId].totalCorrections++;
      byDocument[docId].averageConfidence += feedback.originalSuggestion.confidence || 0;
    });

    // Verificar si tienen exampleImage
    const needsImprovement = [];
    for (const [docId, stats] of Object.entries(byDocument)) {
      const docSnapshot = await db.collection(requiredDocsPath).doc(docId).get();
      const hasExampleImage = docSnapshot.exists && docSnapshot.data().exampleImage;
      
      stats.averageConfidence = stats.totalCorrections > 0 
        ? stats.averageConfidence / stats.totalCorrections 
        : 0;
      
      stats.documentName = docSnapshot.exists ? docSnapshot.data().name : docId;
      stats.hasExampleImage = !!hasExampleImage;

      // Considerar que necesita mejora si:
      // - Tiene muchas correcciones (>5)
      // - Confianza promedio baja (<0.5)
      // - No tiene exampleImage
      if (stats.totalCorrections >= 5 || stats.averageConfidence < 0.5 || !stats.hasExampleImage) {
        needsImprovement.push(stats);
      }
    }

    return res.json({
      success: true,
      needsImprovement: needsImprovement.sort((a, b) => b.totalCorrections - a.totalCorrections)
    });

  } catch (error) {
    console.error('[Feedback] Error obteniendo documentos que necesitan mejora:', error);
    return res.status(500).json({
      error: 'Error al obtener documentos que necesitan mejora',
      message: error.message
    });
  }
});

export default router;

