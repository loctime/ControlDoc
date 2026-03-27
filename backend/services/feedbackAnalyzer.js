// backend/services/feedbackAnalyzer.js
import { db } from '../firebaseconfig.js';

/**
 * Analiza feedback acumulado para un documento requerido
 * @param {string} requiredDocumentId - ID del documento requerido
 * @param {string} companyId - ID de la empresa
 * @param {string} feedbackCollectionPath - Ruta de la colección de feedback
 * @returns {Promise<Object>} Resultado del análisis
 */
export async function analyzeFeedbackForDocument(requiredDocumentId, companyId, feedbackCollectionPath) {
  try {
    // Obtener todos los feedbacks para este documento
    const feedbackSnapshot = await db.collection(feedbackCollectionPath)
      .where('userCorrection.requiredDocumentId', '==', requiredDocumentId)
      .where('companyId', '==', companyId)
      .get();

    if (feedbackSnapshot.empty) {
      return {
        success: false,
        message: 'No hay feedback para este documento',
        feedbackCount: 0
      };
    }

    const feedbacks = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Analizar patrones
    const textSelections = [];
    const correctedTexts = [];
    const wordFrequency = {};
    const fieldPatterns = {};

    feedbacks.forEach(feedback => {
      // Recopilar textos corregidos
      if (feedback.textExtracted) {
        correctedTexts.push(feedback.textExtracted);
      }

      // Analizar selecciones de texto
      if (feedback.textSelections && Array.isArray(feedback.textSelections)) {
        feedback.textSelections.forEach(selection => {
          textSelections.push(selection);
          
          // Contar frecuencia de palabras en selecciones
          const words = selection.selectedText.toLowerCase().split(/\s+/);
          words.forEach(word => {
            if (word.length > 2) { // Ignorar palabras muy cortas
              wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            }
          });
        });
      }

      // Analizar campos detectados corregidos
      if (feedback.userCorrection.detectedFields) {
        Object.entries(feedback.userCorrection.detectedFields).forEach(([field, value]) => {
          if (!fieldPatterns[field]) {
            fieldPatterns[field] = [];
          }
          fieldPatterns[field].push(value);
        });
      }
    });

    return {
      success: true,
      feedbackCount: feedbacks.length,
      textSelections,
      correctedTexts,
      wordFrequency,
      fieldPatterns,
      feedbacks
    };

  } catch (error) {
    console.error('[Feedback Analyzer] Error analizando feedback:', error);
    throw error;
  }
}

/**
 * Calcula pesos de palabras basado en feedback
 * @param {Object} feedbackHistory - Historial de feedback procesado
 * @returns {Object} Objeto con pesos de palabras
 */
export function calculateWordWeights(feedbackHistory) {
  const { wordFrequency, correctedTexts, textSelections } = feedbackHistory;
  const wordWeights = {};

  // Calcular pesos basado en frecuencia
  const maxFrequency = Math.max(...Object.values(wordFrequency), 1);
  
  Object.entries(wordFrequency).forEach(([word, frequency]) => {
    // Peso base: frecuencia normalizada (1-2.5)
    const baseWeight = 1 + (frequency / maxFrequency) * 1.5;
    
    // Boost para palabras en selecciones de texto (1.5x)
    const inSelections = textSelections.some(s => 
      s.selectedText.toLowerCase().includes(word.toLowerCase())
    );
    const selectionBoost = inSelections ? 1.5 : 1;

    wordWeights[word] = baseWeight * selectionBoost;
  });

  return wordWeights;
}

/**
 * Genera texto de referencia mejorado combinando original y textos corregidos
 * @param {Object} feedbackHistory - Historial de feedback procesado
 * @param {string} originalText - Texto original de exampleMetadata
 * @returns {string} Texto de referencia mejorado
 */
