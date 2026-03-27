# Changelog - Sistema de Clientes

Este documento registra los cambios y mejoras realizadas al sistema de gestión de clientes y subempresas.

---

## Diciembre 2024

### ✅ Correcciones Implementadas

#### 1. **Corrección de Lógica de `companyId`**
- **Problema**: `companyId` cambiaba cuando se seleccionaba un cliente
- **Solución**: `companyId` ahora siempre es `mainCompanyId` (nunca cambia)
- **Archivos afectados**:
  - `src/entidad/user/UsuarioDashboard.jsx`
  - `src/entidad/user/components/BulkUploadDialog.jsx`
  - `src/entidad/user/components/BulkUploadReview.jsx`
  - `src/entidad/user/PersonalPanel/index.jsx`
  - `src/entidad/user/VehiculosPanel/index.jsx`

#### 2. **Vista Avanzada del Dashboard**
- **Problema**: Documentos por entidad no aparecían; documentos de clientes no se mostraban en empresa principal
- **Solución**: 
  - Corregido filtrado de documentos requeridos (empresa principal ve todos los documentos)
  - Corregido `buildEntityRows` para mostrar empleados/vehículos correctamente
  - Corregido `buildCompanyRows` para mostrar todos los documentos (incluyendo de clientes)
- **Archivos afectados**:
  - `src/entidad/user/AdvancedDashboard/AdvancedDashboardView.jsx`
  - `src/entidad/user/components/hooks/useDashboardDataQuery.js`

#### 3. **Carga Masiva de Documentos**
- **Problema**: Carga masiva no manejaba correctamente los clientes
- **Solución**:
  - `BulkUploadDialog` ahora envía `mainCompanyId`, `activeCompanyId` y `mainCompanyId` al backend
  - `BulkUploadReview` ya tenía la lógica correcta para metadata
  - `VehiculosPanel` ahora usa `mainCompanyId` del contexto en lugar de localStorage
- **Archivos afectados**:
  - `src/entidad/user/components/BulkUploadDialog.jsx`
  - `src/entidad/user/components/BulkUploadReview.jsx`
  - `src/entidad/user/VehiculosPanel/index.jsx`

#### 4. **Filtrado de Documentos Requeridos**
- **Problema**: Empresa principal no veía documentos que aplicaban solo a clientes
- **Solución**: Empresa principal ahora muestra documentos con `appliesTo.main === true` O documentos que tienen clientes en `appliesTo.clients`
- **Archivos afectados**:
  - `src/entidad/user/components/hooks/useDashboardDataQuery.js`

#### 5. **Visualización de Cliente en Tablas**
- **Mejora**: Agregada columna "Cliente" en tablas de personal y vehículos
- **Mejora**: Mostrar nombre de cliente en documentos de "empresa" y "documentos"
- **Archivos afectados**:
  - `src/entidad/user/PersonalPanel/index.jsx`
  - `src/entidad/user/VehiculosPanel/index.jsx`
  - `src/entidad/user/EmpresaPanel/EmpresaDocumentsPanel.jsx`
  - `src/entidad/user/CustomPanel/CustomDocumentsPanel.jsx`

---

### 📚 Documentación Creada

#### 1. **ARQUITECTURA_CLIENTES.md** ⭐ NUEVO
- Documento completo sobre la arquitectura de clientes
- Explica conceptos clave: `companyId`, `mainCompanyId`, `activeCompanyId`, `clientId`
- Detalla estructura de datos y flujos de trabajo
- Incluye mejores prácticas y patrones de código

#### 2. **Actualización de MIGRACION_CLIENTES_Y_SCRIPTS.md**
- Agregadas referencias al nuevo documento de arquitectura
- Actualizada fecha de última actualización

#### 3. **Actualización de README.md**
- Agregada referencia al nuevo documento de arquitectura
- Actualizada sección de gestión de clientes con nuevas funcionalidades

---

### 🔧 Mejoras Técnicas

#### Patrones Establecidos

1. **Definición de `companyId`**:
   ```javascript
   const companyId = mainCompanyId; // Siempre empresa principal
   ```

2. **Cálculo de `clientId`**:
   ```javascript
   const clientId = (activeCompanyId && activeCompanyId !== mainCompanyId)
     ? activeCompanyId
     : null;
   ```

3. **Detección de Empresa Principal**:
   ```javascript
   const isMainCompany = activeCompanyId === mainCompanyId;
   ```

4. **Filtrado de Datos**:
   ```javascript
   const filteredData = isMainCompany
     ? allData // Mostrar todo
     : allData.filter(item => String(item.clientId) === String(activeCompanyId));
   ```

5. **Metadata al Backend**:
   ```javascript
   {
     companyId: mainCompanyId,      // Siempre empresa principal
     activeCompanyId: activeCompanyId, // Para calcular clientId
     mainCompanyId: mainCompanyId     // Para validación
   }
   ```

---

### 📝 Notas Importantes

1. **`companyId` NUNCA debe cambiar** - Siempre es `mainCompanyId`
2. **`activeCompanyId` cambia** - Cuando el usuario selecciona empresa principal o cliente
3. **`clientId` solo existe** - Cuando un elemento pertenece a un cliente (null para empresa principal)
4. **Filtrado diferencial**:
   - Empresa principal: Sin filtrar (ver todo)
   - Cliente: Filtrar por `clientId === activeCompanyId`

---

### 🐛 Problemas Resueltos

1. ✅ Documentos por entidad no aparecían en vista avanzada
2. ✅ Empresa principal no veía documentos de clientes
3. ✅ Carga masiva no asociaba documentos a clientes correctamente
4. ✅ `companyId` cambiaba incorrectamente al seleccionar cliente
5. ✅ Documentos requeridos no se filtraban correctamente

---

**Última actualización**: Diciembre 2024

