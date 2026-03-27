# 💥 iHatePDF - Herramientas PDF

## 📋 Descripción

**iHatePDF** es un sistema integrado de manipulación de archivos PDF que permite dividir documentos de manera inteligente y eficiente. Inspirado en herramientas como iLovePDF, pero con un enfoque más directo y funcional.

## 🚀 Características

### ✅ **Funcionalidades Implementadas**

#### 1. **Dividir PDF** 📄
- **Descripción**: Crea un PDF único con las páginas seleccionadas
- **Uso**: Selecciona páginas específicas y obtén un documento con solo esas páginas
- **Archivo resultado**: `documento_pagina_1-3-5.pdf`

#### 2. **Descargar Todos Separados** 📦
- **Descripción**: Divide el PDF completo en páginas individuales
- **Uso**: Descarga cada página como un PDF separado en un archivo ZIP
- **Archivo resultado**: `documento_todas_las_paginas.zip`
- **Contenido**: `documento_pagina_1.pdf`, `documento_pagina_2.pdf`, etc.

#### 3. **Descargar Seleccionados por Separado** 🎯
- **Descripción**: Descarga solo las páginas seleccionadas como PDFs individuales
- **Uso**: Selecciona páginas específicas y obtén cada una como archivo separado
- **Archivo resultado**: `documento_paginas_1-3-5.zip`
- **Contenido**: `documento_pagina_1.pdf`, `documento_pagina_3.pdf`, `documento_pagina_5.pdf`

### 🔮 **Funcionalidades Planificadas**
- **Comprimir PDF** - Reducir tamaño de archivos
- **Unir PDFs** - Combinar múltiples archivos
- **Convertir** - PDF a Word, Excel, imágenes
- **Proteger/Desproteger** - Añadir/quitar contraseñas
- **Rotar páginas** - Girar páginas del documento

## 🛠️ Arquitectura Técnica

### **Frontend** (React + Material-UI)
- **Ubicación**: `src/entidad/adm/Library/DocumentLibraryPage.jsx`
- **Componentes**:
  - Modal interactivo con vista previa de páginas
  - Sistema de selección visual (click en páginas)
  - Botones de selección rápida por rangos
  - Estados de carga y manejo de errores

### **Backend** (Node.js + Express)
- **Ubicación**: `backend/routes/ihatepdf.js`
- **Endpoints**:
  - `POST /api/ihatepdf/split` - Dividir PDF con páginas seleccionadas
  - `POST /api/ihatepdf/split-all` - Dividir PDF completo en páginas individuales
  - `POST /api/ihatepdf/split-selected` - Dividir páginas seleccionadas en archivos individuales

### **Librerías Utilizadas**
- **pdf-lib**: Manipulación de PDFs
- **pdfjs-dist**: Vista previa de páginas
- **jszip**: Creación de archivos ZIP
- **axios**: Descarga de archivos remotos

## 📱 Interfaz de Usuario

### **Acceso**
1. Navega a la **Biblioteca de Documentos**
2. Busca cualquier documento PDF
3. Haz click en el botón **💥 iHatePDF** (ícono rojo de PDF)

### **Modal de Herramientas**
```
💥 iHatePDF - Herramientas PDF
Documento: nombre_del_archivo.pdf
Total de páginas: 15

┌─ Seleccionar páginas ─────────────────┐
│ [Páginas 1-5] [Páginas 6-10] [Todas]  │
│ [Limpiar selección]                    │
│                                        │
│ Páginas seleccionadas: 3               │
│ [Página 1] [Página 3] [Página 5]      │
└────────────────────────────────────────┘

┌─ Vista previa de páginas ─────────────┐
│ [Página 1] [Página 2] [Página 3]      │
│ [Página 4] [Página 5] [Página 6]      │
│ ...                                   │
└────────────────────────────────────────┘

[Cancelar] [Descargar todos separados] [Descargar seleccionados por separado] [Dividir PDF]
```

### **Controles de Selección**
- **Selección individual**: Click en cualquier página
- **Selección por rangos**: Botones predefinidos (1-5, 6-10, todas)
- **Indicadores visuales**: Bordes y checkboxes para páginas seleccionadas
- **Chips de resumen**: Muestra páginas seleccionadas con opción de eliminar

## 🔧 Configuración y Requisitos

### **Dependencias del Frontend**
```json
{
  "pdf-lib": "^1.12.1",
  "pdfjs-dist": "^5.3.31"
}
```

### **Dependencias del Backend**
```json
{
  "pdf-lib": "^1.12.1",
  "jszip": "^3.10.1",
  "axios": "^1.9.0"
}
```

### **Variables de Entorno**
No se requieren variables adicionales. Utiliza la configuración existente de Firebase y Backblaze.

## 📊 Límites y Restricciones

### **Límites de Páginas**
- **Máximo 50 páginas** por operación de división
- **Vista previa limitada** a las primeras 10 páginas
- **Sin límite** para descarga de todas las páginas

