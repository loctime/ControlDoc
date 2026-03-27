# 🤖 Clasificación Automática de Documentos - ControlDoc v5

Este documento describe el sistema de análisis y clasificación automática de documentos implementado en ControlDoc v5, que permite subir múltiples archivos simultáneamente y obtener sugerencias inteligentes sobre su tipo, entidad asociada y campos detectados.

## 🎯 Objetivo

Automatizar el proceso de subida masiva de documentos mediante:
- **OCR inteligente** para extraer texto de imágenes y PDFs
- **Clasificación automática** comparando con documentos requeridos existentes
- **Detección de entidades** (empleados, vehículos) por DNI o patente
- **Extracción de campos** (DNI, patente, teléfono, fechas, nombres)
- **Agrupación por similitud** para documentos relacionados

## 🔄 Flujo General

### 1. Subida Temporal
```
Usuario selecciona archivos → Subida temporal a Backblaze → URLs temporales
```

### 2. Detección de Separaciones (PDFs grandes)
```
PDFs >5MB → Detección automática de múltiples documentos → Usuario revisa/ajusta separaciones → Separación en múltiples PDFs
```

### 3. Análisis y Clasificación
```
Backend analiza cada archivo → OCR/Extracción texto → Compara con documentos ejemplo (usando metadata guardada) → Sugerencias
```

### 4. Revisión y Confirmación
```
Usuario revisa sugerencias → Edita si es necesario → Confirma subida final → Archivos a ubicación permanente
```

## 📁 Componentes Principales

### Frontend

#### `BulkUploadDialog.jsx`
- **Propósito**: Diálogo principal para subida masiva
- **Flujo**:
  1. Selección de archivos (drag & drop o input)
  2. Subida temporal a Backblaze (`temp-uploads/`)
  3. **Detección automática de separaciones** en PDFs >5MB
  4. Revisión de separaciones con `PdfSeparationReview` (si se detectan)
  5. Llamada a `/api/bulk-upload/prepare` para análisis
  6. Renderizado de `BulkUploadReview` con resultados

**Características**:
- Validación de tipos de archivo (PDF, JPG, PNG, WEBP)
- Límite de tamaño: 400MB por archivo
- **Detección automática** de múltiples documentos en PDFs grandes
- **Separación automática** de PDFs en múltiples documentos
- Progreso de subida individual por archivo
- Manejo de errores por archivo

#### `PdfSeparationReview.jsx`
- **Propósito**: Revisar y confirmar separaciones detectadas automáticamente
- **Características**:
  - Muestra separaciones sugeridas con confianza y razones
  - Permite marcar/desmarcar separaciones
  - Opción de agregar separaciones manuales
  - Vista previa de documentos que se crearán
  - Confirmación para separar PDF en múltiples documentos

#### `BulkUploadReview.jsx`
- **Propósito**: Tabla de revisión con sugerencias y opciones de edición
- **Características**:
  - **Tabla responsive** con columnas: Archivo, Tipo Documento, Entidad, Confianza, Campos Detectados, Acciones
  - **Vista previa de archivos** (PDF/imágenes) con componente `VistaPrevia`
  - **Edición inline** de tipo de documento y entidad
  - **Indicadores de confianza** con colores (verde ≥70%, amarillo 40-69%, rojo <40%)
  - **Tooltips explicativos** sobre cómo funcionan las sugerencias
  - **Campos detectados** mostrados como chips con tooltips
  - **Selección de texto** para extraer campos manualmente (`TextSelectorDialog`)

**Mejoras implementadas**:
- Nombres de archivo truncados con tooltip del nombre completo
- Iconos PDF/imagen para identificación rápida
- Tooltips informativos sobre confianza y funcionamiento
- Preview completo de documentos en modal separado

### Backend

#### `backend/routes/bulkUpload.js`

**Endpoint**: `POST /api/bulk-upload/prepare`

**Parámetros**:
```javascript
{
  files: [
    { fileURL: "https://...", fileName: "documento.pdf" }
  ],
  lang: "spa",              // Idioma para OCR
  concurrencyLimit: 3,      // Archivos procesados en paralelo
  companyId: "..."          // ID de la empresa
}
```

