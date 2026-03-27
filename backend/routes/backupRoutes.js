import express from 'express';
import { generateMonthlyBackup } from '../utils/generateMonthlyBackup.js';
import { logAction } from '../utils/logAction.js';
import { authenticateFirebaseUser } from '../middleware/authenticateFirebaseUser.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

// 🚫 Backup desactivado temporalmente
router.get('/monthly', authenticateFirebaseUser, requireRole(['max', 'admin']), async (req, res) => {
  return res.status(503).json({ error: 'Funcionalidad de backup desactivada temporalmente por mantenimiento.' });
  
  // Cuando se active, usar esta implementación:
  /*
  try {
    const tenantId = req.tenantId || 'default';
    const result = await generateMonthlyBackup(tenantId);
    
    await logAction({
      tenantId,
      action: 'BACKUP_MANUAL_TRIGGER',
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      target: 'system/backup',
      message: 'Backup mensual iniciado manualmente',
      meta: { fileName: result.fileName }
    });
    
    res.json({ 
      success: true, 
      message: 'Backup mensual completado',
      ...result 
    });
  } catch (error) {
    console.error('[BACKUP ERROR]', error);
    res.status(500).json({ error: error.message });
  }
  */
});

export default router;
