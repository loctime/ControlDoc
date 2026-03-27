// routes/extractPdfPagesRoute.js
import express from 'express';
import { extractPagesFromPDF } from '../services/pdfService.js';

const router = express.Router();

/**
 * POST /api/extract-pdf-pages
 * Extrae páginas específicas de un PDF y devuelve un nuevo PDF
 * 
 * Body:
 * {
 *   "pdfUrl": "https://cdn.controldoc.app/file/...",
 *   "pageNumbers": [1, 3, 5]
 * }
 */
router.post('/extract-pdf-pages', async (req, res) => {
  try {
    const { pdfUrl, pageNumbers } = req.body;
    
    // Validar parámetros
    if (!pdfUrl) {
      return res.status(400).json({ 
        error: 'pdfUrl es requerido' 
      });
    }
    
    if (!pageNumbers || !Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      return res.status(400).json({ 
        error: 'pageNumbers debe ser un array con al menos un número de página' 
      });
    }
    
    // Validar que todos los números de página sean enteros positivos
    const invalidPages = pageNumbers.filter(pageNum => 
      !Number.isInteger(pageNum) || pageNum < 1
    );
    
    if (invalidPages.length > 0) {
      return res.status(400).json({ 
        error: `Números de página inválidos: ${invalidPages.join(', ')}. Deben ser enteros positivos.` 
      });
    }
    
    console.log(`[Extract PDF Route] Extrayendo páginas ${pageNumbers.join(', ')} de:`, pdfUrl);
    
    // Extraer páginas del PDF
    const extractedPdfBuffer = await extractPagesFromPDF(pdfUrl, pageNumbers);
    
    // Configurar headers para descarga de PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', extractedPdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="extracted_pages_${pageNumbers.join('-')}.pdf"`);
    
    // Enviar PDF extraído
    res.send(extractedPdfBuffer);
    
    console.log(`[Extract PDF Route] PDF extraído enviado exitosamente, tamaño: ${extractedPdfBuffer.length} bytes`);
    
  } catch (error) {
    console.error('[Extract PDF Route] Error:', error);
    res.status(500).json({ 
      error: 'Error extrayendo páginas del PDF', 
      details: error.message 
    });
  }
});

export default router;
