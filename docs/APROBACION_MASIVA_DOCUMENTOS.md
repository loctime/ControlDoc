# 📋 Aprobación Masiva de Documentos - ControlDoc v2

Este documento describe el plan de implementación para la funcionalidad de aprobación masiva de documentos, permitiendo a los administradores revisar múltiples páginas de un documento y aprobarlas en lote con fechas de vencimiento específicas.

## 🎯 Objetivo

Permitir la aprobación masiva de documentos del mismo tipo (ej: recibos de sueldo) para facilitar la migración de nuevos clientes, manteniendo la misma estructura de datos y flujo que la aprobación individual.

## 🔄 Flujo General

### 1. Vista de Páginas
```
Admin abre modal → Ve todas las páginas → Selecciona fechas → Aproba en lote
```

### 2. Proceso de Aprobación Masiva
```
Loop por cada página → handleApproveOrReject() → Misma estructura Firestore
```

## 📁 Estructura de Datos (Sin Cambios)

### uploadedDocuments
- **Sin cambios**: Misma estructura actual
- **Proceso**: Update individual por página

### approvedDocuments  
- **Sin cambios**: Misma estructura actual
- **Proceso**: Add individual por página

### requiredDocuments
- **Sin cambios**: Misma estructura actual
- **Proceso**: Update por lote al final

## ⚙️ Componentes a Implementar

### Frontend
- **`AllPagesModal.jsx`**: Barra de acciones masivas
- **`handleBatchApprove.jsx`**: Loop de aprobaciones individuales
- **Estados**: `selectedDateForPage`, `batchProcessing`

### Backend  
- **Sin cambios**: Usa APIs existentes
- **Proceso**: Mismo `handleApproveOrReject` en loop

## 🔧 Implementación Detallada

### 1. **Barra de Acciones Masivas**
```javascript
// AllPagesModal.jsx - Barra fija en la parte inferior
<Box sx={{ 
  position: 'sticky', 
  bottom: 0, 
  backgroundColor: '#f8f9fa',
  borderTop: '1px solid #e0e0e0',
  p: 2
}}>
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Typography variant="body2">
      {Object.keys(selectedDateForPage).length} de {numPages} páginas con fecha seleccionada
    </Typography>
    
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button
        variant="contained"
        color="success"
        startIcon={<CheckCircle />}
        onClick={handleBatchApprove}
        disabled={Object.keys(selectedDateForPage).length === 0 || isProcessing}
      >
        Aprobar Seleccionados
      </Button>
      
      <Button
        variant="contained"
        color="error"
        startIcon={<Cancel />}
        onClick={handleBatchReject}
        disabled={Object.keys(selectedDateForPage).length === 0 || isProcessing}
      >
        Rechazar Seleccionados
      </Button>
    </Box>
  </Box>
</Box>
```

### 2. **Loop de Aprobaciones**
```javascript
// handleBatchApprove.jsx
const handleBatchApprove = async () => {
  setIsProcessing(true);
  const results = [];
  
  try {
    for (const [pageNum, expirationDate] of Object.entries(selectedDateForPage)) {
      console.log(`🔄 Procesando página ${pageNum} con fecha ${expirationDate}`);
      
      // Usar el mismo proceso que aprobación individual
      const result = await handleApproveOrReject({
        docId: `${documentId}_page_${pageNum}`, // ID único por página
        expirationDate,
        isAprobando: true,
        // ... otros parámetros del documento original
      });
      
      results.push({ pageNum, success: true, result });
    }
    
    console.log('✅ Aprobación masiva completada:', results);
    onClose(); // Cerrar modal
    
  } catch (error) {
    console.error('❌ Error en aprobación masiva:', error);
    // Mostrar errores específicos
  } finally {
    setIsProcessing(false);
  }
};
```

### 3. **Estados del Modal**
```javascript
// AllPagesModal.jsx
const [selectedDateForPage, setSelectedDateForPage] = useState({});
const [isProcessing, setIsProcessing] = useState(false);
const [processingPage, setProcessingPage] = useState(null);

// Ejemplo: { "1": "01/03/25", "2": "15/06/25", "3": "30/12/25" }
```

### 4. **Validaciones**
```javascript
// Validaciones antes de procesar
const canProcess = Object.keys(selectedDateForPage).length > 0;
const hasInvalidDates = Object.values(selectedDateForPage).some(date => !isValidDate(date));

if (!canProcess) {
  setToastMessage('Debe seleccionar al menos una página con fecha.');
  return;
}

if (hasInvalidDates) {
  setToastMessage('Todas las fechas deben ser válidas.');
  return;
}
```

## 🎨 UX/UI Mejorada

### 1. **Indicadores Visuales**
```javascript
// Estados por página en la miniatura
<Box sx={{ 
  position: 'relative',
  '&::after': processingPage === page.pageNum ? {
    content: '"Procesando..."',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px'
  } : {}
}}>
```