**Proceso**:

1. **Análisis de Archivos** (paralelo con límite):
   - Descarga cada archivo desde URL temporal
   - Detecta tipo (PDF o imagen)
   - Extrae texto:
     - **PDFs**: Extracción directa de texto, OCR si no tiene texto
     - **Imágenes**: OCR con Tesseract.js (idioma español/inglés)

2. **Comparación con Documentos Ejemplo**:
   - Busca documentos requeridos de la empresa con `exampleImageURL`
   - **Prioriza metadata guardada** (`exampleMetadata.text`) si está disponible
   - Si no hay metadata guardada, analiza el ejemplo en tiempo real (fallback)
   - Compara texto extraído con texto de ejemplos usando **similitud Jaccard**
   - Calcula confianza (0-1) basada en similitud
   - Selecciona documento requerido con mayor confianza

**Optimización de Metadata**:
- Cuando se sube un `exampleImage` a un documento requerido, se analiza automáticamente
- La metadata (texto, palabras, campos detectados) se guarda en `exampleMetadata`
- En futuras clasificaciones, se usa esta metadata guardada (más rápido)
- Si la metadata no está disponible, se analiza el ejemplo como fallback

3. **Detección de Campos**:
   ```javascript
   detectFields(text, words) {
     // DNI: 7-9 dígitos (formato argentino)
     // Patente: 2-3 letras + 3 números + 0-3 letras
     // Teléfono: Formato argentino
     // Fechas: DD/MM/YYYY, YYYY-MM-DD, DD de mes YYYY
     // Nombres: Palabras con mayúscula inicial
   }
   ```

4. **Búsqueda de Entidades**:
   - Si detecta DNI → busca en colección `personal`
   - Si detecta patente → busca en colección `vehiculos`
   - Asigna `entityId` y `entityName` si encuentra coincidencia

5. **Agrupación por Similitud**:
   - Compara textos de todos los archivos
   - Agrupa archivos con similitud > 0.8
   - Retorna grupos para visualización

**Respuesta**:
```javascript
{
  success: true,
  suggestions: [
    {
      fileName: "documento.pdf",
      fileURL: "https://...",
      text: "Texto extraído...",
      words: [...],
      suggestion: {
        requiredDocumentId: "doc-id",
        requiredDocumentName: "Recibo de sueldo",
        entityType: "employee",
        entityId: "person-id",
        entityName: "Juan Pérez",
        confidence: 0.85,
        detectedFields: {
          dni: "37399349",
          nombre: "Juan Pérez",
          fechas: ["04/12/2025"]
        }
      },
      success: true,
      error: null
    }
  ],
  groups: [
    {
      fileIndices: [0, 2, 5],
      similarity: 0.92
    }
  ],
  analysisId: "unique-id"
}
```

## 🔧 Funciones de Clasificación

### Similitud de Textos (Jaccard)
```javascript
compareTexts(text1, text2) {
  // Normaliza textos (lowercase, trim)
  // Divide en palabras (Set)
  // Calcula: intersección / unión
  // Retorna: 0-1 (1 = idéntico)
}
```

### Detección de Campos
- **DNI**: `/\b\d{2}\.?\d{3}\.?\d{3}\b/` (formato argentino)
- **Patente**: `/\b[A-Z]{2,3}\s?\d{3}[A-Z]{0,3}\b/i`
- **Teléfono**: `/(\+?54\s?)?(\d{2,4}\s?[-.]?\s?\d{3,4}\s?[-.]?\s?\d{4})/`
- **Fechas**: Múltiples formatos (DD/MM/YYYY, YYYY-MM-DD, DD de mes YYYY)
- **Nombres**: Palabras con mayúscula inicial, sin números

### Búsqueda de Entidades
- Normaliza valores (elimina puntos, espacios, guiones)
- Busca en Firestore con `where()` por campo específico
- Retorna primera coincidencia con `entityId` y `entityName`

## 📊 Niveles de Confianza

