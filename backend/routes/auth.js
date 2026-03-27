// backend/routes/auth.js
import express from 'express';

const router = express.Router();

/**
 * Login custom legacy DESHABILITADO por seguridad.
 * Motivo: validaba password en texto plano contra Firestore.
 *
 * Nuevo flujo recomendado:
 * - Login directo con Firebase Auth (email/password)
 * - Backend usa ID token + perfil Firestore tenant-aware para autorización
 */
router.post('/custom-login', async (_req, res) => {
  return res.status(410).json({
    error: 'custom-login deshabilitado por seguridad',
    reason: 'No se permite autenticación con password almacenada/validada en Firestore',
    use: 'Usar Firebase Auth con email/password y token Bearer en backend'
  });
});

export default router;