### 2. **Progreso en Tiempo Real**
```javascript
// Barra de progreso durante procesamiento
<LinearProgress 
  variant="determinate" 
  value={(processedPages / totalPages) * 100}
  sx={{ mb: 1 }}
/>
<Typography variant="caption">
  Procesando página {processingPage} de {totalPages}
</Typography>
```

### 3. **Confirmación Antes de Procesar**
```javascript
const handleBatchApprove = () => {
  const count = Object.keys(selectedDateForPage).length;
  const confirmed = window.confirm(
    `¿Está seguro de aprobar ${count} páginas con las fechas seleccionadas?`
  );
  
  if (confirmed) {
    processBatchApprove();
  }
};
```

## 🔄 Flujo de Datos

### 1. **Selección de Fechas**
```
Usuario click en página → Abre en grande → Click en fecha subrayada → 
Guarda en selectedDateForPage[pageNum] → Vuelve a vista general
```

### 2. **Procesamiento en Lote**
```
Click "Aprobar Seleccionados" → Loop por selectedDateForPage → 
handleApproveOrReject() por cada página → Misma estructura Firestore
```

### 3. **Resultado Final**
```
uploadedDocuments: Actualizados (status: 'Aprobado')
approvedDocuments: Agregados (con metadata completa)
requiredDocuments: Actualizados (aprobado para tenant)
```

## 🛡️ Consideraciones de Seguridad

### 1. **Validaciones Administraticas**
```javascript
// Solo admins pueden hacer aprobación masiva
if (!adminRole) {
  throw new Error('Solo administradores pueden aprobar documentos en lote');
}
```

### 2. **Límites de Procesamiento**
```javascript
// Máximo 50 páginas por lote para evitar timeouts
const MAX_PAGES_PER_BATCH = 50;
if (Object.keys(selectedDateForPage).length > MAX_PAGES_PER_BATCH) {
  setToastMessage(`Máximo ${MAX_PAGES_PER_BATCH} páginas por lote`);
  return;
}
```

### 3. **Manejo de Errores**
```javascript
// Si falla una página, continuar con las demás
const results = [];
for (const page of pages) {
  try {
    const result = await processPage(page);
    results.push({ page, success: true, result });
  } catch (error) {
    results.push({ page, success: false, error });
    console.error(`Error procesando página ${page}:`, error);
  }
}
```

## 📊 Estados del Modal

| Estado | Descripción | UI |
|--------|-------------|-----|
| `selectedDateForPage` | Fechas seleccionadas por página | Panel verde debajo de miniatura |
| `isProcessing` | Procesamiento en curso | Botones deshabilitados, spinner |
| `processingPage` | Página actualmente procesando | Overlay en miniatura |

## 🚀 Mejoras de Performance

### 1. **Procesamiento Asíncrono**
```javascript
// No bloquear UI durante procesamiento
const processBatch = async () => {
  setIsProcessing(true);
  
  for (const page of pages) {
    setProcessingPage(page.num);
    await processPage(page);
    await new Promise(resolve => setTimeout(resolve, 100)); // Pequeña pausa
  }
  
  setIsProcessing(false);
};
```

### 2. **Cancelación de Proceso**
```javascript
const [isCancelled, setIsCancelled] = useState(false);

const handleCancel = () => {
  setIsCancelled(true);
  setIsProcessing(false);
};
```

## 🎯 Workflows Específicos

### Aprobación Masiva de Recibos de Sueldo
1. Admin abre modal → Ve 12 páginas (recibos de 12 meses)
2. Selecciona fechas específicas para cada mes
3. Click "Aprobar Seleccionados" → Procesa las 12 páginas
4. Resultado: 12 documentos aprobados en `approvedDocuments`

### Rechazo Masivo
1. Admin selecciona páginas problemáticas
2. Click "Rechazar Seleccionados" → Marca como rechazadas
3. Documentos quedan en `uploadedDocuments` con status 'Rechazado'

---

## 🏗️ Arquitectura Técnica

```mermaid
graph TD
    A[Admin abre modal] --> B[Ve miniaturas de páginas]
    B --> C[Click en página]
    C --> D[Selecciona fecha subrayada]
    D --> E[Vuelve a vista general]
    E --> F[Repite para más páginas]
    F --> G[Click "Aprobar Seleccionados"]
    G --> H[Loop por selectedDateForPage]
    H --> I[handleApproveOrReject por cada página]
    I --> J[uploadedDocuments: status='Aprobado']
    J --> K[approvedDocuments: add con metadata]
    K --> L[requiredDocuments: update]
    L --> M[✅ Aprobación masiva completada]
```

---

**Última actualización**: Enero 2025  
**Autor**: Sistema ControlDoc v2  
**Estado**: Plan de implementación