| Confianza | Color | Significado | Acción Recomendada |
|-----------|-------|-------------|-------------------|
| ≥ 70% | Verde | Alta confianza - Muy seguro | Confirmar directamente |
| 40-69% | Amarillo | Confianza media | Revisar antes de confirmar |
| < 40% | Rojo | Baja confianza | Requiere asignación manual |

## 🎨 Características de UI/UX

### Tabla de Revisión
- **Sticky header** para mejor navegación
- **Hover effects** en filas
- **Chips de estado** para errores y progreso
- **Tooltips informativos** en todos los elementos
- **Nombres truncados** con tooltip del nombre completo

### Vista Previa
- **Modal fullscreen** para ver documentos completos
- **Soporte PDF** con `VistaPrevia` component
- **Soporte imágenes** (JPG, PNG, WEBP)
- **Zoom y pan** para documentos grandes
- **Cierre y limpieza** automática de blobs temporales

### Edición Inline
- **Dropdown de documentos requeridos** filtrado por tipo de entidad
- **Dropdown de entidades** (empleados/vehículos) según tipo
- **Botones de acción**: Ver, Editar, Guardar
- **Validación** antes de confirmar subida final

## ⚙️ Configuración Multi-Tenant

### Contexto de Autenticación
El sistema utiliza `AuthContext` para obtener:
- `activeCompanyId`: Cliente/empresa activa actualmente
- `mainCompanyId`: Empresa principal (raíz)
- `finalCompanyId`: Fallback inteligente (`companyId || activeCompanyId || mainCompanyId`)

### Filtrado de Documentos Requeridos
- Los documentos requeridos están asociados a `mainCompanyId`
- Se filtran según `appliesTo` (empresa principal vs clientes)
- Solo se comparan documentos aplicables al contexto actual

### Filtrado de Entidades
- Las búsquedas de entidades respetan el `companyId` actual
- Soporte para clientes/subempresas
- Aislamiento completo de datos entre tenants

## 🚨 Manejo de Errores

### Errores de Archivo Individual
- **No se cancela** el proceso completo
- **Muestra error** en la fila específica
- **Permite continuar** con los demás archivos
- **Marca archivo** como "Error" en la tabla

### Errores de OCR
- **Fallback** a resultado vacío si OCR falla
- **Mensaje informativo** al usuario
- **Opción de edición manual** siempre disponible

### Errores de Clasificación
- **Sugerencia vacía** si no encuentra coincidencias
- **Requiere asignación manual** (marcado en amarillo)
- **Opción de editar** antes de confirmar

## 📈 Optimizaciones

### Paralelismo
- **Límite de concurrencia**: 3 archivos simultáneos
- **Timeout**: 30 segundos por archivo
- **Procesamiento asíncrono** con `Promise.all()` limitado

### Caché
- **Hash de imágenes** para evitar re-procesamiento
- **Cache en memoria** para resultados OCR
- **Validación de URLs** antes de descargar

### Performance
- **Subida temporal** primero (más rápido)
- **Análisis en paralelo** (no bloquea UI)
- **Lazy loading** de componentes pesados
- **Cleanup automático** de archivos temporales

## 🔐 Seguridad

### Validación de URLs
- **Whitelist** de dominios permitidos (Backblaze)
- **Verificación** antes de descargar archivos
- **Sanitización** de nombres de archivo

### Autenticación
- **JWT token** requerido en todas las peticiones
- **Validación de usuario** en backend
- **Aislamiento por tenant** en consultas Firestore

### Límites
- **Tamaño máximo**: 400MB por archivo
- **Tipos permitidos**: PDF, JPG, PNG, WEBP
- **Concurrencia**: 3 archivos simultáneos
- **Timeout**: 30 segundos por archivo

## 🧪 Testing

### Casos de Prueba Recomendados

1. **Subida simple** (1 archivo PDF con texto)
2. **Subida masiva** (10+ archivos mixtos)
3. **Archivos sin texto** (imágenes escaneadas)
4. **Archivos muy grandes** (cerca del límite 400MB)
5. **Archivos con errores** (tipos inválidos)
6. **Detección de entidades** (DNI/patente existentes)
7. **Clasificación con baja confianza** (<40%)
8. **Edición de sugerencias** antes de confirmar
9. **Vista previa** de diferentes tipos de archivos
10. **Manejo de errores** (conexión, OCR, clasificación)

