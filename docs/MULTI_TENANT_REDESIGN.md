# Rediseño definitivo de multi-tenant (seguro, escalable, profesional)

## Objetivos aplicados
- Resolución de tenant solo por dominio canónico (`*.controldoc.app`) y dominio raíz (`controldoc.app`).
- Eliminación de fallbacks inseguros por hostname arbitrario.
- Auto-creación de tenants restringida a desarrollo + `ALLOW_TENANT_AUTO_CREATE=true`.
- Separación identidad (Firebase Auth) vs autorización/perfil (Firestore por tenant).
- Bloqueo explícito de acceso cross-tenant.

---

## Cambios por archivo (implementados)

### 1) `backend/utils/tenantUtils.js`
- **Qué se cambió:**
  - Nueva resolución segura con `resolveTenantIdFromHost()`.
  - Validación estricta de host con `isAllowedTenantHost()`.
  - Soporte opcional de `x-tenant` (validado por regex).
  - `tenantMiddleware` ahora bloquea hosts no permitidos (403) o tenant no resoluble (404).
  - `isTenantValid/getTenantInfo` ya no autocrean en producción.
- **ENV nuevas:**
  - `TENANT_ROOT_DOMAIN=controldoc.app`
  - `ALLOWED_TENANT_HOSTS=localhost,127.0.0.1,controldoc.app,www.controldoc.app`
  - `ALLOW_TENANT_AUTO_CREATE=true` (solo dev)

### 2) `backend/middleware/authenticateFirebaseUser.js`
- **Qué se cambió:**
  - Verificación de token Firebase Auth.
  - Carga de perfil **solo** desde `tenants/{tenantId}/users/{uid}` del tenant en contexto.
  - Eliminada búsqueda en “todos los tenants” y fallback a colección global `admins`.
  - Normalización de roles a `max | admin | user`.

### 3) `backend/routes/adminAddRoutes.js`
- **Qué se cambió:**
  - Roles unificados a `max | admin`.
  - Eliminado guardado de `password` en Firestore.

### 4) `backend/routes/auth.js`
- **Qué se cambió:**
  - Endpoint `/custom-login` legacy deshabilitado (`410 Gone`) por seguridad.
  - Motivo: validaba passwords en texto plano contra Firestore.

### 5) `src/utils/tenantUtils.js`
- **Qué se cambió:**
  - Resolución de tenant estricta por dominio canónico.
  - Sin fallback a hostname completo.
  - Auto-creación solo con `VITE_ALLOW_TENANT_AUTO_CREATE=true` en `import.meta.env.DEV`.
  - Función para resolver custom domain en Firestore (`resolveTenantByCustomDomain`).

### 6) `src/context/TenantContext.jsx`
- **Qué se cambió:**
  - Si tenant no es resoluble, estado inválido + error explícito.

### 7) `src/context/AuthContext.jsx`
- **Qué se cambió:**
  - Ajuste a `import.meta.env.DEV`.
  - Consulta de `companies` usando `userTenantId` para no mezclar tenant del dominio con tenant del usuario.

### 8) `src/entidad/public/CreateSuperMaxAdmin.jsx`
- **Qué se cambió:**
  - Eliminada detección hardcodeada (`tenta/default`).
  - Usa `getCurrentTenantId()` estricto.

### 9) `src/entidad/public/Login.jsx`
- **Qué se cambió:**
  - Roles privilegiados normalizados a `admin | max`.

### 10) `backend/routes/tenantRoutes.js`
- **Qué se cambió:**
  - `requireSuperAdmin` alineado al rol real `max`.

### 11) `backend/tests/tenantUtils.test.js`
- **Qué se agregó:**
  - Tests de resolución de tenant por dominio y bloqueo de hostnames arbitrarios.

---

## Estructura de colecciones recomendada

```text
tenants/{tenantId}
  id
  subdomain
  customDomains[]
  status
  settings
  createdAt
  updatedAt

tenants/{tenantId}/users/{uid}
  role: max|admin|user
  email
  companyId?
  status
  createdAt
  updatedAt

tenants/{tenantId}/companies/{companyId}
tenants/{tenantId}/uploadedDocuments/{docId}
tenants/{tenantId}/backups/{backupId}
```

> Eliminar gradualmente rutas globales legacy (`companies` raíz, `admins` raíz).

---

## Ejemplo de middleware de tenant (backend)

```js
const tenantId = getTenantFromRequest(req);
if (!tenantId) return res.status(404).json({ error: 'Tenant no resoluble' });
req.tenantId = tenantId;
req.getTenantCollectionPath = (name) => `tenants/${tenantId}/${name}`;
```

## Ejemplo de middleware auth (backend)

```js
const decoded = await admin.auth().verifyIdToken(token);
const userDoc = await db.collection(`tenants/${req.tenantId}/users`).doc(decoded.uid).get();
if (!userDoc.exists) return res.status(403).json({ error: 'Usuario fuera de tenant' });
```

## Ejemplo de TenantContext (frontend)

```js
const tenantId = getCurrentTenantId();
if (!tenantId) throw new Error('Dominio no permitido');
const valid = await isTenantValid();
```

---

## Reglas de seguridad Firestore sugeridas

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isTenantMember(tenantId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/tenants/$(tenantId)/users/$(request.auth.uid));
    }

    function roleIn(tenantId, roles) {
      return isTenantMember(tenantId) &&
        get(/databases/$(database)/documents/tenants/$(tenantId)/users/$(request.auth.uid)).data.role in roles;
    }

    match /tenants/{tenantId} {
      allow read: if roleIn(tenantId, ['max', 'admin', 'user']);
      allow write: if false; // por backend/admin SDK

      match /users/{uid} {
        allow read: if isTenantMember(tenantId);
        allow create, update: if roleIn(tenantId, ['max', 'admin']) || request.auth.uid == uid;
        allow delete: if roleIn(tenantId, ['max']);
      }

      match /companies/{companyId} {
        allow read: if isTenantMember(tenantId);
        allow write: if roleIn(tenantId, ['max', 'admin']);
      }

      match /uploadedDocuments/{docId} {
        allow read: if isTenantMember(tenantId);
        allow write: if roleIn(tenantId, ['max', 'admin']);
      }
    }
  }
}
```

---

## Estrategia de limpieza de tenants basura (preview/deploy)

1. Detectar candidatos:
   - `tenants` con `autoCreated=true`
   - `subdomain` que matchee patrones de preview (`*-git-*`, `*vercel*`, etc.)
   - sin usuarios/companies/documents.
2. Exportar backup JSON por tenant candidato.
3. Ejecutar soft-delete:
   - `status='inactive'`, `disabledAt`, `disabledReason='preview-tenant-cleanup'`.
4. Tras período de gracia (7/14 días), hard-delete con script batch.
5. Habilitar guardas permanentes:
   - `ALLOW_TENANT_AUTO_CREATE=false` en producción.
   - dominios no canónicos => 404/403.

---

## Notas de migración recomendadas
- Migrar roles legacy (`DhHkVja` => `admin`) en script one-shot.
- Quitar rutas que escriben en `companies` raíz.
- Habilitar nuevamente `/api/tenants` con auth estricta `max` para operaciones administrativas.
