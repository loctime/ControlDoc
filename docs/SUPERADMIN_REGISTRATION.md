# Sistema de Registro de Superadministrador

## ⚠️ IMPORTANTE: Sistema Crítico de Seguridad

Este sistema controla quién puede crear superadministradores en cada tenant. **NUNCA** debe permitir múltiples superadmins por tenant.

## Flujo de Trabajo

### 1. Creación de Tenant para Cliente
1. Cliente contrata servicios
2. Desarrollador crea subdominio (tenant) desde Vercel
3. Tenant se crea automáticamente en Firestore con `autoCreated: true`

### 2. Primera Visita al Tenant
- **Si tenant está vacío** → Aparece botón "Crear cuenta de administrador"
- **Si tenant tiene usuarios** → Solo aparece "¿No tienes cuenta? Regístrate"

### 3. Creación del Superadmin
- Solo se puede crear **UNA VEZ** por tenant
- Una vez creado, **NUNCA MÁS** aparece el botón
- El superadmin puede ser creado por:
  - El desarrollador (recomendado)
  - El cliente (si se le da acceso al subdominio)

## Reglas de Seguridad

### ✅ CORRECTO
- **Backend como única fuente de verdad** para verificar si hay usuarios
- **Endpoint `/api/tenants/is-empty`** determina si mostrar el botón
- **Una vez creado el superadmin** → Backend detecta usuarios → No más botón

### ❌ PROHIBIDO
- **NUNCA usar localStorage** para controlar acceso al registro de superadmin
- **NUNCA usar condiciones de desarrollo** en producción
- **NUNCA permitir múltiples superadmins** por tenant

## Implementación Técnica

### Frontend (`Login.jsx`)
```javascript
// ✅ CORRECTO: Solo confiar en el backend
return tenantEmpty ? (
  <Link to="/register-superadmin">Crear cuenta de administrador</Link>
) : (
  <Link to="/register">¿No tienes cuenta? Regístrate</Link>
);
```

### Backend (`/api/tenants/is-empty`)
```javascript
// ✅ CORRECTO: Verificar si hay usuarios en la colección
const usersSnap = await db.collection(`tenants/${tenantId}/users`).limit(1).get();
res.json({ isEmpty: usersSnap.empty });
```

## Casos de Uso

### Caso 1: Tenant Nuevo
1. Cliente ingresa a `cliente.controldoc.app`
2. Backend verifica `tenants/cliente/users` → Vacío
3. Frontend muestra "Crear cuenta de administrador"
4. Se crea superadmin
5. Backend verifica `tenants/cliente/users` → Tiene usuarios
6. Frontend muestra solo "¿No tienes cuenta? Regístrate"

### Caso 2: Tenant con Usuarios
1. Cliente ingresa a `cliente.controldoc.app`
2. Backend verifica `tenants/cliente/users` → Tiene usuarios
3. Frontend muestra solo "¿No tienes cuenta? Regístrate"

## Troubleshooting

### Problema: Aparece botón después de crear superadmin
**Causa:** Backend no detecta correctamente los usuarios
**Solución:** Verificar logs del endpoint `/api/tenants/is-empty`

### Problema: Múltiples superadmins creados
**Causa:** Uso de localStorage o condiciones de desarrollo
**Solución:** Eliminar localStorage y usar solo backend

### Problema: Botón no aparece en tenant nuevo
**Causa:** Endpoint devuelve `isEmpty: false` incorrectamente
**Solución:** Verificar que la colección `users` esté realmente vacía

## Testing

### Test 1: Tenant Vacío
```bash
# Verificar que el endpoint devuelve isEmpty: true
curl "https://api.controldoc.app/api/tenants/is-empty?tenant=test"
# Respuesta esperada: {"isEmpty": true}
```

### Test 2: Tenant con Usuarios
```bash
# Después de crear superadmin, verificar que devuelve isEmpty: false
curl "https://api.controldoc.app/api/tenants/is-empty?tenant=test"
# Respuesta esperada: {"isEmpty": false}
```

## Monitoreo

### Logs Importantes
- `🔍 [TenantRoutes] Usuarios encontrados: X`
- `🔍 [TenantRoutes] Resultado isEmpty: true/false`
- `🔍 [Login] tenantEmpty actualizado a: true/false`

### Alertas
- Si `isEmpty: true` después de crear superadmin → **CRÍTICO**
- Si múltiples superadmins en un tenant → **CRÍTICO**

## Contacto

Si hay problemas con este sistema, contactar inmediatamente al equipo de desarrollo.

---
**Última actualización:** $(date)
**Versión:** 1.0