## 📝 Logs y Debugging

### Logs Importantes
```javascript
// Frontend
console.log('🔍 Preparando análisis de', filesToAnalyze.length, 'archivos...');
console.log('✅ Preparación completada:', data.suggestions.length, 'sugerencias');

// Backend
console.log('🔄 Procesando archivo:', fileName);
console.log('📝 OCR completado. Texto extraído:', text.length);
console.log('🎯 Comparación con documentos ejemplo:', comparisons.length);
console.log('✅ Clasificación completada:', suggestion);
```

### Verificación de Estado
- Verificar `companyId` en contexto
- Verificar `activeCompanyId` y `mainCompanyId`
- Verificar documentos requeridos cargados
- Verificar conexión con backend

## 💡 Sistema de Metadata de Ejemplos

### Análisis Automático de ExampleImage
- Cuando se sube o actualiza un `exampleImage` en un documento requerido, se analiza automáticamente
- La metadata extraída se guarda en el campo `exampleMetadata` del documento requerido
- Esta metadata incluye: texto, palabras con coordenadas, campos detectados, tipo de archivo

### Uso de Metadata Guardada
- En clasificaciones futuras, se prioriza usar `exampleMetadata.text` en lugar de analizar el ejemplo cada vez
- Esto mejora significativamente el rendimiento (no requiere OCR repetido)
- Si la metadata no está disponible, se analiza el ejemplo como fallback

### Actualización de Metadata
- Se actualiza automáticamente cuando:
  - Se crea un documento requerido con `exampleImage`
  - Se actualiza el `exampleImage` de un documento requerido existente
- **Pendiente**: Actualización basada en feedback del usuario (ver Mejoras Futuras)

## 🎯 Mejoras Futuras

### Corto Plazo
- [x] ✅ Metadata guardada de documentos ejemplo (implementado)
- [x] ✅ Detección automática de separaciones en PDFs (implementado)
- [x] ✅ Separación automática de PDFs en múltiples documentos (implementado)
- [ ] Guardar correcciones del usuario para aprendizaje
- [ ] Actualizar metadata de ejemplo con feedback acumulado
- [ ] Mejorar algoritmos de similitud (cosine similarity, TF-IDF)
- [ ] Añadir más patrones de detección (cuit, cuil)

### Medio Plazo
- [ ] Sistema de aprendizaje basado en feedback del usuario
- [ ] Sugerencias para marcar datos relevantes cuando confianza es baja
- [ ] Historial de decisiones del usuario para análisis de patrones
- [ ] Machine Learning para clasificación
- [ ] Entrenamiento con documentos propios de la empresa
- [ ] Detección automática de vencimientos
- [ ] Agrupación inteligente mejorada

### Largo Plazo
- [ ] API externa de OCR (Google Vision, AWS Textract)
- [ ] Análisis de firmas digitales
- [ ] Validación automática de documentos legales
- [ ] Integración con sistemas contables
- [ ] Dashboard de aprendizaje: ver qué documentos necesitan mejor metadata

## 🔧 Endpoints y Servicios de Backend

#### `backend/routes/pdfSeparations.js`

**Endpoints**:

1. **`POST /api/pdf-separations/detect`**
   - Detecta posibles separaciones de documentos en un PDF
   - Analiza cada página: texto, orientación, cantidad de contenido
   - Retorna sugerencias de páginas donde comenzar nuevos documentos
   - Parámetros: `{ pdfUrl, fileName }`
   - Retorna: `{ totalPages, separations[], pageAnalyses[] }`

2. **`POST /api/pdf-separations/split`**
   - Separa un PDF en múltiples documentos basándose en páginas especificadas
   - Crea un PDF por cada rango de páginas
   - Sube cada PDF separado a Backblaze
   - Parámetros: `{ pdfUrl, fileName, separationPages[], companyId, folder }`
   - Retorna: `{ documents[], totalDocuments, originalFile }`

