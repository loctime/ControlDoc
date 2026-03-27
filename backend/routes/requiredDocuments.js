// backend/routes/requiredDocuments.js
import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';
import axios from 'axios';

const router = express.Router();
const db = getFirestore();

/**
 * Analiza un exampleImage y retorna metadata (texto, palabras, campos detectados)
 */
router.post('/analyze-example', authenticateFirebaseUser, async (req, res) => {
  try {
    const { exampleImageURL, documentId, companyId } = req.body;
    
    if (!exampleImageURL) {
      return res.status(400).json({ error: 'exampleImageURL es requerido' });
    }
    
    const userId = req.user.uid;
    const tenantPath = `tenants/${req.tenantId || 'default'}`;
    const protocol = req.protocol;
    const host = req.get('host');
    const baseURL = `${protocol}://${host}`;
    
    console.log(`🔍 Analizando exampleImage: ${exampleImageURL}`);
    
    try {
      // Analizar archivo usando el endpoint de análisis existente
      const response = await axios.post(
        `${baseURL}/api/analyze-file`,
        { fileURL: exampleImageURL, lang: 'spa' },
        { timeout: 120000 } // 120 segundos
      );
      
      const text = response.data.text || '';
      const words = response.data.words || [];
      const type = response.data.type || 'unknown';
      
      // Detectar campos comunes
      const detectFields = (text, words = []) => {
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
      };
      
      const detectedFields = detectFields(text, words);
      
      const metadata = {
        text,
        words,
        type,
        detectedFields,
        analyzedAt: new Date().toISOString(),
        analyzedBy: userId
      };
      
      console.log(`✅ Metadata extraída: ${text.length} caracteres, ${words.length} palabras, ${Object.keys(detectedFields).length} campos detectados`);
      
      // Si se proporciona documentId, actualizar el documento requerido con la metadata
      if (documentId) {
        const docCompanyId = companyId || req.user.companyId;
        const requiredDocsPath = `${tenantPath}/requiredDocuments`;
        const docRef = db.collection(requiredDocsPath).doc(documentId);
        
        // Verificar que el documento existe y pertenece al usuario/empresa
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          return res.status(404).json({ error: 'Documento requerido no encontrado' });
        }
        
        const docData = docSnap.data();
        if (docCompanyId && docData.companyId !== docCompanyId) {
          return res.status(403).json({ error: 'No tienes permiso para actualizar este documento' });
        }
        
        // Actualizar documento con metadata
        await docRef.update({
          exampleMetadata: metadata,
          exampleMetadataUpdatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Metadata guardada en documento requerido: ${documentId}`);
      }
      
      return res.json({
        success: true,
        metadata,
        saved: !!documentId
      });
      
    } catch (error) {
      console.error('❌ Error analizando exampleImage:', error.message);
      return res.status(500).json({ 
        error: 'Error al analizar el archivo de ejemplo',
        message: error.message 
      });
    }
    
  } catch (error) {
    console.error('Error en analyze-example:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;

