/**
 * Utilidades para el sistema multi-tenant en el backend
 *
 * Objetivo de seguridad:
 * - Resolver tenant SOLO por dominios canónicos permitidos
 * - Evitar fallback con hostname arbitrario
 * - Permitir auto-creación únicamente en desarrollo cuando ALLOW_TENANT_AUTO_CREATE=true
 */

const CANONICAL_ROOT_DOMAIN = process.env.TENANT_ROOT_DOMAIN || 'controldoc.app';
const ALLOWED_HOSTS = new Set(
  (process.env.ALLOWED_TENANT_HOSTS || `localhost,127.0.0.1,${CANONICAL_ROOT_DOMAIN},www.${CANONICAL_ROOT_DOMAIN}`)
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
);

function sanitizeHost(rawHost = '') {
  return String(rawHost).split(':')[0].toLowerCase().trim();
}

function shouldAutoCreateTenants() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_TENANT_AUTO_CREATE === 'true';
}

/**
 * Extrae tenantId de un host canónico
 * @param {string} host
 * @returns {string|null}
 */
export function resolveTenantIdFromHost(host) {
  const hostname = sanitizeHost(host);

  if (!hostname) return null;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.NODE_ENV === 'development' ? 'dev' : 'default';
  }

  if (hostname === CANONICAL_ROOT_DOMAIN || hostname === `www.${CANONICAL_ROOT_DOMAIN}`) {
    return 'default';
  }

  const suffix = `.${CANONICAL_ROOT_DOMAIN}`;
  if (hostname.endsWith(suffix)) {
    const subdomain = hostname.slice(0, -suffix.length);
    // Subdominio simple, sin puntos extra para evitar comodines inseguros
    if (/^[a-z0-9-]+$/.test(subdomain)) {
      return subdomain;
    }
  }

  // Hosts de despliegue (Render, Vercel) como tenant único default
  if (hostname.endsWith('.onrender.com') || hostname.endsWith('.vercel.app')) {
    return 'default';
  }

  return null;
}

/**
 * Obtiene el tenant ID en forma segura desde request.
 * Prioridad:
 * 1) Header x-tenant validado por formato (útil para servicios internos)
 * 2) Hostname canónico
 */
export function getTenantFromRequest(req) {
  const headerTenant = String(req.headers['x-tenant'] || '').trim().toLowerCase();
  const hostname = sanitizeHost(req.hostname || req.get('host') || '');

  if (headerTenant) {
    if (!/^[a-z0-9-]+$/.test(headerTenant)) {
      return null;
    }
    return headerTenant;
  }

  return resolveTenantIdFromHost(hostname);
}

/** Sufijos de dominios permitidos además del canónico (ej. Render, Vercel) */
const ALLOWED_HOST_SUFFIXES = [`.${CANONICAL_ROOT_DOMAIN}`, '.onrender.com', '.vercel.app'];

export function isAllowedTenantHost(host) {
  const hostname = sanitizeHost(host);

  if (ALLOWED_HOSTS.has(hostname)) return true;

  return ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Obtiene la ruta de colección para el tenant
 */
export function getTenantCollectionPath(tenantId, collectionName) {
  return `tenants/${tenantId}/${collectionName}`;
}

/**
 * Obtiene todas las rutas de colecciones del tenant
 */
export function getTenantCollections(tenantId) {
  const basePath = `tenants/${tenantId}`;

  return {
    users: `${basePath}/users`,
    companies: `${basePath}/companies`,
    uploadedDocuments: `${basePath}/uploadedDocuments`,
    requiredDocuments: `${basePath}/requiredDocuments`,
    personal: `${basePath}/personal`,
    vehiculos: `${basePath}/vehiculos`,
    logs: `${basePath}/logs`,
    documentEntityTypes: `${basePath}/documentEntityTypes`,
    backups: `${basePath}/backups`,
    searchHistory: `${basePath}/searchHistory`
  };
}

/**
 * Middleware para inyectar/validar tenant.
 * Rechaza hostnames no permitidos y tenants no resolubles.
 */
export function tenantMiddleware(req, res, next) {
  try {
    const host = sanitizeHost(req.hostname || req.get('host') || '');

    if (!isAllowedTenantHost(host)) {
      return res.status(403).json({
        error: 'Host no permitido para multi-tenant',
        host
      });
    }

    const tenantId = getTenantFromRequest(req);

    if (!tenantId) {
      return res.status(404).json({
        error: 'Tenant no resoluble para este dominio',
        host
      });
    }

    req.tenantId = tenantId;
    req.getTenantCollectionPath = (collectionName) => getTenantCollectionPath(tenantId, collectionName);
    req.getTenantCollections = () => getTenantCollections(tenantId);

    next();
  } catch (error) {
    console.error('Error en tenant middleware:', error);
    res.status(500).json({ error: 'Error interno resolviendo tenant' });
  }
}

/**
 * Verifica si el tenant existe y está activo; auto-crea SOLO en desarrollo si está habilitado.
 */
export async function isTenantValid(db, tenantId) {
  try {
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();

    if (tenantDoc.exists && tenantDoc.data().status === 'active') {
      return true;
    }

    if (!tenantDoc.exists && tenantId !== 'default' && tenantId !== 'dev' && shouldAutoCreateTenants()) {
      const tenantData = {
        id: tenantId,
        subdomain: tenantId,
        customDomains: [],
        status: 'active',
        autoCreated: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          maxCompanies: 100,
          maxUsers: 1000,
          maxStorageGB: 10
        }
      };

      await db.collection('tenants').doc(tenantId).set(tenantData);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error verificando tenant:', error);
    return false;
  }
}

/**
 * Obtiene metadata del tenant activo sin side-effects en producción.
 */
export async function getTenantInfo(db, tenantId) {
  const tenantDoc = await db.collection('tenants').doc(tenantId).get();
  if (tenantDoc.exists) {
    return { id: tenantId, ...tenantDoc.data() };
  }

  if (tenantId !== 'default' && tenantId !== 'dev' && shouldAutoCreateTenants()) {
    const tenantData = {
      id: tenantId,
      subdomain: tenantId,
      customDomains: [],
      status: 'active',
      autoCreated: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        maxCompanies: 100,
        maxUsers: 1000,
        maxStorageGB: 10
      }
    };

    await db.collection('tenants').doc(tenantId).set(tenantData);
    return { id: tenantId, ...tenantData };
  }

  return null;
}

export async function resolveTenantFromDomain(db, host) {
  const hostname = sanitizeHost(host);

  const canonicalTenant = resolveTenantIdFromHost(hostname);
  if (canonicalTenant) {
    return canonicalTenant;
  }

  const snap = await db.collection('tenants')
    .where('customDomains', 'array-contains', hostname)
    .limit(1)
    .get();

  if (!snap.empty) {
    return snap.docs[0].id;
  }

  return null;
}

/**
 * Middleware opcional para validar tenant contra Firestore (existente + activo)
 */
export function validateTenantMiddleware(req, res, next) {
  const { db } = req.app.locals;

  if (!db) {
    return res.status(500).json({ error: 'Base de datos no disponible' });
  }

  isTenantValid(db, req.tenantId)
    .then((valid) => {
      if (!valid) {
        return res.status(404).json({ error: 'Tenant no encontrado o inactivo', tenantId: req.tenantId });
      }
      return next();
    })
    .catch((error) => {
      console.error('Error validando tenant:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    });
}
