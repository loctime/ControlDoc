// backend/routes/patterns.js
import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';

const router = express.Router();
const db = getFirestore();

// Obtener patrones
router.get('/', authenticateFirebaseUser, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const documentType = req.query.documentType;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Se requiere companyId' });
    }
    
    const tenantPath = `tenants/${req.tenantId || 'default'}`;
    const patternsPath = `${tenantPath}/extractionPatterns`;
    
    let query = db.collection(patternsPath).where('companyId', '==', companyId);
    if (documentType) {
      query = query.where('documentType', '==', documentType);
    }
    
    const snapshot = await query.get();
    const patterns = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return res.json({
      success: true,
      patterns,
      total: patterns.length
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo patrones:', error);
    return res.status(500).json({
      error: 'Error al obtener patrones',
      detalle: error.message
    });
  }
});

// Guardar patrón
router.post('/', authenticateFirebaseUser, async (req, res) => {
  try {
    const { companyId, documentType, patterns, patternName } = req.body;
    
    const userCompanyId = companyId || req.user.companyId;
    
    if (!userCompanyId) {
      return res.status(400).json({ error: 'Se requiere companyId' });
    }
    
    if (!documentType) {
      return res.status(400).json({ error: 'Se requiere documentType' });
    }
    
    if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de patrones válido' });
    }
    
    const tenantPath = `tenants/${req.tenantId || 'default'}`;
    const patternsPath = `${tenantPath}/extractionPatterns`;
    
    // Verificar si existe
    const existingQuery = db.collection(patternsPath)
      .where('companyId', '==', userCompanyId)
      .where('documentType', '==', documentType)
      .limit(1);
    
    const existingSnapshot = await existingQuery.get();
    
    const patternData = {
      companyId: userCompanyId,
      documentType,
      patternName: patternName || `Patrón para ${documentType}`,
      patterns,
      createdBy: {
        uid: req.user.uid,
        email: req.user.email
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    let patternDoc;
    
    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      await existingDoc.ref.update(patternData);
      patternDoc = { id: existingDoc.id, ...patternData };
    } else {
      const newDoc = await db.collection(patternsPath).add(patternData);
      patternDoc = { id: newDoc.id, ...patternData };
    }
    
    return res.json({
      success: true,
      pattern: patternDoc,
      message: existingSnapshot.empty ? 'Patrón creado' : 'Patrón actualizado'
    });
    
  } catch (error) {
    console.error('❌ Error guardando patrón:', error);
    return res.status(500).json({
      error: 'Error al guardar patrón',
      detalle: error.message
    });
  }
});

// Eliminar patrón
router.delete('/:patternId', authenticateFirebaseUser, async (req, res) => {
  try {
    const { patternId } = req.params;
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Se requiere companyId' });
    }
    
    const tenantPath = `tenants/${req.tenantId || 'default'}`;
    const patternsPath = `${tenantPath}/extractionPatterns`;
    
    const patternDoc = await db.collection(patternsPath).doc(patternId).get();
    
    if (!patternDoc.exists) {
      return res.status(404).json({ error: 'Patrón no encontrado' });
    }
    
    const patternData = patternDoc.data();
    if (patternData.companyId !== companyId) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este patrón' });
    }
    
    await patternDoc.ref.delete();
    
    return res.json({
      success: true,
      message: 'Patrón eliminado correctamente'
    });
    
  } catch (error) {
    console.error('❌ Error eliminando patrón:', error);
    return res.status(500).json({
      error: 'Error al eliminar patrón',
      detalle: error.message
    });
  }
});

export default router;