### **Límites de Tamaño**
- **PDFs hasta 50MB** recomendados
- **Timeout de 30 segundos** para descarga de archivos
- **Procesamiento en memoria** - no ocupa espacio en disco

### **Autenticación**
- **Requiere autenticación** Firebase
- **Todos los roles** pueden usar la funcionalidad
- **Validación de permisos** en cada endpoint

## 🔍 Debugging y Logs

### **Logs del Frontend**
```javascript
// En la consola del navegador
✅ PDF recibido del backend: 185236 bytes, tipo: application/pdf
🔍 Header del PDF recibido: "%PDF" (bytes: [37, 80, 68, 70])
✅ PDF válido generado: 185236 bytes
```

### **Logs del Backend**
```javascript
// En la consola del servidor
--- Nueva solicitud de división de PDF ---
✅ PDF dividido generado: 17115 bytes
✅ Header PDF válido: %PDF
✅ PDF dividido enviado exitosamente
```

## 🚨 Manejo de Errores

### **Errores Comunes**
1. **PDF corrupto o inválido**
   - Error: "El archivo no es un PDF válido o está corrupto"
   - Solución: Verificar que el archivo sea un PDF válido

2. **Páginas no encontradas**
   - Error: "Las siguientes páginas no existen en el PDF"
   - Solución: Verificar que las páginas seleccionadas existan

3. **Timeout de descarga**
   - Error: "Timeout: El archivo PDF es demasiado grande"
   - Solución: Intentar con un archivo más pequeño

4. **Sin permisos**
   - Error: "No tienes permisos para acceder al archivo PDF original"
   - Solución: Verificar permisos de Firebase

## 🧪 Casos de Uso

### **Caso 1: Extraer páginas específicas**
```
Situación: Necesitas solo las páginas 3, 7 y 12 de un documento
Solución: 
1. Selecciona páginas 3, 7 y 12
2. Click en "Dividir PDF"
3. Obtienes: documento_pagina_3-7-12.pdf
```

### **Caso 2: Dividir documento grande**
```
Situación: Tienes un PDF de 50 páginas y quieres cada página separada
Solución:
1. Click en "Descargar todos separados"
2. Obtienes: documento_todas_las_paginas.zip
3. Contiene: documento_pagina_1.pdf hasta documento_pagina_50.pdf
```

### **Caso 3: Páginas específicas como archivos individuales**
```
Situación: Quieres las páginas 2, 5, 8 como archivos separados
Solución:
1. Selecciona páginas 2, 5, 8
2. Click en "Descargar seleccionados por separado"
3. Obtienes: documento_paginas_2-5-8.zip
4. Contiene: documento_pagina_2.pdf, documento_pagina_5.pdf, documento_pagina_8.pdf
```

## 🔮 Roadmap Futuro

### **Versión 2.0** (Próximas funcionalidades)
- [ ] **Comprimir PDF** - Reducir tamaño manteniendo calidad
- [ ] **Unir PDFs** - Combinar múltiples documentos
- [ ] **Convertir PDF** - A Word, Excel, PowerPoint, imágenes
- [ ] **Proteger PDF** - Añadir/quitar contraseñas
- [ ] **Rotar páginas** - Girar páginas individuales o múltiples
- [ ] **Eliminar páginas** - Quitar páginas específicas
- [ ] **Añadir marca de agua** - Texto o imagen en todas las páginas

### **Mejoras Técnicas**
- [ ] **Caché de PDFs** - Mejorar rendimiento para archivos grandes
- [ ] **Procesamiento en background** - Para operaciones muy pesadas
- [ ] **Historial de operaciones** - Guardar últimas operaciones
- [ ] **Plantillas de división** - Guardar configuraciones frecuentes

## 🤝 Contribución

### **Cómo agregar nuevas herramientas**
1. **Backend**: Agregar endpoint en `backend/routes/ihatepdf.js`
2. **Frontend**: Agregar botón y función en `DocumentLibraryPage.jsx`
3. **Validación**: Agregar validaciones y manejo de errores
4. **Testing**: Probar con diferentes tipos de PDFs

### **Estructura de código**
```
backend/routes/ihatepdf.js
├── POST /split          # Dividir páginas seleccionadas
├── POST /split-all      # Dividir todas las páginas
├── POST /split-selected # Dividir páginas seleccionadas por separado
└── [FUTURO] /compress   # Comprimir PDF
    [FUTURO] /merge      # Unir PDFs
    [FUTURO] /convert    # Convertir formato
```

## 📞 Soporte

### **Problemas Comunes**
- **PDF no se descarga**: Verificar logs del navegador y servidor
- **Error de autenticación**: Verificar token de Firebase
- **Páginas no se muestran**: Verificar que el PDF sea accesible

### **Logs de Debug**
- **Frontend**: Abrir DevTools → Console
- **Backend**: Verificar consola del servidor Node.js

---

**💥 iHatePDF** - Porque a veces necesitas dividir PDFs, no amarlos. 😄
