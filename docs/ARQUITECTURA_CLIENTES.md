# Arquitectura de Clientes y Subempresas

## 📋 Índice

1. [Introducción](#introducción)
2. [Conceptos Clave](#conceptos-clave)
3. [Estructura de Datos](#estructura-de-datos)
4. [Flujo de Trabajo](#flujo-de-trabajo)
5. [Implementación Técnica](#implementación-técnica)
6. [Mejores Prácticas](#mejores-prácticas)

---

## Introducción

Este documento describe la arquitectura del sistema de clientes (subempresas) en ControlDoc v5, incluyendo cómo se manejan los diferentes identificadores (`companyId`, `mainCompanyId`, `activeCompanyId`, `clientId`) y cómo funcionan los filtros y vistas.

### Propósito

Permitir que una empresa principal gestione múltiples clientes/subempresas manteniendo:
- **Aislamiento de datos** por cliente
- **Visibilidad completa** desde la empresa principal
- **Asociación correcta** de documentos, empleados y vehículos a clientes
- **Filtrado adecuado** en la interfaz de usuario

---

## Conceptos Clave

### Identificadores del Sistema

#### 1. `companyId` (SIEMPRE empresa principal)
- **Propósito**: Identifica a la empresa principal en la base de datos
- **Valor**: ID de la empresa principal (nunca cambia)
- **Uso**: 
  - Campo `companyId` en todas las colecciones (personal, vehiculos, uploadedDocuments, requiredDocuments)
  - Consultas a Firestore para filtrar por empresa
- **Regla**: **NUNCA** debe cambiar, incluso cuando se selecciona un cliente

#### 2. `mainCompanyId` (Empresa principal)
- **Propósito**: ID de la empresa principal en el contexto de React
- **Valor**: ID de la empresa principal
- **Uso**: 
  - Context API (`AuthContext`)
  - Filtrado de datos
  - Comparación para determinar si estamos en empresa principal o cliente
- **Regla**: Igual a `companyId`, pero viene del contexto React

#### 3. `activeCompanyId` (Empresa/cliente activo)
- **Propósito**: ID de la empresa/cliente actualmente seleccionado en la UI
- **Valor**: 
  - `mainCompanyId` cuando se selecciona la empresa principal
  - ID del cliente cuando se selecciona un cliente
- **Uso**: 
  - Selector de empresa/cliente en la UI
  - Filtrado de datos en vistas de usuario
- **Cambia**: Sí, cuando el usuario cambia de empresa principal a cliente o viceversa

#### 4. `clientId` (Cliente específico)
- **Propósito**: Identifica a qué cliente pertenece un documento, empleado o vehículo
- **Valor**: 
  - `null` cuando pertenece a la empresa principal
  - ID del cliente cuando pertenece a un cliente específico
- **Uso**: 
  - Campo en documentos, empleados y vehículos
  - Filtrado cuando `activeCompanyId !== mainCompanyId`
- **Regla**: Solo existe cuando el elemento pertenece a un cliente

### Relación entre Identificadores

```
Empresa Principal (mainCompanyId = "77777777771")
├── companyId = "77777777771" (SIEMPRE)
├── activeCompanyId = "77777777771" (cuando está seleccionada)
└── clientId = null (para elementos de la empresa principal)

Cliente YPF (clientId = "t58FQ5rilFMBE2rTDmoO")
├── companyId = "77777777771" (SIEMPRE, referencia a empresa principal)
├── activeCompanyId = "t58FQ5rilFMBE2rTDmoO" (cuando está seleccionado)
└── clientId = "t58FQ5rilFMBE2rTDmoO" (para elementos de este cliente)
```

---

## Estructura de Datos

### Colección `companies`

#### Empresa Principal
```javascript
{
  id: "77777777771",
  companyName: "Empresa Principal S.A.",
  type: "main",
  parentCompanyId: null,
  active: true,
  status: "approved"
}
```

#### Cliente/Subempresa
```javascript
{
  id: "t58FQ5rilFMBE2rTDmoO",
  companyName: "YPF",
  type: "client",
  parentCompanyId: "77777777771", // ID de la empresa principal
  active: true,
  status: "approved" | "pending"
}
```

### Colección `personal` (Empleados)

```javascript
{
  id: "emp123",
  nombre: "Juan",
  apellido: "Pérez",
  dni: "12345678",
  companyId: "77777777771",        // SIEMPRE empresa principal
  clientId: null | "t58FQ5rilFMBE2rTDmoO", // null = empresa principal
  activo: true,
  createdAt: timestamp
}
```

**Reglas:**
- `companyId` siempre es la empresa principal
- `clientId` es `null` para empleados de la empresa principal
- `clientId` es el ID del cliente para empleados de clientes

### Colección `vehiculos` (Vehículos)

```javascript
{
  id: "veh456",
  marca: "Toyota",
  modelo: "Corolla",
  patente: "ABC123",
  companyId: "77777777771",        // SIEMPRE empresa principal
  clientId: null | "t58FQ5rilFMBE2rTDmoO", // null = empresa principal
  activo: true,
  createdAt: timestamp
}
```

**Reglas:** Igual que `personal`

### Colección `requiredDocuments` (Documentos Requeridos)

```javascript
{
  id: "doc789",
  name: "Seguro de vida",
  entityType: "employee",
  companyId: "77777777771",        // SIEMPRE empresa principal
  appliesTo: {
    main: true | false,            // Si aplica a empresa principal
    clients: null | [] | ["t58FQ5rilFMBE2rTDmoO"] // IDs de clientes
  },
  expirationDate: timestamp,
  createdAt: timestamp
}
```

**Reglas de `appliesTo`:**
- `main: true, clients: null/[]` → Solo aparece en empresa principal
- `main: false, clients: ["id1"]` → Solo aparece en cliente específico
- `main: true, clients: ["id1"]` → Aparece en empresa principal Y en cliente
- `main: true, clients: ["id1", "id2"]` → Aparece en empresa principal Y en múltiples clientes

### Colección `uploadedDocuments` (Documentos Subidos)

```javascript
{
  id: "upload123",
  name: "Seguro de vida - Juan Pérez",
  requiredDocumentId: "doc789",
  companyId: "77777777771",        // SIEMPRE empresa principal
  clientId: null | "t58FQ5rilFMBE2rTDmoO", // null = empresa principal
  entityType: "employee",
  entityId: "emp123",
  entityName: "Juan Pérez",
  status: "Aprobado" | "Pendiente de revisión" | "Rechazado",
  fileURL: "https://...",
  uploadedAt: timestamp
}
```

**Reglas:**
- `companyId` siempre es la empresa principal
- `clientId` se determina según `activeCompanyId` al subir:
  - Si `activeCompanyId === mainCompanyId` → `clientId = null`
  - Si `activeCompanyId !== mainCompanyId` → `clientId = activeCompanyId`

---

## Flujo de Trabajo

### 1. Creación de Cliente

1. Usuario (empresa principal) crea cliente desde UI
2. Se crea registro en `companies` con:
   - `type: "client"`
   - `parentCompanyId: mainCompanyId`
   - `status: "pending"` (requiere aprobación)
3. Admin aprueba cliente → `status: "approved"`
4. Cliente aparece en selector de empresas

### 2. Agregar Empleado/Vehículo a Cliente

1. Usuario selecciona cliente en selector (`activeCompanyId = clientId`)
2. Usuario agrega empleado/vehículo
3. Sistema establece:
   - `companyId = mainCompanyId` (siempre)
   - `clientId = activeCompanyId` (porque es cliente)
4. Empleado/vehículo se guarda con ambos campos

### 3. Subir Documento para Cliente

1. Usuario selecciona cliente (`activeCompanyId = clientId`)
2. Usuario sube documento
3. Backend recibe:
   - `companyId = mainCompanyId`
   - `activeCompanyId = clientId`
   - `mainCompanyId = mainCompanyId`
4. Backend calcula `clientId`:
   - Si `activeCompanyId !== mainCompanyId` → `clientId = activeCompanyId`
   - Si `activeCompanyId === mainCompanyId` → `clientId = null`
5. Documento se guarda con `companyId` y `clientId`

### 4. Vista de Datos en Empresa Principal

Cuando `activeCompanyId === mainCompanyId`:
- **Empleados/Vehículos**: Se muestran TODOS (con y sin `clientId`)
- **Documentos**: Se muestran TODOS (incluyendo documentos de clientes)
- **Filtrado**: No se filtra por `clientId`, se muestra todo

### 5. Vista de Datos en Cliente

Cuando `activeCompanyId !== mainCompanyId`:
- **Empleados/Vehículos**: Solo se muestran los que tienen `clientId === activeCompanyId`
- **Documentos**: Solo se muestran los que tienen `clientId === activeCompanyId` o documentos requeridos que aplican al cliente
- **Filtrado**: Se filtra estrictamente por `clientId`

---

## Implementación Técnica

### Hook `useDashboardDataQuery`

**Ubicación**: `src/entidad/user/components/hooks/useDashboardDataQuery.js`

**Funcionalidad**:
- Fetches personal, vehiculos, requiredDocuments, uploadedDocuments
- Aplica filtrado según `activeCompanyId` y `mainCompanyId`

**Filtrado de Personal/Vehículos**:
```javascript
// Empresa principal: mostrar TODOS
if (activeCompanyId === mainCompanyId) {
  return allDocs; // Sin filtrar
}

// Cliente: solo mostrar de ese cliente
return allDocs.filter(doc => {
  const docClientId = doc.clientId || null;
  return String(docClientId) === String(activeCompanyId);
});
```

**Filtrado de Documentos Requeridos**:
```javascript
// Empresa principal: mostrar documentos con appliesTo.main O con clientes
if (activeCompanyId === mainCompanyId) {
  const hasMain = appliesTo.main === true;
  const hasClients = Array.isArray(appliesTo.clients) && appliesTo.clients.length > 0;
  return hasMain || hasClients;
}

// Cliente: solo documentos que aplican a ese cliente
const activeIdStr = String(activeCompanyId);
const clientsStr = appliesTo.clients.map(id => String(id));
return clientsStr.includes(activeIdStr);
```

**Filtrado de Documentos Subidos**:
```javascript
// Empresa principal: mostrar TODOS
if (activeCompanyId === mainCompanyId) {
  return allDocs;
}

// Cliente: solo documentos de ese cliente
return allDocs.filter(doc => {
  return String(doc.clientId) === String(activeCompanyId);
});
```

### Componentes Críticos

#### 1. `UsuarioDashboard.jsx`
```javascript
const { activeCompanyId, mainCompanyId } = useContext(AuthContext);
const companyId = mainCompanyId; // IMPORTANTE: Siempre mainCompanyId
```

#### 2. `VehiculosForm.jsx` / `PersonalForm.jsx`
```javascript
const finalCompanyId = mainCompanyId || userCompanyData?.companyId;
const clientId = (activeCompanyId && activeCompanyId !== mainCompanyId) 
  ? activeCompanyId 
  : null;

// Al guardar:
{
  companyId: finalCompanyId,  // Siempre empresa principal
  clientId: clientId          // null o ID del cliente
}
```

#### 3. `BulkUploadDialog.jsx`
```javascript
const finalCompanyId = companyId || mainCompanyId; // NUNCA activeCompanyId

// Al enviar al backend:
{
  companyId: finalCompanyId,        // Siempre empresa principal
  activeCompanyId: activeCompanyId, // Para calcular clientId
  mainCompanyId: mainCompanyId      // Para validación
}
```

#### 4. `BulkUploadReview.jsx`
```javascript
const metadata = {
  companyId: mainCompanyId,         // Siempre empresa principal
  activeCompanyId: activeCompanyId, // Para calcular clientId
  mainCompanyId: mainCompanyId      // Empresa principal
  // ... otros campos
};
```

### Vista Avanzada (`AdvancedDashboardView.jsx`)

**Documentos por Empresa**:
- Si `isMainCompany = true`: Muestra TODOS los documentos (incluyendo de clientes)
- Si `isMainCompany = false`: Solo documentos del cliente activo

**Documentos por Entidad**:
- Si `isMainCompany = true`: Muestra empleados/vehículos de todos los clientes
- Si `isMainCompany = false`: Solo empleados/vehículos del cliente activo

---

## Mejores Prácticas

### ✅ DO (Hacer)

1. **SIEMPRE usar `mainCompanyId` como `companyId`**:
   ```javascript
   const companyId = mainCompanyId; // ✅ Correcto
   ```

2. **Calcular `clientId` comparando `activeCompanyId` con `mainCompanyId`**:
   ```javascript
   const clientId = (activeCompanyId && activeCompanyId !== mainCompanyId)
     ? activeCompanyId
     : null;
   ```

3. **Enviar ambos identificadores al backend**:
   ```javascript
   {
     companyId: mainCompanyId,      // Siempre empresa principal
     activeCompanyId: activeCompanyId, // Para calcular clientId
     mainCompanyId: mainCompanyId     // Para validación
   }
   ```

4. **Filtrar por `clientId` solo cuando `activeCompanyId !== mainCompanyId`**:
   ```javascript
   if (activeCompanyId === mainCompanyId) {
     // Mostrar todo, sin filtrar
   } else {
     // Filtrar por clientId === activeCompanyId
   }
   ```

### ❌ DON'T (No hacer)

1. **NUNCA usar `activeCompanyId` como `companyId`**:
   ```javascript
   const companyId = activeCompanyId; // ❌ INCORRECTO
   ```

2. **NUNCA cambiar `companyId` cuando se selecciona un cliente**:
   ```javascript
   const companyId = activeCompanyId || mainCompanyId; // ❌ INCORRECTO
   ```

3. **NUNCA omitir enviar `activeCompanyId` y `mainCompanyId` al backend**:
   ```javascript
   { companyId: mainCompanyId } // ❌ Falta activeCompanyId
   ```

4. **NUNCA filtrar por `clientId` cuando `activeCompanyId === mainCompanyId`**:
   ```javascript
   // ❌ INCORRECTO: Filtrar cuando estamos en empresa principal
   if (activeCompanyId === mainCompanyId) {
     return allDocs.filter(doc => doc.clientId === null); // ❌
   }
   ```

### Patrón de Código Recomendado

```javascript
// 1. Obtener del contexto
const { activeCompanyId, mainCompanyId } = useContext(AuthContext);

// 2. Definir companyId (SIEMPRE mainCompanyId)
const companyId = mainCompanyId;

// 3. Determinar si estamos en cliente
const isMainCompany = activeCompanyId === mainCompanyId;

// 4. Calcular clientId
const clientId = isMainCompany ? null : activeCompanyId;

// 5. Filtrar datos según contexto
const filteredData = isMainCompany
  ? allData // Mostrar todo
  : allData.filter(item => String(item.clientId) === String(activeCompanyId));

// 6. Al guardar/actualizar
const dataToSave = {
  companyId: mainCompanyId,  // Siempre empresa principal
  clientId: clientId,        // null o ID del cliente
  // ... otros campos
};
```

---

## Resumen de Reglas

| Campo | Valor | Cuándo Cambia |
|-------|-------|---------------|
| `companyId` | `mainCompanyId` | **NUNCA** |
| `mainCompanyId` | ID empresa principal | Solo si usuario cambia de empresa |
| `activeCompanyId` | `mainCompanyId` o `clientId` | Cada vez que usuario cambia selector |
| `clientId` | `null` o ID cliente | Solo al crear/editar elemento |

| Vista | `activeCompanyId` | Filtrado |
|-------|-------------------|----------|
| Empresa Principal | `= mainCompanyId` | **Sin filtrar** (mostrar todo) |
| Cliente | `≠ mainCompanyId` | **Filtrar** por `clientId === activeCompanyId` |

---

**Última actualización**: Diciembre 2024

