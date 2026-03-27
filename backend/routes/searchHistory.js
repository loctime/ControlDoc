import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';

const router = express.Router();
const db = getFirestore();

// Guardar término de búsqueda
router.post('/', authenticateFirebaseUser, async (req, res) => {
  try {
    const { searchTerm, fileName, fileURL } = req.body;
    const userId = req.user?.uid;

    if (!searchTerm || !searchTerm.trim()) {
      return res.status(400).json({ error: 'Término de búsqueda requerido' });
    }

    const searchData = {
      searchTerm: searchTerm.trim(),
      fileName: fileName || 'N/A',
      fileURL: fileURL || 'N/A',
      userId: userId || 'anonymous',
      timestamp: new Date(),
      createdAt: new Date().toISOString(),
      tenantId: req.tenantId || 'default'
    };

    // Usar la ruta del tenant para guardar el historial
    const tenantSearchHistoryPath = `tenants/${req.tenantId || 'default'}/searchHistory`;

    // Guardar en Firestore
    const searchRef = await db
      .collection(tenantSearchHistoryPath)
      .add(searchData);

    console.log('✅ Búsqueda guardada:', {
      id: searchRef.id,
      searchTerm: searchData.searchTerm,
      fileName: searchData.fileName,
      userId: searchData.userId,
      tenantId: searchData.tenantId
    });

    res.json({
      success: true,
      message: 'Búsqueda guardada correctamente',
      searchId: searchRef.id
    });

  } catch (error) {
    console.error('❌ Error al guardar búsqueda:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// Obtener historial de búsquedas del usuario
router.get('/', authenticateFirebaseUser, async (req, res) => {
  try {
    const userId = req.user?.uid;
    const limit = parseInt(req.query.limit) || 50;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Usar la ruta del tenant para obtener el historial
    const tenantSearchHistoryPath = `tenants/${req.tenantId || 'default'}/searchHistory`;

    const searchHistory = await db
      .collection(tenantSearchHistoryPath)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const searches = searchHistory.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().createdAt
    }));

    res.json({
      success: true,
      searches,
      total: searches.length
    });

  } catch (error) {
    console.error('❌ Error al obtener historial:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// Obtener estadísticas de búsquedas
router.get('/stats', authenticateFirebaseUser, async (req, res) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Usar la ruta del tenant para obtener estadísticas
    const tenantSearchHistoryPath = `tenants/${req.tenantId || 'default'}/searchHistory`;

    const searchHistory = await db
      .collection(tenantSearchHistoryPath)
      .where('userId', '==', userId)
      .get();

    const searches = searchHistory.docs.map(doc => doc.data());
    
    // Contar términos más buscados
    const termCounts = {};
    searches.forEach(search => {
      const term = search.searchTerm.toLowerCase();
      termCounts[term] = (termCounts[term] || 0) + 1;
    });

    const topTerms = Object.entries(termCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([term, count]) => ({ term, count }));

    res.json({
      success: true,
      stats: {
        totalSearches: searches.length,
        uniqueTerms: Object.keys(termCounts).length,
        topTerms
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

export default router;