export function generateImprovedReferenceText(feedbackHistory, originalText = '') {
  const { correctedTexts } = feedbackHistory;
  
  if (!correctedTexts || correctedTexts.length === 0) {
    return originalText;
  }

  // Combinar texto original con textos corregidos (priorizando original)
  const allTexts = [originalText, ...correctedTexts].filter(Boolean);
  
  // Extraer palabras únicas más frecuentes
  const wordFrequency = {};
  allTexts.forEach(text => {
    const words = text.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 2) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
  });

  // Ordenar por frecuencia y tomar las más importantes
  const topWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([word]) => word);

  // Combinar en texto mejorado (priorizando texto original, luego agregando palabras frecuentes)
  const improvedText = originalText + ' ' + topWords.join(' ');
  
  return improvedText.trim();
}

/**
 * Actualiza exampleMetadata basado en feedback acumulado
 * @param {string} requiredDocumentId - ID del documento requerido
 * @param {string} companyId - ID de la empresa
 * @param {string} feedbackCollectionPath - Ruta de la colección de feedback
 * @returns {Promise<Object>} Resultado de la actualización
 */
export async function updateExampleMetadataWithFeedback(requiredDocumentId, companyId, feedbackCollectionPath) {
  try {
    // Extraer tenantId de la ruta de feedback (formato: tenants/{tenantId}/classificationFeedback)
    const tenantMatch = feedbackCollectionPath.match(/tenants\/([^/]+)\//);
    const tenantId = tenantMatch ? tenantMatch[1] : 'default';
    const requiredDocsPath = `tenants/${tenantId}/requiredDocuments`;

    // Obtener documento requerido actual
    const docRef = db.collection(requiredDocsPath).doc(requiredDocumentId);
    const docSnapshot = await docRef.get();

    if (!docSnapshot.exists) {
      throw new Error(`Documento requerido ${requiredDocumentId} no encontrado`);
    }

    const currentDoc = docSnapshot.data();
    const currentMetadata = currentDoc.exampleMetadata || {};

    // Analizar feedback
    const analysis = await analyzeFeedbackForDocument(requiredDocumentId, companyId, feedbackCollectionPath);

    if (!analysis.success || analysis.feedbackCount === 0) {
      return {
        success: false,
        message: 'No hay suficiente feedback para actualizar',
        feedbackCount: 0
      };
    }

    // Calcular pesos de palabras
    const wordWeights = calculateWordWeights(analysis);

    // Generar texto mejorado
    const improvedText = generateImprovedReferenceText(analysis, currentMetadata.text || '');

    // Actualizar detectedFields basado en patrones
    const updatedDetectedFields = { ...(currentMetadata.detectedFields || {}) };
    Object.entries(analysis.fieldPatterns).forEach(([field, values]) => {
      // Tomar el valor más frecuente para cada campo
      const valueCounts = {};
      values.forEach(value => {
        valueCounts[value] = (valueCounts[value] || 0) + 1;
      });
      const mostFrequent = Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])[0];
      
      if (mostFrequent) {
        updatedDetectedFields[field] = mostFrequent[0];
      }
    });

    // Preparar metadata actualizada
    const updatedMetadata = {
      ...currentMetadata,
      text: improvedText,
      wordWeights,
      detectedFields: updatedDetectedFields,
      updatedFromFeedback: true,
      feedbackCount: analysis.feedbackCount,
      lastUpdated: new Date(),
      // Mantener words si existen
      words: currentMetadata.words || [],
      type: currentMetadata.type || 'unknown'
    };

    // Actualizar documento
    await docRef.update({
      exampleMetadata: updatedMetadata
    });

    console.log(`[Feedback Analyzer] Metadata actualizada para ${requiredDocumentId} con ${analysis.feedbackCount} feedbacks`);

    return {
      success: true,
      feedbackCount: analysis.feedbackCount,
      updatedMetadata,
      wordWeightsCount: Object.keys(wordWeights).length
    };

  } catch (error) {
    console.error('[Feedback Analyzer] Error actualizando metadata:', error);
    throw error;
  }
}

