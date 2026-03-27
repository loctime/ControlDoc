// services/pdfService.js
import { PDFDocument } from 'pdf-lib';
import Tesseract from 'tesseract.js';
import path from 'path';
import fs from 'fs/promises';
import { createRequire } from 'module';
import fetch from 'node-fetch';

/**
 * Convierte una imagen buffer (JPG o PNG) a un archivo PDF en formato Buffer
 * Versión optimizada para mejor rendimiento
 */
export const convertirImagenAPdf = async (buffer, extension) => {
  try {
    // Crear documento PDF con configuración optimizada
    const pdfDoc = await PDFDocument.create({
      // Configuraciones para mejor rendimiento
      updateMetadata: false, // No actualizar metadatos para mayor velocidad
    });
    
    let image;
    try {
      // Optimizar según el tipo de imagen
      if (extension === '.png') {
        image = await pdfDoc.embedPng(buffer);
      } else {
        image = await pdfDoc.embedJpg(buffer);
      }
    } catch (err) {
      throw new Error('No se pudo procesar la imagen. ¿Es realmente un PNG/JPG válido?');
    }
    
    // Crear página con dimensiones exactas de la imagen
    const page = pdfDoc.addPage([image.width, image.height]);
    
    // Dibujar imagen sin transformaciones adicionales para mayor velocidad
    page.drawImage(image, { 
      x: 0, 
      y: 0, 
      width: image.width, 
      height: image.height 
    });
    
    // Guardar con configuración optimizada
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: true, // Mejor compresión
      addDefaultPage: false, // No agregar página por defecto
      objectsPerTick: 50, // Procesar más objetos por tick
    });
    
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error en convertirImagenAPdf:', error);
    throw new Error(`Error al convertir imagen a PDF: ${error.message}`);
  }
};

/**
 * Versión rápida para conversiones simples sin OCR
 */
export const convertirImagenAPdfRapido = async (buffer, extension) => {
  try {
    const pdfDoc = await PDFDocument.create();
    
    let image;
    if (extension === '.png') {
      image = await pdfDoc.embedPng(buffer);
    } else {
      image = await pdfDoc.embedJpg(buffer);
    }
    
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    throw new Error(`Error en conversión rápida: ${error.message}`);
  }
};

/**
 * Extrae páginas específicas de un PDF desde URL
 */
