// backend/routes/analyzeFile.js
import express from 'express';
import axios from 'axios';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs/promises';
import { uploadFile as uploadToB2 } from '../services/backblazeService.js';

// Cache para Tesseract para evitar recargar el worker
let tesseractWorker = null;
let tesseractCache = new Map();

// Importación condicional de pdf-poppler para evitar errores en Linux
let PdfConverter = null;

async function loadPdfConverter() {
  if (PdfConverter !== undefined) return PdfConverter; // null significa que ya verificamos y no está disponible
  
  // Detectar si estamos en Linux/entorno no soportado
  const isLinux = process.platform === 'linux' || process.env.RENDER; // Render usa Linux
  
  if (isLinux) {
    console.warn('⚠️ pdf-poppler no disponible en Linux/Render. OCR para PDFs deshabilitado.');
    PdfConverter = null;
    return null;
  }
  
  try {
    const pkg = await import('pdf-poppler');
    PdfConverter = pkg.PdfConverter;
    console.log('✅ pdf-poppler cargado exitosamente');
  } catch (error) {
    console.warn('⚠️ pdf-poppler no disponible en este entorno:', error.message);
    PdfConverter = null;
  }
  return PdfConverter;
}

// Función optimizada para inicializar Tesseract con cache
async function getTesseractWorker() {
  if (!tesseractWorker) {
    console.log('🔄 Inicializando Tesseract worker optimizado...');
    tesseractWorker = await Tesseract.createWorker({
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`📝 OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
      errorHandler: (err) => console.warn('Tesseract warning:', err)
    });
    
    // Cargar idiomas español + inglés para mejor reconocimiento
    await tesseractWorker.loadLanguage('spa+eng');
    await tesseractWorker.initialize('spa+eng');
    
    // Configuración optimizada sin OSD para evitar errores de archivos faltantes
    await tesseractWorker.setParameters({
      tessedit_pageseg_mode: '6', // Uniform block of text (sin OSD)
      tessedit_ocr_engine_mode: '3', // Default LSTM + Legacy
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: '', // Sin restricciones para mejor reconocimiento
      textord_min_linesize: '2.0', // Líneas más pequeñas
      textord_old_baselines: '1', // Usar líneas base más precisas
      classify_bln_numeric_mode: '1', // Mejor reconocimiento de números
      textord_force_make_prop_words: 'F', // Forzar palabras proporcionales
      textord_min_xheight: '8' // Altura mínima de caracteres
    });
    
    console.log('✅ Tesseract worker optimizado inicializado');
  }
  return tesseractWorker;
}

// Función para generar hash simple de la imagen para cache
function generateImageHash(buffer) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(buffer).digest('hex');
}

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const router = express.Router();

const detectFileType = (url) => {
  const extension = url.split('.').pop().toLowerCase();
  if (["jpg", "jpeg", "png"].includes(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'word';
  if (["xls", "xlsx"].includes(extension)) return 'excel';
  return 'unknown';
};

const isURLSafe = (url) => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    return (
      hostname.endsWith('.backblazeb2.com') ||
      hostname === 'firebasestorage.googleapis.com' ||
      hostname.endsWith('.controldoc.app') ||
      hostname === 'controldoc.app'
    );
  } catch {
    return false;
  }
};

async function convertPDFPageToImage(buffer, page = 1) {
  try {
    const converter = await loadPdfConverter();
    if (!converter) {
      throw new Error('pdf-poppler no está disponible en este entorno');
    }

    const tmpDir = '/tmp';
    const tmpPDF = path.join(tmpDir, `temp_${Date.now()}.pdf`);
    const tmpImage = tmpPDF.replace('.pdf', `.png`);

    await fs.writeFile(tmpPDF, buffer);

    try {
      await converter.convert(tmpPDF, {
        format: 'png',
        out_dir: tmpDir,
        out_prefix: `temp_${Date.now()}`,
        page: page,
        scale: 300
      });

      const imgBuffer = await fs.readFile(tmpImage);

      // Limpiar archivos temporales
      try {
        await fs.unlink(tmpPDF);
        await fs.unlink(tmpImage);
      } catch (cleanupError) {
        console.warn('⚠️ Error limpiando archivos temporales:', cleanupError.message);
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
    // Envolver error con mensaje más claro
    if (error.message && error.message.includes('linux')) {
      throw new Error('OCR no disponible en Linux. El PDF no tiene suficiente texto extraíble.');
    }
    throw error;
  }
}

const extractWordsFromOCR = async (buffer, lang = 'spa') => {
  console.log('🔄 Iniciando OCR optimizado con Tesseract.js...');
  
  // Generar hash de la imagen para cache
  const imageHash = generateImageHash(buffer);
  
  // Verificar cache
  if (tesseractCache.has(imageHash)) {
    console.log('✅ Resultado encontrado en cache');
    return tesseractCache.get(imageHash);
  }
  
  try {
    const worker = await getTesseractWorker();
    
    // Procesar imagen con configuración básica para evitar errores internos
    const result = await worker.recognize(buffer);
    const data = result.data;

    // Extraer texto y palabras con coordenadas
    let words = [];
    try {
      if (data.words && Array.isArray(data.words)) {
        words = data.words
          .filter(w => {
            try {
              return w && 
                     w.text && 
                     w.text.trim().length > 0 && 
                     w.bbox && 
                     typeof w.bbox === 'object' &&
                     typeof w.bbox.x0 === 'number' &&
                     typeof w.bbox.y0 === 'number' &&
                     typeof w.bbox.x1 === 'number' &&
                     typeof w.bbox.y1 === 'number';
            } catch (e) {
              return false;
            }
          })
          .map(w => ({
            text: w.text.trim(),
            bbox: {
              x0: w.bbox.x0,
              y0: w.bbox.y0,
              x1: w.bbox.x1,
              y1: w.bbox.y1,
              page: { 
                width: data.imageSize?.width || 1000, 
                height: data.imageSize?.height || 1000 
              }
            }
          }));
      }
    } catch (error) {
      console.warn('⚠️ Error procesando palabras OCR, usando solo texto:', error.message);
      words = [];
    }

    const ocrResult = {
      text: data.text || '',
      words: words
    };
    
    // Guardar en cache
    if (tesseractCache.size > 50) {
      const firstKey = tesseractCache.keys().next().value;
      tesseractCache.delete(firstKey);
    }
    tesseractCache.set(imageHash, ocrResult);
    
    console.log('✅ OCR completado. Texto extraído:', ocrResult.text.length, 'caracteres');
    return ocrResult;
    
  } catch (error) {
    console.error('❌ Error crítico en OCR:', error.message);
    
    // Fallback: retornar resultado vacío pero válido
    const fallbackResult = {
      text: '',
      words: []
    };
    
    console.log('⚠️ Usando fallback OCR - resultado vacío');
    return fallbackResult;
  }
};

router.post('/', async (req, res) => {
  const { fileURL, lang = 'spa', docId } = req.body;
  if (!fileURL) return res.status(400).json({ error: 'Falta fileURL' });
  if (!isURLSafe(fileURL)) return res.status(403).json({ error: 'URL no permitida' });

  console.log('🔍 Recibida petición para analizar archivo:', fileURL);

  try {
    // Envolver todo en try-catch para evitar crashes del servidor
    // Aumentar límite a 50 MB para soportar PDFs grandes (frontend permite hasta 400 MB)
    const response = await axios.get(fileURL, {
      responseType: 'arraybuffer',
      maxContentLength: 50 * 1024 * 1024, // 50 MB
      maxBodyLength: 50 * 1024 * 1024, // 50 MB
      timeout: 120000 // 120 segundos de timeout para archivos grandes
    });

    const buffer = Buffer.from(response.data);
    console.log('📥 Archivo descargado. Bytes:', buffer.length);

    const fileType = await import('file-type').then(ft => ft.fileTypeFromBuffer(buffer));
    console.log('🔍 Tipo detectado:', fileType?.mime || 'desconocido');

    const type = detectFileType(fileURL);
    let text = '';
    let words = [];
    let ocrImageURL = null;

    if (type === 'image') {
      console.log('🖼️ Procesando imagen con OCR optimizado...');
      const ocrResult = await extractWordsFromOCR(buffer, lang);
      text = ocrResult.text;
      words = ocrResult.words;
      ocrImageURL = fileURL;
      console.log('✅ OCR completado para imagen. Texto extraído:', text.length);
    } else if (type === 'pdf') {
      console.log('📄 Procesando PDF...');
      try {
        const parsed = await pdf(buffer);
        console.log('📄 PDF parseado, texto extraído:', parsed.text?.length || 0);
        
        // Solo intentar OCR si el PDF no tiene texto o es muy poco (menos de 50 caracteres)
        // Primero verificar si pdf-poppler está disponible para evitar crashes
        if (!parsed.text || parsed.text.trim().length < 50) {
          console.log('🔄 PDF sin texto suficiente (' + (parsed.text?.length || 0) + ' caracteres)');
          
          // Verificar si pdf-poppler está disponible ANTES de intentar OCR
          const converter = await loadPdfConverter();
          if (!converter) {
            console.warn('⚠️ pdf-poppler no disponible en este entorno. Saltando OCR para PDF.');
            console.warn('⚠️ Usando texto extraído del PDF (' + (parsed.text?.length || 0) + ' caracteres)');
            text = parsed.text || '';
            words = [];
          } else {
            // pdf-poppler está disponible, intentar OCR
            console.log('🔄 Intentando OCR...');
            try {
              const imgBuffer = await convertPDFPageToImage(buffer, 1);
              console.log('🖼️ Imagen de PDF generada, tamaño:', imgBuffer.length);
              
              const ocrResult = await extractWordsFromOCR(imgBuffer, lang);
              text = ocrResult.text || parsed.text || '';
              words = ocrResult.words;
              
              console.log('✅ OCR completado para PDF. Texto detectado:', text.slice(0, 100));

              // Subir imagen OCR a Backblaze
              const ocrFileName = `${Date.now()}-${Math.floor(Math.random()*1e6)}-ocr.png`;
              const uploadResult = await uploadToB2(imgBuffer, 'image/png', {
                folder: 'ocr',
                fileName: ocrFileName
              });
              ocrImageURL = uploadResult.url;
              console.log('📤 Imagen OCR subida:', ocrImageURL);
            } catch (ocrError) {
              // Manejar errores de OCR sin crashear - usar el texto que se pudo extraer
              const errorMsg = ocrError.message || 'Error desconocido en OCR';
              console.warn('⚠️ OCR falló para PDF:', errorMsg);
              console.warn('⚠️ Usando texto extraído del PDF (' + (parsed.text?.length || 0) + ' caracteres)');
              text = parsed.text || '';
              words = [];
              // No lanzar error, simplemente continuar con el texto que tenemos
            }
          }
        } else {
          // PDF con texto suficiente, usar directamente
          text = parsed.text;
          words = [];
          console.log('✅ PDF con texto suficiente, omitiendo OCR');
        }
      } catch (pdfErr) {
        // Manejar errores de PDF sin crashear el servidor
        console.error('❌ Error procesando PDF:', pdfErr);
        const errorMsg = pdfErr.message || 'Error desconocido procesando PDF';
        // Si el error es de OCR en Linux, simplemente retornar texto vacío en lugar de crashear
        if (errorMsg.includes('linux') || errorMsg.includes('OCR')) {
          console.warn('⚠️ Error de OCR en Linux, retornando resultado parcial');
          return res.json({
            text: '',
            type: 'pdf',
            words: [],
            imageURL: null,
            fechasDetectadas: [],
            telefonosDetectados: [],
            cuitDetectado: [],
            dniDetectado: [],
            cedulasDetectadas: [],
            licenciasDetectadas: [],
            patentesDetectadas: [],
            nombresDetectados: [],
            codigosDetectados: [],
            titularDetectado: null,
            documentoDetectado: null,
            cbuDetectado: null,
            aliasDetectado: null,
            tipoCuentaDetectado: null,
            numeroCuentaDetectado: null,
            esCuentaCorriente: null
          });
        }
        throw new Error(`Error procesando PDF: ${errorMsg}`);
      }
    } else if (type === 'word') {
      console.log('Procesando documento Word...');
      const { value } = await mammoth.extractRawText({ buffer });
      text = value;
    } else if (type === 'excel') {
      console.log('Procesando archivo Excel...');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      workbook.SheetNames.forEach((name) => {
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
        sheet.slice(0, 100).forEach(row => {
          text += row.join(' ') + '\n';
        });
      });
    } else {
      return res.status(400).json({ error: 'Tipo de archivo no soportado' });
    }

    // Retornar resultado para todos los tipos de archivo
    console.log(`Procesamiento completado para ${type}. Texto extraído: ${text.length} caracteres, Palabras: ${words.length}`);
    return res.json({
      text,
      type,
      words,
      imageURL: ocrImageURL,
      fechasDetectadas: [],
      telefonosDetectados: [],
      cuitDetectado: [],
      dniDetectado: [],
      cedulasDetectadas: [],
      licenciasDetectadas: [],
      patentesDetectadas: [],
      nombresDetectados: [],
      codigosDetectados: [],
      titularDetectado: null,
      documentoDetectado: null,
      cbuDetectado: null,
      aliasDetectado: null,
      tipoCuentaDetectado: null,
      numeroCuentaDetectado: null,
      esCuentaCorriente: null
    });
  } catch (err) {
    // Manejar errores sin crashear el servidor
    console.error('❌ Error al analizar archivo:', err);
    const errorMsg = err.message || 'Error desconocido';
    
    // Si es un error de OCR/Linux, retornar respuesta vacía en lugar de error 500
    // Esto evita que el servidor se caiga y permite continuar procesando otros archivos
    if (errorMsg.includes('linux') || errorMsg.includes('OCR') || errorMsg.includes('pdf-poppler')) {
      console.warn('⚠️ Error de OCR/Linux detectado, retornando resultado vacío en lugar de crashear');
      return res.json({
        text: '',
        type: 'unknown',
        words: [],
        imageURL: null,
        fechasDetectadas: [],
        telefonosDetectados: [],
        cuitDetectado: [],
        dniDetectado: [],
        cedulasDetectadas: [],
        licenciasDetectadas: [],
        patentesDetectadas: [],
        nombresDetectados: [],
        codigosDetectados: [],
        titularDetectado: null,
        documentoDetectado: null,
        cbuDetectado: null,
        aliasDetectado: null,
        tipoCuentaDetectado: null,
        numeroCuentaDetectado: null,
        esCuentaCorriente: null
      });
    }
    
    // Para otros errores, retornar 500 pero sin crashear
    return res.status(500).json({ 
      error: 'Error al analizar archivo', 
      detalle: errorMsg 
    });
  }
});

export default router;
