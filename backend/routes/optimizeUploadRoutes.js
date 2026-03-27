//backend/routes/optimizeUploadRoutes.js
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB máximo para imágenes optimizadas

/**
 * POST /api/optimize-upload
 * Optimiza imagen mejorando nitidez y compresión, devolviendo la imagen procesada.
 */
router.post('/',
  authenticateFirebaseUser,
  upload.single('image'),
  async (req, res) => {
    try {
      console.log('--- Nueva solicitud de optimización de imagen recibida ---');
      console.log('Usuario autenticado:', req.user);
      console.log('Headers:', req.headers);
      console.log('Archivo recibido:', req.file && {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      if (!req.file || !req.file.buffer) {
        console.warn('No se recibió buffer de imagen');
        return res.status(400).json({ error: 'No se recibió ninguna imagen válida' });
      }

      if (req.file.size > MAX_FILE_SIZE) {
        console.warn('Imagen excede el tamaño permitido:', req.file.size);
        return res.status(400).json({ error: 'La imagen excede el tamaño máximo de 10MB' });
      }

      const { originalname, buffer, mimetype } = req.file;
      if (!SUPPORTED_FORMATS.includes(mimetype)) {
        console.warn('Formato de imagen no soportado:', mimetype);
        return res.status(400).json({ error: 'Formato no soportado. Solo JPG, PNG, WEBP' });
      }

      console.log('[optimize-upload] 📥 Procesando imagen:', originalname, mimetype, buffer.length);

      // Parámetros de optimización desde el frontend
      const quality = parseInt(req.body.quality) || 90;
      const maxWidth = parseInt(req.body.maxWidth) || 2000;
      const maxHeight = parseInt(req.body.maxHeight) || 2000;
      const enhanceForOCR = req.body.enhanceForOCR === 'true';
      const preserveText = req.body.preserveText === 'true';

      console.log('[optimize-upload] ⚙️ Parámetros:', { quality, maxWidth, maxHeight, enhanceForOCR, preserveText });

      // Procesar imagen con optimizaciones para OCR
      let sharpInstance = sharp(buffer);
      
      // Aplicar mejoras específicas para OCR si se solicita
      if (enhanceForOCR || preserveText) {
        console.log('[optimize-upload] 🔍 Aplicando mejoras suaves para OCR...');
        
        // Mejoras suaves para preservar legibilidad del texto
        sharpInstance = sharpInstance
          .sharpen({ sigma: 0.5, flat: 1.0, jagged: 1.0 }) // Nitidez suave
          .modulate({ brightness: 1.1, contrast: 1.05 }); // Ajustes mínimos
        
        // Redimensionar manteniendo proporción y calidad
        sharpInstance = sharpInstance.resize({ 
          width: maxWidth, 
          height: maxHeight, 
          withoutEnlargement: true,
          fit: 'inside' // Mantener proporción sin recortar
        });
      } else {
        // Optimización estándar
        sharpInstance = sharpInstance
          .sharpen()
          .resize({ width: maxWidth, withoutEnlargement: true });
      }

      let outputBuffer, outType;
      if (mimetype === 'image/png') {
        outputBuffer = await sharpInstance.png({ 
          quality: quality, 
          compressionLevel: enhanceForOCR ? 6 : 8 // Menos compresión para OCR
        }).toBuffer();
        outType = 'image/png';
      } else if (mimetype === 'image/webp') {
        outputBuffer = await sharpInstance.webp({ 
          quality: quality,
          effort: enhanceForOCR ? 6 : 4 // Más esfuerzo para mejor calidad
        }).toBuffer();
        outType = 'image/webp';
      } else {
        outputBuffer = await sharpInstance.jpeg({ 
          quality: quality, 
          mozjpeg: true,
          progressive: enhanceForOCR // Progresivo para mejor calidad
        }).toBuffer();
        outType = 'image/jpeg';
      }

      console.log('[optimize-upload] ✅ Imagen optimizada. Tamaño final:', outputBuffer.length);

      res.set({
        'Content-Type': outType,
        'Content-Disposition': `attachment; filename=optimizada-${originalname}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      });
      res.send(outputBuffer);
    } catch (err) {
      console.error('[optimize-upload] ❌ Error:', err);
      const isProd = process.env.NODE_ENV === 'production';
      res.status(500).json({ 
        error: 'Error al optimizar imagen',
        ...(isProd ? {} : { details: err.message })
      });
    }
  }
);

export default router;