#### `backend/services/pdfService.js`

**Funciones de Separación**:

1. **`detectDocumentSeparations(pdfUrl, baseURL)`**
   - Analiza cada página del PDF
   - Extrae texto y detecta características (orientación, cantidad de texto)
   - Identifica patrones que sugieren separación:
     - Páginas en blanco (alta confianza)
     - Cambio de orientación (alta confianza)
     - Cambio drástico en cantidad de texto (media confianza)
     - Patrones de texto comunes: títulos, DNI, fechas (baja-media confianza)
   - Retorna separaciones sugeridas con confianza y razones

2. **`splitPDFIntoDocuments(pdfUrl, separationPages)`**
   - Separa un PDF en múltiples documentos
   - Crea rangos de páginas para cada documento
   - Genera PDFs individuales usando `extractPagesFromPDF`
   - Retorna array de buffers PDF listos para subir

#### `backend/routes/requiredDocuments.js`

**Endpoint**: `POST /api/required-documents/analyze-example`

- Analiza un `exampleImage` cuando se sube/actualiza en un documento requerido
- Extrae texto, palabras y campos detectados con OCR
- Guarda metadata en `exampleMetadata` del documento requerido
- Usa esta metadata en futuras clasificaciones para mejor rendimiento

**Proceso**:
1. Recibe `exampleImageURL`, `documentId`, `companyId`
2. Analiza el archivo con `/api/analyze-file`
3. Detecta campos comunes (DNI, patente, teléfono, fechas, nombres)
4. Guarda metadata en Firestore:
   ```javascript
   {
     exampleMetadata: {
       text: "...",
       words: [...],
       type: "pdf|image",
       detectedFields: {...},
       analyzedAt: Date,
       analyzedBy: userId
     }
   }
   ```

### Sistema de Separación de PDFs

#### Detección Automática
- **Trigger**: PDFs mayores a 5MB durante subida masiva
- **Análisis**: Página por página buscando patrones de separación
- **Confianza**: Cada separación tiene un nivel de confianza (0-1)
- **Umbral**: Solo se sugieren separaciones con confianza ≥ 0.6

#### Patrones Detectados
1. **Páginas en blanco** (confianza: 0.4)
   - Página con <50 caracteres después de página con contenido
2. **Cambio de orientación** (confianza: 0.3)
   - Cambio entre portrait y landscape
3. **Cambio drástico en texto** (confianza: 0.2)
   - Ratio >2 o <0.3 entre páginas consecutivas
4. **Patrones de documento** (confianza: 0.15 cada uno)
   - Títulos comunes: "DOCUMENTO", "CERTIFICADO", "COMPROBANTE"
   - Combinación de fecha + DNI detectados
5. **Página inicial** (confianza: 0.2)
   - Primera página con contenido significativo después de página en blanco

#### Separación Manual
- Usuario puede agregar separaciones manuales
- Puede marcar/desmarcar separaciones sugeridas
- Vista previa de documentos que se crearán antes de confirmar

## 📚 Referencias

- **Utils**: `src/utils/FileUploadService.js`, `src/utils/MetadataService.js`
- **Componentes**: `BulkUploadDialog.jsx`, `BulkUploadReview.jsx`, `PdfSeparationReview.jsx`, `TextSelectorDialog.jsx`, `VistaPrevia.jsx`
- **Backend**: 
  - `backend/routes/bulkUpload.js` (clasificación masiva)
  - `backend/routes/pdfSeparations.js` (separación de PDFs)
  - `backend/routes/requiredDocuments.js` (análisis de ejemplos)
  - `backend/routes/analyzeFile.js` (OCR y extracción)
  - `backend/services/pdfService.js` (manipulación de PDFs)
- **Documentación relacionada**: `FLUJO_APROBACION_DOCUMENTOS.md`, `SISTEMA_VERSIONES_Y_TIMESTAMPS.md`

---

**Última actualización**: Enero 2025  
**Autor**: Sistema ControlDoc v5  
**Estado**: ✅ Sistema funcional y en producción  
**Versión**: v5.1 (con separación automática de PDFs y metadata guardada)

