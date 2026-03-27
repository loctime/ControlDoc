// backend/utils/logAction.js
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

/**
 * Guarda una acción en la colección `logs` de Firestore del tenant específico.
 * @param {Object} options
 * @param {string} options.tenantId - ID del tenant
 * @param {string} options.action - Acción realizada (ej: "delete-company", "upload-document")
 * @param {string} options.actorUid - UID del usuario que hizo la acción
 * @param {string} options.actorEmail - Email del usuario que hizo la acción
 * @param {string} options.actorRole - Rol del usuario (admin, user, etc.)
 * @param {string} options.target - Objetivo de la acción (ej: "companies/12345")
 * @param {string} [options.message] - Mensaje descriptivo
 * @param {Object} [options.meta] - Datos extra opcionales
 */
export async function logAction({
  tenantId,
  action,
  actorUid,
  actorEmail,
  actorRole,
  target,
  message,
  meta = {}
}) {
  try {
    const logEntry = {
      action,
      actor: {
        uid: actorUid,
        email: actorEmail,
        role: actorRole,
      },
      target,
      message: message || '',
      companyName: meta.companyName || null,
      meta,
      timestamp: Timestamp.now(),
      tenantId: tenantId // Agregar tenantId al log para trazabilidad
    };

    // Usar la ruta del tenant para guardar el log
    const tenantLogsPath = `tenants/${tenantId}/logs`;
    await db.collection(tenantLogsPath).add(logEntry);
    console.log(`[LOG] Acción registrada en tenant ${tenantId}: ${action} sobre ${target}`);
  } catch (error) {
    console.error('[LOG] Error al guardar log:', error);
  }
}

/**
 * Versión simplificada que obtiene el tenantId del request (para uso en middleware)
 * @param {Object} req - Objeto de request de Express
 * @param {Object} options - Opciones del log
 */
export async function logActionFromRequest(req, options) {
  const tenantId = req.tenantId || 'default';
  return logAction({
    tenantId,
    ...options
  });
}
