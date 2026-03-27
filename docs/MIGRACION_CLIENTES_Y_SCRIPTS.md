# Migración de Documentos a Clientes y Scripts de Gestión

## 📋 Índice:

1. [Introducción](#introducción)
2. [Estructura de Datos](#estructura-de-datos)
3. [Scripts Disponibles](#scripts-disponibles)
4. [Flujo de Trabajo](#flujo-de-trabajo)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

Este documento describe el sistema de migración de documentos de empresas principales a clientes (subempresas) y los scripts disponibles para gestionar esta funcionalidad.

### Conceptos Clave

- **Empresa Principal (Main Company)**: Empresa que puede tener múltiples clientes/subempresas
- **Cliente (Client)**: Subempresa asociada a una empresa principal
- **appliesTo**: Campo que define a quién aplica un documento requerido (`main` y `clients`)
- **clientId**: Campo que identifica a qué cliente pertenece un documento subido/aprobado, empleado o vehículo

---

## Estructura de Datos

### Documentos Requeridos (`requiredDocuments`)

```javascript
{
  companyId: "22222222222", // Siempre la empresa principal
  appliesTo: {
    main: true | false,     // Si aplica a la empresa principal
    clients: null | [] | ["clientId1", "clientId2"] // IDs de clientes
  }
}
```

**Reglas:**
- `main: true, clients: null/[]` → Solo aparece en empresa principal
- `main: false, clients: ["id1"]` → Solo aparece en el cliente específico
- `main: true, clients: ["id1"]` → Aparece en empresa principal Y en el cliente

### Documentos Subidos/Aprobados (`uploadedDocuments`, `approvedDocuments`)

```javascript
{
  companyId: "22222222222", // Siempre la empresa principal
  clientId: null | "clientId" // ID del cliente (null = empresa principal)
}
```

### Empleados y Vehículos (`personal`, `vehiculos`)

```javascript
{
  companyId: "22222222222", // Siempre la empresa principal
  clientId: null | "clientId" // ID del cliente (null = empresa principal)
}
```

### Clientes (`companies`)

```javascript
{
  companyName: "YPF",
  parentCompanyId: "22222222222", // ID de la empresa principal
  type: "client",
  active: true,
  status: "approved" | "pending"
}
```

---

## Scripts Disponibles

### 1. `createClient.js` - Crear Cliente

Crea un nuevo cliente (subempresa) para una empresa principal.

**Uso:**
```bash
node backend/scripts/createClient.js [tenantId] [mainCompanyId] [clientName] [--approve]
```

**Ejemplo:**
```bash
node backend/scripts/createClient.js hise 22222222222 "YPF" --approve
```

**Parámetros:**
- `tenantId`: ID del tenant (default: `hise`)
- `mainCompanyId`: ID de la empresa principal
- `clientName`: Nombre del cliente
- `--approve`: Aprobar automáticamente el cliente (opcional)

**Funcionalidad:**
- Valida que la empresa principal exista y sea tipo "main"
- Verifica que no exista un cliente con el mismo nombre
- Crea el cliente con `status: 'pending'` (o `'approved'` si usa `--approve`)

---

### 2. `copyCompanyData.js` - Copiar Datos de Empresa

Copia todos los datos de una empresa a otra (útil para pruebas).

**Uso:**
```bash
node backend/scripts/copyCompanyData.js [tenantId] [sourceCompanyId] [targetCompanyId] [--dry-run] [--backup]
```

**Ejemplo:**
```bash
node backend/scripts/copyCompanyData.js hise 30708512547 22222222222 --backup
```

**Parámetros:**
- `tenantId`: ID del tenant
- `sourceCompanyId`: ID de la empresa origen
- `targetCompanyId`: ID de la empresa destino
- `--dry-run`: Solo simula sin guardar cambios
- `--backup`: Crea backup de la empresa destino antes de copiar

**Copia:**
- Documentos requeridos
- Documentos subidos
- Documentos aprobados
- Empleados
- Vehículos

**Nota:** Los datos copiados mantienen la estructura pero se actualizan los `companyId` y timestamps.

---

### 3. `assignDocumentsToClientsByName.js` - Asignar Documentos por Nombre

Asigna documentos a clientes según el nombre del documento.

**Uso:**
```bash
node backend/scripts/assignDocumentsToClientsByName.js [tenantId] [mainCompanyId] [--dry-run] [--backup]
```

**Ejemplo:**
```bash
node backend/scripts/assignDocumentsToClientsByName.js hise 22222222222 --dry-run
```

**Lógica de Asignación:**
- Si el nombre contiene "ypf" o "YPF" → Cliente YPF
- Si el nombre contiene "rda" o "RDA" → Cliente RDA
- Si no contiene ninguno → Cliente RDA (por defecto)
- Empleados y vehículos → Cliente RDA

**Actualiza:**
- `clientId` en documentos subidos/aprobados
- `appliesTo.clients` en documentos requeridos
- `appliesTo.main = false` (para que no aparezcan en empresa principal)
- `clientId` en empleados y vehículos

---

### 4. `migrateDocumentsToClient.js` - Migrar Documentos a Cliente

Migra documentos, empleados y vehículos de una empresa principal a un cliente específico.

**Uso:**
```bash
node backend/scripts/migrateDocumentsToClient.js [--dry-run] [--backup] [tenantId] [mainCompanyId] [clientNameOrId]
```

**Ejemplo:**
```bash
node backend/scripts/migrateDocumentsToClient.js --dry-run --backup hise 30708512547 "ultimo"
```

**Funcionalidad:**
- Busca el cliente por nombre o ID
- Migra documentos subidos y aprobados (agrega `clientId`)
- Actualiza `appliesTo.clients` en documentos requeridos
- Migra empleados y vehículos (agrega `clientId`)
- Mantiene `companyId` (siempre la empresa principal)

---

### 5. `createBackupOnly.js` - Crear Backup

Crea un backup de todos los datos de una empresa antes de migraciones.

**Uso:**
```bash
node backend/scripts/createBackupOnly.js [tenantId] [mainCompanyId]
```

**Ejemplo:**
```bash
node backend/scripts/createBackupOnly.js hise 30708512547
```

**Backup incluye:**
- Documentos requeridos
- Documentos subidos
- Documentos aprobados
- Empleados
- Vehículos

**Ubicación:** `backend/scripts/backups/backup-{tenantId}-{companyId}-{timestamp}.json`

---

### 6. `analyzeCompanyData.js` - Analizar Datos de Empresa

Analiza el estado actual de una empresa para identificar qué necesita migración.

**Uso:**
```bash
node backend/scripts/analyzeCompanyData.js [tenantId] [mainCompanyId]
```

**Ejemplo:**
```bash
node backend/scripts/analyzeCompanyData.js hise 30708512547
```

**Muestra:**
- Lista de clientes
- Conteo de documentos (migrados vs. por migrar)
- Conteo de empleados y vehículos (migrados vs. por migrar)
- Ejemplos de documentos que necesitan migración

---

### 7. `listRequiredDocumentsByClient.js` - Listar Documentos por Cliente

Lista todos los clientes y los documentos requeridos asignados a cada uno.

**Uso:**
```bash
node backend/scripts/listRequiredDocumentsByClient.js [tenantId] [mainCompanyId]
```

**Ejemplo:**
```bash
node backend/scripts/listRequiredDocumentsByClient.js hise 22222222222
```

**Muestra:**
- Documentos asignados a cada cliente
- Documentos solo en empresa principal
- Documentos con `appliesTo.clients: null`

---

### 8. `analyzeClientAssignments.js` - Analizar Asignaciones

Analiza qué documentos están asignados a cada cliente y a la empresa principal.

**Uso:**
```bash
node backend/scripts/analyzeClientAssignments.js [tenantId] [mainCompanyId]
```

**Ejemplo:**
```bash
node backend/scripts/analyzeClientAssignments.js hise 22222222222
```

**Muestra:**
- Documentos requeridos por cliente
- Documentos subidos/aprobados por cliente
- Empleados y vehículos por cliente
- Documentos sin asignar (en empresa principal)

---

### 9. `checkAppliesToValues.js` - Verificar Valores de appliesTo

Verifica los valores de `appliesTo` en documentos requeridos.

**Uso:**
```bash
node backend/scripts/checkAppliesToValues.js
```

**Muestra:**
- Documentos con `main=true, clients=null/[]` (solo empresa principal)
- Documentos con `main=true, clients=[...]` (empresa principal Y clientes)
- Documentos con `main=false, clients=[...]` (solo clientes)

---

## Flujo de Trabajo

### Escenario 1: Migración Inicial (Empresa sin Clientes → Con Clientes)

1. **Crear clientes:**
   ```bash
   node backend/scripts/createClient.js hise 30708512547 "YPF" --approve
   node backend/scripts/createClient.js hise 30708512547 "RDA" --approve
   ```

2. **Crear backup:**
   ```bash
   node backend/scripts/createBackupOnly.js hise 30708512547
   ```

3. **Analizar datos:**
   ```bash
   node backend/scripts/analyzeCompanyData.js hise 30708512547
   ```

4. **Asignar documentos por nombre (si aplica):**
   ```bash
   node backend/scripts/assignDocumentsToClientsByName.js hise 30708512547 --dry-run
   node backend/scripts/assignDocumentsToClientsByName.js hise 30708512547
   ```

5. **Verificar asignaciones:**
   ```bash
   node backend/scripts/analyzeClientAssignments.js hise 30708512547
   ```

### Escenario 2: Migración Manual a Cliente Específico

1. **Crear backup:**
   ```bash
   node backend/scripts/createBackupOnly.js hise 30708512547
   ```

2. **Migrar a cliente específico:**
   ```bash
   node backend/scripts/migrateDocumentsToClient.js --dry-run --backup hise 30708512547 "nombreCliente"
   node backend/scripts/migrateDocumentsToClient.js --backup hise 30708512547 "nombreCliente"
   ```

3. **Verificar:**
   ```bash
   node backend/scripts/listRequiredDocumentsByClient.js hise 30708512547
   ```

### Escenario 3: Copiar Datos para Pruebas

1. **Copiar datos:**
   ```bash
   node backend/scripts/copyCompanyData.js hise 30708512547 22222222222 --backup
   ```

2. **Crear clientes en empresa de prueba:**
   ```bash
   node backend/scripts/createClient.js hise 22222222222 "YPF" --approve
   node backend/scripts/createClient.js hise 22222222222 "RDA" --approve
   ```

3. **Asignar documentos:**
   ```bash
   node backend/scripts/assignDocumentsToClientsByName.js hise 22222222222
   ```

---

## Ejemplos de Uso

### Ejemplo 1: Migración Completa de SegPro srl

```bash
# 1. Crear backup
node backend/scripts/createBackupOnly.js hise 30708512547

# 2. Crear cliente YPF
node backend/scripts/createClient.js hise 30708512547 "YPF" --approve

# 3. Analizar qué hay que migrar
node backend/scripts/analyzeCompanyData.js hise 30708512547

# 4. Migrar documentos a YPF
node backend/scripts/migrateDocumentsToClient.js --backup hise 30708512547 "YPF"

# 5. Verificar
node backend/scripts/listRequiredDocumentsByClient.js hise 30708512547
```

### Ejemplo 2: Asignación Automática por Nombre

```bash
# 1. Ver qué pasaría (dry-run)
node backend/scripts/assignDocumentsToClientsByName.js hise 22222222222 --dry-run

# 2. Ejecutar asignación
node backend/scripts/assignDocumentsToClientsByName.js hise 22222222222

# 3. Verificar valores de appliesTo
node backend/scripts/checkAppliesToValues.js

# 4. Analizar resultado
node backend/scripts/analyzeClientAssignments.js hise 22222222222
```

---

## Solución de Problemas

### Problema: Documentos aparecen en empresa principal cuando deberían estar solo en clientes

**Causa:** Los documentos tienen `appliesTo.main = true`

**Solución:**
1. Verificar valores:
   ```bash
   node backend/scripts/checkAppliesToValues.js
   ```

2. Si hay documentos con `main=true` y `clients=[...]`, ejecutar:
   ```bash
   node backend/scripts/assignDocumentsToClientsByName.js hise [mainCompanyId]
   ```
   Este script pone `main=false` cuando asigna a clientes.

### Problema: Cliente no ve documentos requeridos

**Causa:** El documento no tiene el cliente en `appliesTo.clients`

**Solución:**
1. Verificar asignaciones:
   ```bash
   node backend/scripts/listRequiredDocumentsByClient.js hise [mainCompanyId]
   ```

2. Si falta asignación, usar el selector en la UI (role=max) o migrar manualmente:
   ```bash
   node backend/scripts/migrateDocumentsToClient.js hise [mainCompanyId] [clientName]
   ```

### Problema: Empleados/vehículos no aparecen en dashboard del cliente

**Causa:** No tienen `clientId` asignado o el filtro en `useDashboardDataQuery.js` no está funcionando

**Solución:**
1. Verificar asignaciones:
   ```bash
   node backend/scripts/analyzeClientAssignments.js hise [mainCompanyId]
   ```

2. Si no tienen `clientId`, migrar:
   ```bash
   node backend/scripts/migrateDocumentsToClient.js hise [mainCompanyId] [clientName]
   ```

### Problema: Error "Cliente no encontrado"

**Causa:** El cliente no existe o el nombre/ID es incorrecto

**Solución:**
1. Verificar clientes:
   ```bash
   node backend/scripts/analyzeCompanyData.js hise [mainCompanyId]
   ```

2. Crear cliente si no existe:
   ```bash
   node backend/scripts/createClient.js hise [mainCompanyId] "NombreCliente" --approve
   ```

---

## Notas Importantes

1. **Siempre hacer backup antes de migraciones importantes:**
   ```bash
   node backend/scripts/createBackupOnly.js hise [mainCompanyId]
   ```

2. **Usar `--dry-run` primero para ver qué pasaría:**
   ```bash
   node backend/scripts/[script].js --dry-run [args]
   ```

3. **Los documentos requeridos siempre tienen `companyId` de la empresa principal**, no del cliente.

4. **Los documentos subidos/aprobados, empleados y vehículos mantienen `companyId` de la empresa principal** y agregan `clientId` cuando pertenecen a un cliente.

5. **`appliesTo.main = false`** significa que el documento NO aparece en la empresa principal, solo en los clientes especificados en `appliesTo.clients`.

6. **`appliesTo.clients = null`** significa que el documento NO aplica a ningún cliente, solo a la empresa principal (si `main = true`).

---

## Referencias

- **Código de filtrado:** `src/entidad/user/components/hooks/useDashboardDataQuery.js`
- **Selector de clientes en UI:** `src/entidad/adm/DocumentoRequerido/DocumentList.jsx`
- **Gestión de clientes:** `src/entidad/user/components/ClientManagement.jsx`

---

## Referencias Adicionales

- **Arquitectura de Clientes**: Ver `docs/ARQUITECTURA_CLIENTES.md` para detalles técnicos sobre `companyId`, `mainCompanyId`, `activeCompanyId` y `clientId`
- **Vista Avanzada**: Ver `docs/PERSONALIZACION_TEMA_Y_VISTAS_AVANZADAS.md` para información sobre la vista avanzada del dashboard

---

**Última actualización:** Diciembre 2024

