// routes/convertImageRoute.js
import express from 'express';
import axios from 'axios';
import multer from 'multer';
import { convertirImagenAPdf, convertirImagenAPdfRapido } from '../services/pdfService.js';
import crypto from 'crypto';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Cache simple para conversiones
const conversionCache = new Map();
const CACHE_SIZE_LIMIT = 100;

// Función para generar hash de la imagen
function generateImageHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// Función para limpiar cache si es muy grande
function cleanCache() {
  if (conversionCache.size > CACHE_SIZE_LIMIT) {
    const keys = Array.from(conversionCache.keys());
    // Eliminar los primeros 20 elementos (más antiguos)
    keys.slice(0, 20).forEach(key => conversionCache.delete(key));
  }
}

// Nueva ruta: /api/convert-image/from-url
router.post('/from-url', async (req, res) => {
  try {
    const { imageUrl, fastMode = false } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'Falta imageUrl' });

    const extension = '.' + imageUrl.split('.').pop().toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(extension)) {
      return res.status(400).json({ error: 'Formato no soportado. Solo JPG y PNG' });
    }

    console.log(`🔄 Iniciando conversión de imagen: ${imageUrl} (fastMode: ${fastMode})`);

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: { Accept: 'image/png,image/jpeg' },
      timeout: 15000 // Reducir timeout a 15 segundos
    });
    
    const contentType = response.headers['content-type'];
    if (!['image/png', 'image/jpeg'].includes(contentType)) {
      return res.status(400).json({ error: 'La URL no apunta a una imagen válida' });
    }
    
    const buffer = Buffer.from(response.data);
    if (!buffer || buffer.length < 100) {
      return res.status(400).json({ error: 'La imagen descargada parece vacía o corrupta' });
    }

    // Generar hash para cache
    const imageHash = generateImageHash(buffer);
    const cacheKey = `${imageHash}-${fastMode}`;
    
    // Verificar cache
    if (conversionCache.has(cacheKey)) {
      console.log('✅ Conversión encontrada en cache');
      const cachedResult = conversionCache.get(cacheKey);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=convertido.pdf',
        'X-Cache': 'HIT'
      });
      return res.send(cachedResult);
    }

    console.log(`📥 Imagen descargada: ${buffer.length} bytes`);

    // Usar versión rápida si se solicita
    const pdfBuffer = fastMode 
      ? await convertirImagenAPdfRapido(buffer, extension)
      : await convertirImagenAPdf(buffer, extension);

    // Guardar en cache
    conversionCache.set(cacheKey, pdfBuffer);
    cleanCache();

    console.log(`✅ Conversión completada: ${pdfBuffer.length} bytes`);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=convertido.pdf',
      'X-Cache': 'MISS'
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[convert-image/from-url] Error:', err.message);
    res.status(500).json({ error: 'Error al convertir imagen a PDF' });
  }
});

/**
 * Ruta POST /
 * El path completo final es /api/convert-image
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length < 100) {
      return res.status(400).json({ error: 'Archivo inválido o vacío' });
    }
    
    const extension = '.' + req.file.originalname.split('.').pop().toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(extension)) {
      return res.status(400).json({ error: 'Formato no soportado. Solo JPG y PNG' });
    }

    console.log(`🔄 Iniciando conversión de archivo: ${req.file.originalname}`);

    // Generar hash para cache
    const imageHash = generateImageHash(req.file.buffer);
    const cacheKey = `${imageHash}-false`; // Siempre usar modo completo para archivos subidos
    
    // Verificar cache
    if (conversionCache.has(cacheKey)) {
      console.log('✅ Conversión encontrada en cache');
      const cachedResult = conversionCache.get(cacheKey);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=archivo.pdf',
        'X-Cache': 'HIT'
      });
      return res.send(cachedResult);
    }

    const pdfBuffer = await convertirImagenAPdf(req.file.buffer, extension);
    
    // Guardar en cache
    conversionCache.set(cacheKey, pdfBuffer);
    cleanCache();

    console.log(`✅ Conversión completada: ${pdfBuffer.length} bytes`);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=archivo.pdf',
      'X-Cache': 'MISS'
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[convert-image] Error:', err);
    res.status(500).json({ error: 'Error al convertir imagen a PDF' });
  }
});

export default router;