export const extractPagesFromPDF = async (pdfUrl, pageNumbers) => {
  try {
    console.log(`[PDF Service] Extrayendo páginas ${pageNumbers.join(', ')} de PDF:`, pdfUrl);
    
    // Descargar PDF original
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Error descargando PDF: ${response.status} ${response.statusText}`);
    }
    
    const pdfBuffer = await response.arrayBuffer();
    console.log(`[PDF Service] PDF descargado, tamaño: ${pdfBuffer.byteLength} bytes`);
    
    // Cargar PDF original
    const originalPdf = await PDFDocument.load(pdfBuffer);
    const totalPages = originalPdf.getPageCount();
    console.log(`[PDF Service] PDF cargado, total de páginas: ${totalPages}`);
    
    // Validar números de página
    const validPages = pageNumbers.filter(pageNum => {
      if (pageNum < 1 || pageNum > totalPages) {
        console.warn(`[PDF Service] Página ${pageNum} no válida (total: ${totalPages})`);
        return false;
      }
      return true;
    });
    
    if (validPages.length === 0) {
      throw new Error('No hay páginas válidas para extraer');
    }
    
    console.log(`[PDF Service] Páginas válidas a extraer: ${validPages.join(', ')}`);
    
    // Crear nuevo PDF con páginas específicas
    const newPdf = await PDFDocument.create();
    
    // Copiar páginas (PDF-lib usa índices basados en 0)
    const pagesToCopy = validPages.map(pageNum => pageNum - 1);
    const copiedPages = await newPdf.copyPages(originalPdf, pagesToCopy);
    
    // Agregar páginas al nuevo PDF
    copiedPages.forEach(page => newPdf.addPage(page));
    
    // Guardar nuevo PDF
    const newPdfBytes = await newPdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });
    
    console.log(`[PDF Service] Nuevo PDF creado con ${copiedPages.length} página(s), tamaño: ${newPdfBytes.length} bytes`);
    
    return Buffer.from(newPdfBytes);
  } catch (error) {
    console.error('[PDF Service] Error extrayendo páginas:', error);
    throw new Error(`Error extrayendo páginas del PDF: ${error.message}`);
  }
};

/**
 * Compara dos textos con similitud Jaccard o con pesos de palabras
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
  
  let weightedIntersection = 0;
  let weightedUnion = 0;
  
  intersection.forEach(word => {
    const weight = wordWeights[word] || 1;
    weightedIntersection += weight;
    weightedUnion += weight;
  });
  
  [...union].forEach(word => {
    if (!intersection.includes(word)) {
      const weight = wordWeights[word] || 1;
      weightedUnion += weight;
    }
  });
  
  return weightedUnion > 0 ? weightedIntersection / weightedUnion : 0;
}

/**
 * Analiza un PDF y detecta posibles separaciones de documentos
 * Retorna sugerencias de páginas donde podrían comenzar nuevos documentos
 * @param {string} pdfUrl - URL del PDF a analizar
 * @param {string} baseURL - URL base del servidor
 * @param {string} companyId - ID de la compañía para obtener documentos requeridos
 * @param {string} tenantPath - Ruta del tenant (ej: "tenants/hise")
 * @param {Object} db - Instancia de Firestore
 */
export const detectDocumentSeparations = async (pdfUrl, baseURL, companyId = null, tenantPath = null, db = null) => {
  try {
    console.log(`[PDF Service] Detectando separaciones en PDF:`, pdfUrl);
    
    // Descargar PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Error descargando PDF: ${response.status} ${response.statusText}`);
    }
    
    const pdfBuffer = await response.arrayBuffer();
    const originalPdf = await PDFDocument.load(pdfBuffer);
    const totalPages = originalPdf.getPageCount();
    
    console.log(`[PDF Service] PDF cargado, total de páginas: ${totalPages}`);
    
    // Obtener texto de cada página usando el endpoint de análisis
    const pageTexts = [];
    const pageAnalyses = [];
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        // Extraer página individual para análisis
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(originalPdf, [pageNum - 1]);
        singlePagePdf.addPage(copiedPage);
        
        const pageBytes = await singlePagePdf.save();
        const pageBuffer = Buffer.from(pageBytes);
        
        // Analizar página con OCR/texto - usar OCR si el PDF no tiene suficiente texto
        const pageText = await extractTextFromPageBuffer(pageBuffer, true);
        
        const pageSize = copiedPage.getSize();
        const pageOrientation = pageSize.width > pageSize.height ? 'landscape' : 'portrait';
        
        pageTexts.push(pageText);
        pageAnalyses.push({
          pageNum,
          text: pageText,
          textLength: pageText.length,
          orientation: pageOrientation,
          width: pageSize.width,
          height: pageSize.height,
          isBlank: pageText.trim().length < 50 // Página "en blanco" si tiene menos de 50 caracteres
        });
        
        console.log(`[PDF Service] Página ${pageNum}/${totalPages} analizada: ${pageText.length} caracteres`);
      } catch (error) {
        console.warn(`[PDF Service] Error analizando página ${pageNum}:`, error.message);
        pageTexts.push('');
        pageAnalyses.push({
          pageNum,
          text: '',
          textLength: 0,
          orientation: 'unknown',
          isBlank: true
        });
      }
    }
    
    // Obtener documentos requeridos si están disponibles
    let requiredDocuments = [];
    let exampleTextsCache = new Map();
    
    if (companyId && tenantPath && db) {
      try {
        const requiredDocsPath = `${tenantPath}/requiredDocuments`;
        console.log(`[PDF Service] Buscando documentos requeridos en: ${requiredDocsPath} para companyId: ${companyId}`);
        
        const requiredDocsSnapshot = await db.collection(requiredDocsPath)
          .where('companyId', '==', companyId)
          .limit(100)
          .get();
        
        requiredDocuments = requiredDocsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log(`[PDF Service] Encontrados ${requiredDocuments.length} documentos requeridos`);
        
        // Preparar cache de textos de ejemplo
        for (const reqDoc of requiredDocuments) {
          if (reqDoc.exampleImage && reqDoc.exampleMetadata && reqDoc.exampleMetadata.text) {
            const exampleText = reqDoc.exampleMetadata.text;
            const wordWeights = reqDoc.exampleMetadata.wordWeights || {};
            exampleTextsCache.set(reqDoc.id, { text: exampleText, wordWeights });
          }
        }
        
        console.log(`[PDF Service] Cache de ejemplos preparado: ${exampleTextsCache.size} documentos`);
      } catch (error) {
        console.warn(`[PDF Service] Error obteniendo documentos requeridos: ${error.message}`);
      }
    }
    
    // Detectar posibles separaciones
    const separations = detectSeparationsFromAnalyses(pageAnalyses, requiredDocuments, exampleTextsCache);
    
    console.log(`[PDF Service] Separaciones detectadas: ${separations.length} sugerencias`);
    
    return {
      totalPages,
      separations,
      pageAnalyses: pageAnalyses.map(a => ({
        pageNum: a.pageNum,
        textLength: a.textLength,
        orientation: a.orientation,
        isBlank: a.isBlank,
        text: a.text // Incluir texto para detección de patrones
      }))
    };
  } catch (error) {
    console.error('[PDF Service] Error detectando separaciones:', error);
    throw new Error(`Error detectando separaciones: ${error.message}`);
  }
};

