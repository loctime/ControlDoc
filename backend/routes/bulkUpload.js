// backend/routes/bulkUpload.js
import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';
import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const crypto = require('crypto');

const router = express.Router();
const db = getFirestore();
const bulkUploadAnalysisEnabled = process.env.BULK_UPLOAD_ANALYSIS_ENABLED === 'true';

/**
 * Genera hash del archivo para cache
 */
function generateFileHash(fileURL) {
  return crypto.createHash('md5').update(fileURL).digest('hex');
}

/**
 * Compara dos textos con similitud simple (Jaccard) o con pesos de palabras
 * @param {string} text1 - Primer texto
 * @param {string} text2 - Segundo texto
 * @param {Object} wordWeights - Pesos opcionales de palabras (ej: { "DNI": 2.5, "Recibo": 1.8 })
 * @returns {number} Similitud entre 0 y 1
 */
function compareTexts(text1, text2, wordWeights = {}) {
  if (!text1 || !text2) return 0;
  
  const t1 = text1.toLowerCase().trim();
  const t2 = text2.toLowerCase().trim();
  
  if (t1 === t2) return 1;
  
  const words1 = t1.split(/\s+/);
  const words2 = t2.split(/\s+/);
  
  // Si no hay wordWeights, usar Jaccard simple
  if (!wordWeights || Object.keys(wordWeights).length === 0) {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = [...set1].filter(w => set2.has(w));
    const union = new Set([...words1, ...words2]);
    return union.size > 0 ? intersection.length / union.size : 0;
  }
  
  // Similitud con pesos
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = [...set1].filter(w => set2.has(w));
  const union = new Set([...words1, ...words2]);
  
  // Calcular similitud ponderada
  let weightedIntersection = 0;
  let weightedUnion = 0;
  
  // Sumar pesos de intersección (palabras en común)
  intersection.forEach(word => {
    const weight = wordWeights[word] || 1;
    weightedIntersection += weight;
    weightedUnion += weight;
  });
  
  // Sumar pesos de palabras únicas
  [...union].forEach(word => {
    if (!intersection.includes(word)) {
      const weight = wordWeights[word] || 1;
      weightedUnion += weight;
    }
  });
  
  return weightedUnion > 0 ? weightedIntersection / weightedUnion : 0;
}

/**
 * Detecta campos comunes en el texto
 */
function detectFields(text, words = []) {
  if (!text) return {};
  
  const detected = {};
  
  // DNI (Argentina)
  const dniPattern = /\b\d{2}\.?\d{3}\.?\d{3}\b|\b\d{7,9}\b/;
  const dniMatch = text.match(dniPattern);
  if (dniMatch) {
    detected.dni = dniMatch[0].replace(/\./g, '');
  }
  
  // Patente (Argentina)
  const patentePattern = /\b[A-Z]{2,3}\s?\d{3}[A-Z]{0,3}\b|\b[A-Z]{2}\d{3}[A-Z]{2}\b/i;
  const patenteMatch = text.match(patentePattern);
  if (patenteMatch) {
    detected.patente = patenteMatch[0].replace(/\s/g, '').toUpperCase();
  }
  
  // Teléfono
  const telefonoPattern = /(\+?54\s?)?(\d{2,4}\s?[-.]?\s?\d{3,4}\s?[-.]?\s?\d{4})|(\(?\d{2,4}\)?\s?\d{3,4}\s?[-.]?\s?\d{4})/;
  const telefonoMatch = text.match(telefonoPattern);
  if (telefonoMatch) {
    detected.telefono = telefonoMatch[0].replace(/\s/g, '');
  }
  
  // Fechas
  const fechaPatterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/,
    /\b\d{1,2}\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{2,4}\b/i
  ];
  const fechas = [];
  fechaPatterns.forEach(pattern => {
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    if (matches) fechas.push(...matches);
  });
  if (fechas.length > 0) detected.fechas = fechas;
  
  // Nombres
  const nombrePattern = /(nombre|apellido|name)[\s:]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i;
  const nombreMatch = text.match(nombrePattern);
  if (nombreMatch) {
    detected.nombre = nombreMatch[2];
  }
  
  // Buscar nombres en palabras con mayúscula
  if (words && words.length > 0 && !detected.nombre) {
    const nombreWords = words.filter(w => 
      w.text && w.text.length > 2 && /^[A-ZÁÉÍÓÚÑ]/.test(w.text) && !/[0-9]/.test(w.text)
    );
    if (nombreWords.length > 0) {
      const posiblesNombres = nombreWords.slice(0, 3).map(w => w.text).join(' ');
      if (posiblesNombres.length > 3) detected.nombre = posiblesNombres;
    }
  }
  
  return detected;
}

