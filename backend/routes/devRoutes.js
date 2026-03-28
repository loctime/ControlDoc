import { Router } from 'express';
import { auth } from '../firebaseconfig.js';

const router = Router();

/**
 * 🔐 Endpoint temporal para asignar custom claims (roles) a un usuario de Firebase Auth
 */
router.post('/set-role', async (req, res) => {
  const { uid, role = 'user' } = req.body;
  const secret = req.headers['x-admin-secret'];

  // 🔒 Verificación simple por clave secreta
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  if (!uid) return res.status(400).json({ error: 'Falta el UID del usuario' });

  try {
    await auth.setCustomUserClaims(uid, { role });
    res.json({ message: `✅ Rol "${role}" asignado a UID ${uid}` });
  } catch (error) {
    console.error('❌ Error al asignar rol:', error);
    res.status(500).json({ error: 'Error al asignar rol', detail: error.message });
  }
});

export default router;
