// backend/routes/pdfSeparations.js
import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';
import { detectDocumentSeparations, splitPDFIntoDocuments } from '../services/pdfService.js';
import { uploadFile as uploadToB2 } from '../services/backblazeService.js';
import axios from 'axios';

const router = express.Router();
const db = getFirestore();

/**
 * POST /api/pdf-separations/detect
 * Detecta posibles separaciones de documentos en un PDF
 * 
 * Body:
 * {
 *   "pdfUrl": "https://cdn.controldoc.app/file/...",
 *   "fileName": "documento.pdf"
 * }
 */
router.post('/detect', authenticateFirebaseUser, async (req, res) => {
  try {
    const { pdfUrl, fileName, companyId: bodyCompanyId } = req.body;
    
    if (!pdfUrl) {
      return res.status(400).json({ error: 'pdfUrl es requerido' });
    }
    
    const protocol = req.protocol;
    const host = req.get('host');
    const baseURL = `${protocol}://${host}`;
    
    // Obtener companyId del body o del usuario (prioridad al body)
    const companyId = bodyCompanyId || req.user.companyId;
    const tenantPath = `tenants/${req.tenantId || 'default'}`;
    
    console.log(`[PDF Separations] Detectando separaciones en PDF:`, pdfUrl);
    console.log(`[PDF Separations] CompanyId: ${companyId || 'NO DEFINIDO'}`);
    console.log(`[PDF Separations] TenantPath: ${tenantPath}`);
    
    // Detectar separaciones con documentos requeridos si están disponibles
    const result = await detectDocumentSeparations(
      pdfUrl, 
      baseURL, 
      companyId, 
      tenantPath, 
      companyId ? db : null // Solo pasar db si hay companyId
    );
    
    console.log(`[PDF Separations] Separaciones detectadas: ${result.separations.length} sugerencias`);
    
    return res.json({
      success: true,
      totalPages: result.totalPages,
      separations: result.separations,
      pageAnalyses: result.pageAnalyses,
      fileName: fileName || 'documento.pdf'
    });
    
  } catch (error) {
    console.error('[PDF Separations] Error detectando separaciones:', error);
    return res.status(500).json({ 
      error: 'Error detectando separaciones',
      message: error.message 
    });
  }
});

/**
 * POST /api/pdf-separations/split
 * Separa un PDF en múltiples documentos basándose en páginas especificadas
 * 
 * Body:
 * {
 *   "pdfUrl": "https://cdn.controldoc.app/file/...",
 *   "fileName": "documento.pdf",
 *   "separationPages": [3, 7, 12], // Páginas donde comenzar nuevos documentos
 *   "companyId": "company123",
 *   "folder": "documents"
 * }
 */
router.post('/split', authenticateFirebaseUser, async (req, res) => {
  try {
    const { pdfUrl, fileName, separationPages, companyId, folder = 'documents' } = req.body;
    
    if (!pdfUrl) {
      return res.status(400).json({ error: 'pdfUrl es requerido' });
    }
    
    if (!separationPages || !Array.isArray(separationPages) || separationPages.length === 0) {
      return res.status(400).json({ error: 'separationPages debe ser un array con al menos un número de página' });
    }
    
    // Validar números de página
    const invalidPages = separationPages.filter(page => 
      !Number.isInteger(page) || page < 2
    );
    
    if (invalidPages.length > 0) {
      return res.status(400).json({ 
        error: `Números de página inválidos: ${invalidPages.join(', ')}. Deben ser enteros >= 2.` 
      });
    }
    
    const userId = req.user.uid;
    const baseFileName = fileName ? fileName.replace(/\.pdf$/i, '') : 'documento';
    
    console.log(`[PDF Separations] Separando PDF en ${separationPages.length + 1} documentos`);
    
    // Separar PDF en documentos
    const documents = await splitPDFIntoDocuments(pdfUrl, separationPages);
    
    console.log(`[PDF Separations] PDF separado en ${documents.length} documentos`);
    
    // Subir cada documento a Backblaze
    const uploadedDocuments = [];
    
    for (const doc of documents) {
      try {
        const docFileName = `${baseFileName}_parte${doc.index}.pdf`;
        const uploadResult = await uploadToB2(doc.pdfBuffer, 'application/pdf', {
          folder: folder,
          fileName: docFileName,
          metadata: {
            originalFile: fileName,
            partIndex: doc.index,
            startPage: doc.startPage,
            endPage: doc.endPage,
            pageCount: doc.pageCount,
            uploadedBy: userId,
            companyId: companyId || req.user.companyId
          }
        });
        
        uploadedDocuments.push({
          index: doc.index,
          fileName: docFileName,
          fileURL: uploadResult.url,
          startPage: doc.startPage,
          endPage: doc.endPage,
          pageCount: doc.pageCount
        });
        
        console.log(`[PDF Separations] Documento ${doc.index}/${documents.length} subido: ${docFileName}`);
      } catch (uploadError) {
        console.error(`[PDF Separations] Error subiendo documento ${doc.index}:`, uploadError);
        // Continuar con los demás documentos
      }
    }
    
    if (uploadedDocuments.length === 0) {
      return res.status(500).json({ 
        error: 'No se pudieron subir los documentos separados' 
      });
    }
    
    return res.json({
      success: true,
      totalDocuments: uploadedDocuments.length,
      documents: uploadedDocuments,
      originalFile: fileName || 'documento.pdf',
      separationPages: separationPages
    });
    
  } catch (error) {
    console.error('[PDF Separations] Error separando PDF:', error);
    return res.status(500).json({ 
      error: 'Error separando PDF',
      message: error.message 
    });
  }
});

export default router;