// Cache para Tesseract para evitar recargar el worker
let tesseractWorker = null;

// Importación condicional de pdf-poppler para evitar errores en Linux
let PdfConverter = null;

async function loadPdfConverter() {
  if (PdfConverter !== undefined) return PdfConverter;
  
  const isLinux = process.platform === 'linux' || process.env.RENDER;
  
  if (isLinux) {
    PdfConverter = null;
    return null;
  }
  
  try {
    const pkg = await import('pdf-poppler');
    PdfConverter = pkg.PdfConverter;
  } catch (error) {
    PdfConverter = null;
  }
  return PdfConverter;
}

// Función optimizada para inicializar Tesseract
async function getTesseractWorker() {
  if (!tesseractWorker) {
    tesseractWorker = await Tesseract.createWorker({
      logger: m => {
        if (m.status === 'recognizing text') {
          // Log silencioso para separaciones
        }
      }
    });
    await tesseractWorker.loadLanguage('spa+eng');
    await tesseractWorker.initialize('spa+eng');
    await tesseractWorker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_ocr_engine_mode: '3',
      preserve_interword_spaces: '1'
    });
  }
  return tesseractWorker;
}

async function convertPDFPageToImage(buffer, page = 1) {
  try {
    const converter = await loadPdfConverter();
    if (!converter) {
      throw new Error('pdf-poppler no está disponible en este entorno');
    }

    const tmpDir = '/tmp';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1e6);
    const prefix = `temp_${timestamp}_${random}`;
    const tmpPDF = path.join(tmpDir, `${prefix}.pdf`);
    // pdf-poppler genera archivos como: prefix-1.png
    const tmpImage = path.join(tmpDir, `${prefix}-${page}.png`);

    await fs.writeFile(tmpPDF, buffer);

    try {
      await converter.convert(tmpPDF, {
        format: 'png',
        out_dir: tmpDir,
        out_prefix: prefix,
        page: page,
        scale: 300
      });

      const imgBuffer = await fs.readFile(tmpImage);

      // Limpiar archivos temporales
      try {
        await fs.unlink(tmpPDF);
        await fs.unlink(tmpImage);
      } catch (cleanupError) {
        // Ignorar errores de limpieza
      }

      return imgBuffer;
    } catch (convertError) {
      // Limpiar archivos temporales en caso de error
      try {
        await fs.unlink(tmpPDF).catch(() => {});
        await fs.unlink(tmpImage).catch(() => {});
      } catch (cleanupError) {
        // Ignorar errores de limpieza
      }
      throw convertError;
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Extrae texto de un buffer PDF usando pdf-parse, y si no hay suficiente texto, usa OCR
 */
async function extractTextFromPageBuffer(buffer, useOCR = true) {
  try {
    const require = createRequire(import.meta.url);
    const pdf = require('pdf-parse');
    
    const data = await pdf(buffer);
    const extractedText = data.text || '';
    
    // Si hay suficiente texto (más de 50 caracteres), retornarlo
    if (extractedText.trim().length >= 50) {
      return extractedText;
    }
    
    // Si no hay suficiente texto y useOCR está habilitado, intentar OCR
    if (useOCR && extractedText.trim().length < 50) {
      try {
        const converter = await loadPdfConverter();
        if (!converter) {
          // En Linux/Render, pdf-poppler no está disponible
          return extractedText;
        }
        
        const imgBuffer = await convertPDFPageToImage(buffer, 1);
        const worker = await getTesseractWorker();
        const result = await worker.recognize(imgBuffer);
        const ocrText = result.data.text || '';
        
        // Si OCR encontró más texto, usar ese
        if (ocrText.trim().length > extractedText.trim().length) {
          return ocrText;
        }
      } catch (ocrError) {
        // Si OCR falla, usar el texto extraído del PDF
        console.warn(`[PDF Service] OCR falló para página: ${ocrError.message}`);
      }
    }
    
    return extractedText;
  } catch (error) {
    console.warn('[PDF Service] Error extrayendo texto del PDF:', error.message);
    return '';
  }
}

/**
 * Detecta separaciones basándose en análisis de páginas y comparación con documentos requeridos
 * @param {Array} pageAnalyses - Análisis de cada página del PDF
 * @param {Array} requiredDocuments - Documentos requeridos de la compañía
 * @param {Map} exampleTextsCache - Cache de textos de ejemplo con wordWeights
 */
function detectSeparationsFromAnalyses(pageAnalyses, requiredDocuments = [], exampleTextsCache = new Map()) {
  const separations = [];
  const confidenceThreshold = 0.5; // Umbral reducido para incluir más detecciones
  
  // Trackear qué tipo de documento se detecta en cada página
  const pageDocumentTypes = [];
  
  for (let i = 0; i < pageAnalyses.length; i++) {
    const page = pageAnalyses[i];
    let bestMatch = null;
    let bestScore = 0;
    
    // Comparar página con documentos requeridos si están disponibles
    if (requiredDocuments.length > 0 && exampleTextsCache.size > 0 && page.text && page.text.trim().length > 20) {
      for (const reqDoc of requiredDocuments) {
        const exampleData = exampleTextsCache.get(reqDoc.id);
        if (!exampleData) continue;
        
        const exampleText = exampleData.text;
        const wordWeights = exampleData.wordWeights || {};
        
        if (!exampleText) continue;
        
        const similarity = compareTexts(page.text, exampleText, wordWeights);
        
        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = {
            requiredDocumentId: reqDoc.id,
            requiredDocumentName: reqDoc.name,
            similarity: similarity
          };
        }
      }
    }
    
    pageDocumentTypes.push({
      pageNum: page.pageNum,
      documentType: bestMatch,
      similarity: bestScore
    });
  }
  
  // Detectar separaciones basándose en:
  // 1. Cambios de tipo de documento entre páginas
  // 2. Heurísticas visuales (páginas en blanco, orientación, etc.)
  for (let i = 1; i < pageAnalyses.length; i++) {
    const prevPage = pageAnalyses[i - 1];
    const currPage = pageAnalyses[i];
    const prevDocType = pageDocumentTypes[i - 1];
    const currDocType = pageDocumentTypes[i];
    
    let confidence = 0;
    let reasons = [];
    
    // 1. Cambio de tipo de documento detectado (MUY ALTA confianza si similitud > 0.3)
    if (prevDocType.documentType && currDocType.documentType) {
      if (prevDocType.documentType.requiredDocumentId !== currDocType.documentType.requiredDocumentId) {
        if (prevDocType.similarity > 0.3 && currDocType.similarity > 0.3) {
          confidence += 0.5;
          reasons.push(`Cambio de documento: "${prevDocType.documentType.requiredDocumentName}" → "${currDocType.documentType.requiredDocumentName}"`);
        }
      }
    } else if (!prevDocType.documentType && currDocType.documentType && currDocType.similarity > 0.3) {
      // Nueva página con documento detectado después de página sin match
      confidence += 0.4;
      reasons.push(`Nuevo documento detectado: "${currDocType.documentType.requiredDocumentName}" (similitud: ${(currDocType.similarity * 100).toFixed(1)}%)`);
    } else if (prevDocType.documentType && !currDocType.documentType && prevDocType.similarity > 0.3) {
      // Página sin match después de documento detectado
      confidence += 0.3;
      reasons.push(`Fin de documento "${prevDocType.documentType.requiredDocumentName}"`);
    }
    
    // 2. Página en blanco (alta confianza)
    if (currPage.isBlank && !prevPage.isBlank) {
      confidence += 0.4;
      reasons.push('Página en blanco después de contenido');
    }
    
    // 3. Cambio de orientación (alta confianza)
    if (currPage.orientation !== prevPage.orientation && currPage.orientation !== 'unknown') {
      confidence += 0.3;
      reasons.push(`Cambio de orientación (${prevPage.orientation} → ${currPage.orientation})`);
    }
    
    // 4. Cambio drástico en cantidad de texto (media confianza)
    const textRatio = prevPage.textLength > 0 
      ? currPage.textLength / prevPage.textLength 
      : 0;
    
    if (textRatio > 2 || (textRatio < 0.3 && currPage.textLength > 100)) {
      confidence += 0.2;
      reasons.push(`Cambio drástico en cantidad de texto (ratio: ${textRatio.toFixed(2)})`);
    }
    
    // 5. Patrones de texto comunes (baja-media confianza)
    const hasTitlePattern = /^(DOCUMENTO|CERTIFICADO|COMPROBANTE|RECIBO|DECLARACI[OÓ]N|FORMULARIO|SOLICITUD)/i.test(currPage.text);
    const hasDatePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(currPage.text);
    const hasDniPattern = /\b\d{2}\.?\d{3}\.?\d{3}\b/.test(currPage.text);
    
    if (hasTitlePattern && currPage.textLength > 200) {
      confidence += 0.15;
      reasons.push('Patrón de título de documento detectado');
    }
    
    if (hasDatePattern && hasDniPattern && currPage.textLength > 150) {
      confidence += 0.15;
      reasons.push('Patrones comunes de documento (fecha + DNI) detectados');
    }
    
    // 6. Patrón de página inicial
    if (i === 1 && currPage.textLength > 200 && prevPage.isBlank) {
      confidence += 0.2;
      reasons.push('Página inicial de documento después de página en blanco');
    }
    
    // Si la confianza supera el umbral, es una separación sugerida
    if (confidence >= confidenceThreshold) {
      separations.push({
        pageNumber: currPage.pageNum,
        confidence: Math.min(confidence, 1.0),
        reasons,
        previousPage: prevPage.pageNum,
        context: {
          prevTextLength: prevPage.textLength,
          currTextLength: currPage.textLength,
          prevOrientation: prevPage.orientation,
          currOrientation: currPage.orientation,
          prevDocType: prevDocType.documentType?.requiredDocumentName || null,
          currDocType: currDocType.documentType?.requiredDocumentName || null
        }
      });
    }
  }
  
  // Asegurar que la primera página siempre esté incluida si hay separaciones
  if (separations.length > 0 && separations[0].pageNumber !== 1) {
    const firstPageWithContent = pageAnalyses.findIndex(p => !p.isBlank && p.textLength > 100);
    if (firstPageWithContent >= 0 && firstPageWithContent < pageAnalyses.length - 1) {
      separations.unshift({
        pageNumber: firstPageWithContent + 1,
        confidence: 0.8,
        reasons: ['Primera página con contenido significativo'],
        previousPage: firstPageWithContent,
        context: {
          currTextLength: pageAnalyses[firstPageWithContent].textLength
        }
      });
    }
  }
  
  return separations.sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Separa un PDF en múltiples documentos basándose en páginas especificadas
 */
export const splitPDFIntoDocuments = async (pdfUrl, separationPages) => {
  try {
    console.log(`[PDF Service] Separando PDF en ${separationPages.length + 1} documentos`);
    
    // Descargar PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Error descargando PDF: ${response.status} ${response.statusText}`);
    }
    
    const pdfBuffer = await response.arrayBuffer();
    const originalPdf = await PDFDocument.load(pdfBuffer);
    const totalPages = originalPdf.getPageCount();
    
    // Ordenar páginas de separación
    const sortedSeparations = [...separationPages].sort((a, b) => a - b);
    
    // Crear rangos de páginas para cada documento
    const documentRanges = [];
    let startPage = 1;
    
    for (const separationPage of sortedSeparations) {
      if (separationPage > startPage && separationPage <= totalPages) {
        documentRanges.push({
          start: startPage,
          end: separationPage - 1,
          pageCount: separationPage - startPage
        });
        startPage = separationPage;
      }
    }
    
    // Agregar último documento
    if (startPage <= totalPages) {
      documentRanges.push({
        start: startPage,
        end: totalPages,
        pageCount: totalPages - startPage + 1
      });
    }
    
    console.log(`[PDF Service] Documentos a crear: ${documentRanges.length}`);
    
    // Crear cada documento
    const documents = [];
    for (let i = 0; i < documentRanges.length; i++) {
      const range = documentRanges[i];
      const pageNumbers = [];
      for (let p = range.start; p <= range.end; p++) {
        pageNumbers.push(p);
      }
      
      const documentBuffer = await extractPagesFromPDF(pdfUrl, pageNumbers);
      documents.push({
        index: i + 1,
        startPage: range.start,
        endPage: range.end,
        pageCount: range.pageCount,
        pdfBuffer: documentBuffer
      });
      
      console.log(`[PDF Service] Documento ${i + 1}/${documentRanges.length} creado: páginas ${range.start}-${range.end}`);
    }
    
    return documents;
  } catch (error) {
    console.error('[PDF Service] Error separando PDF:', error);
    throw new Error(`Error separando PDF: ${error.message}`);
  }
};