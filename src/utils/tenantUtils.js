/**
 * Utilidades de multi-tenant (frontend)
 * - Resolución de tenant segura por dominio canónico/custom domain
 * - Sin fallback a hostname arbitrario
 * - Autocreación solo para desarrollo + ALLOW_TENANT_AUTO_CREATE=true
 */

const ROOT_DOMAIN = import.meta.env.VITE_TENANT_ROOT_DOMAIN || 'controldoc.app';
const ALLOW_AUTO_CREATE = import.meta.env.DEV && import.meta.env.VITE_ALLOW_TENANT_AUTO_CREATE === 'true';

function sanitizeHost(host) {
  return String(host || '').split(':')[0].toLowerCase().trim();
}

export function resolveTenantIdFromHostname(hostname) {
  const host = sanitizeHost(hostname);

  if (!host) return null;

  if (host === 'localhost' || host === '127.0.0.1') {
    return import.meta.env.DEV ? 'dev' : 'default';
  }

  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) {
    return 'default';
  }

  const suffix = `.${ROOT_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const subdomain = host.slice(0, -suffix.length);
    if (/^[a-z0-9-]+$/.test(subdomain)) {
      return subdomain;
    }
  }

  // Despliegues en Render / Vercel como tenant único default
  if (host.endsWith('.onrender.com') || host.endsWith('.vercel.app')) {
    return 'default';
  }

  return null;
}

/**
 * Obtiene el tenantId del dominio actual de forma estricta
 */
export function getCurrentTenantId() {
  return resolveTenantIdFromHostname(window.location.hostname);
}

export function getTenantBaseUrl() {
  const tenantId = getCurrentTenantId();

  if (!tenantId) {
    return window.location.origin;
  }

  if (tenantId === 'default' || tenantId === 'dev') {
    return window.location.origin;
  }

  return `https://${tenantId}.${ROOT_DOMAIN}`;
}

export async function isTenantValid() {
  const tenantId = getCurrentTenantId();

  if (!tenantId) {
    return false;
  }

  try {
    const { db } = await import('../config/firebaseconfig');
    const { doc, getDoc, setDoc } = await import('firebase/firestore');

    const tenantRef = doc(db, 'tenants', tenantId);
    const tenantDoc = await getDoc(tenantRef);

    if (tenantDoc.exists() && tenantDoc.data().status === 'active') {
      return true;
    }

    if (!tenantDoc.exists() && tenantId !== 'default' && tenantId !== 'dev' && ALLOW_AUTO_CREATE) {
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

      await setDoc(tenantRef, tenantData);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error verificando tenant:', error);
    return false;
  }
}

export async function getTenantInfo() {
  const tenantId = getCurrentTenantId();

  if (!tenantId) {
    return null;
  }

  try {
    const { db } = await import('../config/firebaseconfig');
    const { doc, getDoc } = await import('firebase/firestore');

    const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));

    if (!tenantDoc.exists()) {
      return null;
    }

    return { id: tenantId, ...tenantDoc.data() };
  } catch (error) {
    console.error('Error obteniendo información de tenant:', error);
    return null;
  }
}

/**
 * Resuelve tenant por custom domain consultando Firestore.
 * Uso recomendado en bootstrap/login si se habilitan dominios personalizados.
 */
export async function resolveTenantByCustomDomain(hostname) {
  try {
    const host = sanitizeHost(hostname);
    if (!host) return null;

    const canonical = resolveTenantIdFromHostname(host);
    if (canonical) return canonical;

    const { db } = await import('../config/firebaseconfig');
    const { collection, query, where, getDocs, limit } = await import('firebase/firestore');

    const q = query(
      collection(db, 'tenants'),
      where('customDomains', 'array-contains', host),
      limit(1)
    );

    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id;
    }

    return null;
  } catch (error) {
    console.error('Error resolviendo tenant por custom domain:', error);
    return null;
  }
}

export function getTenantCollectionPath(collectionName) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Tenant no resoluble para el dominio actual');
  }
  return `tenants/${tenantId}/${collectionName}`;
}

export function getTenantCollections() {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Tenant no resoluble para el dominio actual');
  }

  const basePath = `tenants/${tenantId}`;

  return {
    users: `${basePath}/users`,
    companies: `${basePath}/companies`,
    uploadedDocuments: `${basePath}/uploadedDocuments`,
    requiredDocuments: `${basePath}/requiredDocuments`,
    personal: `${basePath}/personal`,
    vehiculos: `${basePath}/vehiculos`,
    logs: `${basePath}/logs`,
    documentEntityTypes: `${basePath}/documentEntityTypes`
  };
}
