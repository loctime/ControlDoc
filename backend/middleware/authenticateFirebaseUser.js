import admin from 'firebase-admin';
import { getTenantFromRequest, getTenantCollectionPath } from '../utils/tenantUtils.js';

const ALLOWED_ROLES = new Set(['max', 'admin', 'user']);

function normalizeRole(role) {
  const raw = String(role || '').trim().toLowerCase();
  if (raw === 'dhhkvja' || raw === 'superadmin') return 'admin';
  if (ALLOWED_ROLES.has(raw)) return raw;
  return 'user';
}

export async function authenticateFirebaseUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Autenticación requerida',
        solution: "Incluye un token JWT válido en Authorization: 'Bearer <token>'"
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken || idToken.split('.').length !== 3) {
      return res.status(401).json({ error: 'Formato de token inválido' });
    }

    const tenantId = getTenantFromRequest(req);
    if (!tenantId) {
      return res.status(404).json({ error: 'Tenant no resoluble para este dominio' });
    }
    req.tenantId = tenantId;
    req.getTenantCollectionPath = (collectionName) => getTenantCollectionPath(tenantId, collectionName);

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const db = admin.firestore();

    // Log temporal: tenant y uid al validar
    console.log('[AUTH] authenticateFirebaseUser | req.tenantId:', tenantId, '| decoded.uid:', decodedToken.uid, '| email:', decodedToken.email);

    // Cargar perfil exclusivamente del tenant en contexto (sin fallback cross-tenant)
    const tenantUsersPath = getTenantCollectionPath(tenantId, 'users');
    const userDoc = await db.collection(tenantUsersPath).doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      console.warn('[AUTH] Usuario no encontrado en tenant | tenantId:', tenantId, '| path:', tenantUsersPath, '| uid:', decodedToken.uid);
      return res.status(403).json({
        error: 'Usuario no pertenece al tenant en contexto. Accedé desde el mismo dominio donde te crearon.',
        tenantId,
        code: 'user-not-in-tenant'
      });
    }

    const profile = userDoc.data();
    const normalizedRole = normalizeRole(profile.role || decodedToken.role);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: normalizedRole,
      companyId: profile.companyId || decodedToken.companyId || null,
      tenantId,
      profile
    };

    next();
  } catch (error) {
    console.error('[AUTH] Error validando token:', error);
    const message = error.code === 'auth/id-token-expired'
      ? 'Tu sesión ha expirado, inicia sesión nuevamente'
      : 'Credenciales inválidas';

    res.status(401).json({
      error: message,
      code: error.code || 'auth/invalid-token'
    });
  }
}