/**
 * Obtiene texto de ejemplo desde archivo (sin OCR, solo texto si es PDF)
 */
async function getExampleText(exampleImageURL, baseURL) {
  if (!exampleImageURL) return null;
  
  try {
    // Primero intentar obtener texto directamente (si es PDF)
    const response = await axios.post(
      `${baseURL}/api/analyze-file`,
      { fileURL: exampleImageURL, lang: 'spa' },
      { timeout: 30000 }
    );
    
    return response.data.text || null;
  } catch (error) {
    console.warn('Error obteniendo texto de ejemplo:', error.message);
    return null;
  }
}

/**
 * Busca entidad por DNI o patente
 */
async function findMatchingEntity(companyId, entityType, searchValue, tenantPath) {
  if (!searchValue || !companyId) return null;
  
  try {
    let collectionName = '';
    let searchField = '';
    
    if (entityType === 'employee' || entityType === 'personal') {
      collectionName = 'personal';
      searchField = 'dni';
    } else if (entityType === 'vehicle' || entityType === 'vehiculo') {
      collectionName = 'vehiculos';
      searchField = 'patente';
    } else {
      return null;
    }
    
    const normalizedValue = searchValue.replace(/[.\s-]/g, '').toUpperCase();
    const collectionPath = `${tenantPath}/${collectionName}`;
    const snapshot = await db.collection(collectionPath)
      .where('companyId', '==', companyId)
      .limit(20)
      .get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const fieldValue = data[searchField];
      
      if (fieldValue) {
        const normalized = String(fieldValue).replace(/[.\s-]/g, '').toUpperCase();
        if (normalized === normalizedValue || 
            normalized.includes(normalizedValue) || 
            normalizedValue.includes(normalized)) {
          return { id: doc.id, ...data };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error buscando entidad:', error);
    return null;
  }
}

/**
 * Procesa archivos en batch con límite de concurrencia
 */
async function processBatchWithCache(files, baseURL, lang, tenantPath, userId, companyId, concurrencyLimit = 3) {
  const results = [];
  const ocrCachePath = `${tenantPath}/ocrResults`;
  
  for (let i = 0; i < files.length; i += concurrencyLimit) {
    const batch = files.slice(i, i + concurrencyLimit);
    
    const batchPromises = batch.map(async (file, index) => {
      const globalIndex = i + index;
      try {
        console.log(`📄 [${globalIndex + 1}/${files.length}] Procesando: ${file.fileName}`);
        
        // Verificar cache OCR
        const fileHash = generateFileHash(file.fileURL);
        const cacheRef = db.collection(ocrCachePath).doc(fileHash);
        const cacheDoc = await cacheRef.get();
        
        let ocrResult;
        
        if (cacheDoc.exists) {
          console.log(`✅ Cache hit para ${file.fileName}`);
          ocrResult = cacheDoc.data();
        } else {
          // Analizar archivo (aumentar timeout a 120 segundos para archivos grandes)
          const response = await axios.post(
            `${baseURL}/api/analyze-file`,
            { fileURL: file.fileURL, lang },
            { timeout: 120000 } // 120 segundos
          );
          
          ocrResult = {
            text: response.data.text || '',
            type: response.data.type || 'unknown',
            words: response.data.words || [],
            imageURL: response.data.imageURL || null
          };
          
          // Guardar en cache
          await cacheRef.set({
            ...ocrResult,
            fileHash,
            fileURL: file.fileURL,
            cachedAt: new Date().toISOString()
          });
        }
        
        return {
          success: true,
          fileIndex: globalIndex,
          fileName: file.fileName,
          fileURL: file.fileURL,
          ...ocrResult
        };
      } catch (error) {
        console.error(`❌ Error procesando ${file.fileName}:`, error.message);
        return {
          success: false,
          fileIndex: globalIndex,
          fileName: file.fileName,
          fileURL: file.fileURL,
          error: error.message
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    const processed = Math.min(i + concurrencyLimit, files.length);
    console.log(`✅ Progreso: ${processed}/${files.length} archivos procesados`);
  }
  
  return results;
}

/**
 * Agrupa archivos similares
 */
function groupSimilarFiles(files, threshold = 0.5) {
  const groups = [];
  const processed = new Set();
  
  files.forEach((file, index) => {
    if (processed.has(index)) return;
    
    const group = [index];
    processed.add(index);
    
    files.forEach((otherFile, otherIndex) => {
      if (index === otherIndex || processed.has(otherIndex)) return;
      
      const similarity = compareTexts(file.text || '', otherFile.text || '');
      if (similarity >= threshold) {
        group.push(otherIndex);
        processed.add(otherIndex);
      }
    });
    
    if (group.length > 1) {
      groups.push(group);
    }
  });
  
  return groups;
}

/**
 * Ruta unificada: preparar análisis y clasificación
 */
router.post('/prepare', authenticateFirebaseUser, async (req, res) => {
  try {
    if (!bulkUploadAnalysisEnabled) {
      return res.status(503).json({
        error: 'El análisis masivo con OCR está deshabilitado temporalmente.'
      });
    }

    const { files, lang = 'spa', concurrencyLimit = 3, companyId: bodyCompanyId } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de archivos' });
    }
    
    const invalidFiles = files.filter(f => !f.fileURL || !f.fileName);
    if (invalidFiles.length > 0) {
      return res.status(400).json({ error: 'Todos los archivos deben tener fileURL y fileName' });
    }
    
    const userId = req.user.uid;
    // Obtener companyId del body o del usuario (prioridad al body)
    const companyId = bodyCompanyId || req.user.companyId;
    const tenantPath = `tenants/${req.tenantId || 'default'}`;
    const protocol = req.protocol;
    const host = req.get('host');
    const baseURL = `${protocol}://${host}`;
    
    console.log(`🔄 Preparando ${files.length} archivos para usuario ${userId}...`);
    console.log(`📋 CompanyId: ${companyId || 'NO DEFINIDO - esto causará problemas'}`);
    
    // 1. Análisis OCR con cache
    const ocrResults = await processBatchWithCache(
      files,
      baseURL,
      lang,
      tenantPath,
      userId,
      companyId,
      Math.min(concurrencyLimit, 5)
    );
    
    const successfulResults = ocrResults.filter(r => r.success);
    const failedResults = ocrResults.filter(r => !r.success);
    
    console.log(`📊 Resultados OCR: ${successfulResults.length} exitosos, ${failedResults.length} fallidos`);
    
    if (failedResults.length > 0) {
      console.warn('⚠️ Archivos que fallaron en OCR:');
      failedResults.forEach(r => {
        console.warn(`  ❌ ${r.fileName}: ${r.error || 'Error desconocido'}`);
      });
    }
    
    // Incluir archivos fallidos en la respuesta pero marcados como error
    // para que aparezcan en la revisión y el usuario pueda ver qué pasó
    if (successfulResults.length === 0 && failedResults.length > 0) {
      return res.status(500).json({ 
        error: 'No se pudo analizar ningún archivo',
        failedFiles: failedResults.map(r => ({
          fileName: r.fileName,
          fileURL: r.fileURL,
          error: r.error
        }))
      });
    }
    
    // 2. Obtener documentos requeridos
    if (!companyId) {
      console.warn('⚠️ No se encontró companyId. No se podrán buscar documentos requeridos.');
      return res.status(400).json({ 
        error: 'companyId es requerido. Por favor, envíalo en el body de la request.' 
      });
    }
    
    const requiredDocsPath = `${tenantPath}/requiredDocuments`;
    console.log(`📋 Buscando documentos requeridos en: ${requiredDocsPath} para companyId: ${companyId}`);
    
    const requiredDocsSnapshot = await db.collection(requiredDocsPath)
      .where('companyId', '==', companyId)
      .limit(100)
      .get();
    
    const requiredDocuments = requiredDocsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Encontrados ${requiredDocuments.length} documentos requeridos`);
    
    const docsWithExamples = requiredDocuments.filter(doc => doc.exampleImage);
    console.log(`📸 ${docsWithExamples.length} documentos tienen imagen de ejemplo`);
    
    // 3. Obtener textos de ejemplo (usar metadata guardada si está disponible, sino analizar)
    const exampleTextsCache = new Map();
    
    for (const reqDoc of requiredDocuments) {
      if (reqDoc.exampleImage && !exampleTextsCache.has(reqDoc.id)) {
        // Priorizar metadata guardada si está disponible
        if (reqDoc.exampleMetadata && reqDoc.exampleMetadata.text) {
          const exampleText = reqDoc.exampleMetadata.text;
          const wordWeights = reqDoc.exampleMetadata.wordWeights || {};
          exampleTextsCache.set(reqDoc.id, { text: exampleText, wordWeights });
          console.log(`✅ Usando metadata guardada para "${reqDoc.name}": ${exampleText.length} caracteres${Object.keys(wordWeights).length > 0 ? `, ${Object.keys(wordWeights).length} palabras con peso` : ''}`);
        } else {
          // Fallback: analizar el ejemplo si no hay metadata guardada
          console.log(`🔍 Extrayendo texto del ejemplo para documento: ${reqDoc.name} (${reqDoc.id})`);
          const exampleText = await getExampleText(reqDoc.exampleImage, baseURL);
          if (exampleText) {
            exampleTextsCache.set(reqDoc.id, { text: exampleText, wordWeights: {} });
            console.log(`✅ Texto extraído del ejemplo "${reqDoc.name}": ${exampleText.length} caracteres`);
          } else {
            console.warn(`⚠️ No se pudo extraer texto del ejemplo para "${reqDoc.name}"`);
          }
        }
      }
    }
    
    console.log(`📚 Cache de ejemplos: ${exampleTextsCache.size} documentos con texto extraído`);
    
    // 4. Clasificar cada archivo
    const suggestions = [];
    const analysisId = crypto.randomUUID();
    const analysisLog = {
      analysisId,
      userId,
      companyId,
      fileName: `${files.length} archivos`,
      totalFiles: files.length,
      timestamp: new Date().toISOString(),
      files: []
    };
    
    // Procesar archivos exitosos
    for (let i = 0; i < successfulResults.length; i++) {
      const fileData = successfulResults[i];
      const fileText = fileData.text || '';
      
      if (!fileText || fileText.trim().length === 0) {
        console.warn(`⚠️ Archivo "${fileData.fileName}" no tiene texto extraído`);
      }
      
      // Detectar campos
      const detectedFields = detectFields(fileText, fileData.words || []);
      
      // Buscar documento requerido más similar
      let bestMatch = null;
      let bestScore = 0;
      
      console.log(`🔍 Comparando archivo "${fileData.fileName}" (${fileText.length} caracteres) con ${exampleTextsCache.size} ejemplos...`);
      
      for (const reqDoc of requiredDocuments) {
        if (!reqDoc.exampleImage) continue;
        
        const exampleData = exampleTextsCache.get(reqDoc.id);
        if (!exampleData) continue;
        
        // Manejar tanto string como objeto
        const exampleText = typeof exampleData === 'string' ? exampleData : exampleData.text;
        const wordWeights = typeof exampleData === 'object' && exampleData.wordWeights ? exampleData.wordWeights : {};
        
        if (!exampleText) continue;
        
        const similarity = compareTexts(fileText, exampleText, wordWeights);
        
        if (similarity > 0) {
          console.log(`  📊 Similitud con "${reqDoc.name}": ${(similarity * 100).toFixed(1)}%`);
        }
        
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = {
            requiredDocumentId: reqDoc.id,
            requiredDocumentName: reqDoc.name,
            entityType: reqDoc.entityType || 'company',
            confidence: similarity
          };
        }
      }
      
      if (bestMatch) {
        console.log(`✅ Mejor match para "${fileData.fileName}": "${bestMatch.requiredDocumentName}" (${(bestScore * 100).toFixed(1)}% confianza)`);
      } else {
        console.warn(`⚠️ No se encontró match para "${fileData.fileName}"`);
      }
      
      // Determinar entityType por campos detectados
      let suggestedEntityType = bestMatch?.entityType || 'company';
      if (detectedFields.dni && !bestMatch) {
        suggestedEntityType = 'employee';
      } else if (detectedFields.patente && !bestMatch) {
        suggestedEntityType = 'vehicle';
      }
      
      // Buscar entidad
      let matchedEntity = null;
      let matchedEntityId = null;
      
      if (detectedFields.dni && (suggestedEntityType === 'employee' || suggestedEntityType === 'personal')) {
        matchedEntity = await findMatchingEntity(companyId, 'personal', detectedFields.dni, tenantPath);
        if (matchedEntity) matchedEntityId = matchedEntity.id;
      }
      
      if (detectedFields.patente && (suggestedEntityType === 'vehicle' || suggestedEntityType === 'vehiculo')) {
        matchedEntity = await findMatchingEntity(companyId, 'vehiculo', detectedFields.patente, tenantPath);
        if (matchedEntity) matchedEntityId = matchedEntity.id;
      }
      
      const suggestion = {
        fileIndex: i,
        fileName: fileData.fileName,
        fileURL: fileData.fileURL,
        requiredDocumentId: bestMatch?.requiredDocumentId || null,
        requiredDocumentName: bestMatch?.requiredDocumentName || null,
        entityType: suggestedEntityType,
        entityId: matchedEntityId || null,
        entityName: matchedEntity?.nombre || matchedEntity?.patente || null,
        confidence: bestMatch?.confidence || 0,
        detectedFields,
        words: fileData.words || [] // Para selector de texto
      };
      
      suggestions.push(suggestion);
      
      // Log de auditoría
      analysisLog.files.push({
        fileName: fileData.fileName,
        fileURL: fileData.fileURL,
        suggestion: {
          requiredDocumentId: suggestion.requiredDocumentId,
          entityType: suggestion.entityType,
          entityId: suggestion.entityId,
          confidence: suggestion.confidence
        },
        detectedFields
      });
    }
    
    // Agregar archivos que fallaron en OCR a las sugerencias (para que aparezcan en la revisión)
    failedResults.forEach((failedFile, index) => {
      suggestions.push({
        fileIndex: successfulResults.length + index,
        fileName: failedFile.fileName,
        fileURL: failedFile.fileURL,
        requiredDocumentId: null,
        requiredDocumentName: null,
        entityType: 'company',
        entityId: null,
        entityName: null,
        confidence: 0,
        detectedFields: {},
        words: [],
        error: failedFile.error || 'Error al procesar archivo',
        success: false
      });
      
      console.warn(`⚠️ Archivo fallido agregado a sugerencias: ${failedFile.fileName}`);
    });
    
    // 5. Agrupar archivos similares
    const groups = groupSimilarFiles(successfulResults, 0.5);
    
    // 6. Guardar log de auditoría
    try {
      const auditLogPath = `${tenantPath}/bulkUploadLogs`;
      await db.collection(auditLogPath).doc(analysisId).set(analysisLog);
    } catch (logError) {
      console.warn('Error guardando log de auditoría:', logError);
    }
    
    console.log(`✅ Preparación completada: ${suggestions.length} sugerencias, ${groups.length} grupos`);
    
    return res.json({
      success: true,
      analysisId,
      suggestions,
      groups: groups.map(group => ({
        fileIndices: group,
        suggestedDocumentType: suggestions[group[0]]?.requiredDocumentId || null,
        suggestedEntityId: suggestions[group[0]]?.entityId || null
      })),
      total: files.length,
      processed: successfulResults.length,
      failed: ocrResults.length - successfulResults.length
    });
    
  } catch (error) {
    console.error('❌ Error en preparación masiva:', error);
    return res.status(500).json({
      error: 'Error al preparar análisis masivo',
      detalle: error.message
    });
  }
});

export default router;
