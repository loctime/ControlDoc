#!/usr/bin/env node

import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Script para forzar una recarga completa del navegador
 * Elimina caché y fuerza la descarga de nuevos assets
 */

console.log('🔄 Forzando recarga completa del navegador...');

// 1. Crear un archivo de timestamp para forzar cache busting
const timestamp = Date.now();
const cacheBusterPath = resolve(process.cwd(), 'src/cache-buster.js');
const cacheBusterContent = `// Cache buster - generado automáticamente
// Timestamp: ${timestamp}
console.log('🔄 Cache buster activado:', ${timestamp});

// Forzar recarga de Emotion
if (typeof window !== 'undefined') {
  // Limpiar caché de Emotion
  if (window.__EMOTION_CACHE__) {
    window.__EMOTION_CACHE__.registered = {};
    window.__EMOTION_CACHE__.inserted = {};
  }
  
  // Limpiar estilos existentes
  const emotionStyles = document.querySelectorAll('[data-emotion]');
  emotionStyles.forEach(style => {
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  });
  
  console.log('🧹 Caché de Emotion limpiado');
}`;

writeFileSync(cacheBusterPath, cacheBusterContent);
console.log('✅ Cache buster creado');

// 2. Actualizar main.jsx para incluir el cache buster
const mainJsxPath = resolve(process.cwd(), 'src/main.jsx');
let mainJsx = readFileSync(mainJsxPath, 'utf8');

// Asegurar que el cache buster se cargue primero
const cacheBusterImport = "import './cache-buster'; // Cache buster\n";
if (!mainJsx.includes('cache-buster')) {
  // Insertar al principio
  const firstLine = mainJsx.indexOf("import");
  if (firstLine !== -1) {
    mainJsx = cacheBusterImport + mainJsx;
    writeFileSync(mainJsxPath, mainJsx);
    console.log('✅ Cache buster agregado a main.jsx');
  }
} else {
  console.log('✅ Cache buster ya está en main.jsx');
}

// 3. Crear archivo de instrucciones para el usuario
const instructionsPath = resolve(process.cwd(), 'BROWSER_REFRESH_INSTRUCTIONS.md');
const instructions = `# 🔄 Instrucciones para Recarga Completa del Navegador

## 🚨 IMPORTANTE: Si aún ves el error "styled_default is not a function"

### Paso 1: Hard Refresh
1. Abre las **Herramientas de Desarrollador** (F12)
2. Haz **clic derecho** en el botón de recarga
3. Selecciona **"Vaciar caché y recargar forzadamente"** o **"Empty Cache and Hard Reload"**

### Paso 2: Limpiar Caché del Navegador
1. Ve a **Configuración del navegador**
2. Busca **"Limpiar datos de navegación"**
3. Selecciona **"Imágenes y archivos en caché"**
4. Haz clic en **"Limpiar datos"**

### Paso 3: Modo Incógnito
1. Abre una **ventana de incógnito/privada**
2. Ve a http://localhost:5173/
3. Verifica si el error persiste

### Paso 4: Verificar Consola
1. Abre **Herramientas de Desarrollador** (F12)
2. Ve a la pestaña **Console**
3. Busca el mensaje: **"Cache buster activado"**
4. Si no aparece, el archivo no se está cargando

## 🔧 Si el error persiste:

1. **Reinicia el servidor:**
   \`\`\`bash
   npm run dev
   \`\`\`

2. **Verifica que los archivos existan:**
   \`\`\`bash
   node scripts/verify-emotion-fix.js
   \`\`\`

3. **Ejecuta la solución agresiva nuevamente:**
   \`\`\`bash
   node scripts/fix-emotion-aggressive.js
   \`\`\`

## ✅ Indicadores de éxito:
- ✅ Mensaje "Cache buster activado" en consola
- ✅ Mensaje "Polyfill de Emotion cargado" en consola
- ✅ No hay errores "styled_default is not a function"
- ✅ La aplicación carga correctamente

## 🆘 Si nada funciona:
El error puede ser causado por:
1. **Conflicto de versiones** de Emotion
2. **Caché persistente** del navegador
3. **Problema de red** o proxy
4. **Extensiones del navegador** que interfieren

**Solución final:** Prueba en un navegador completamente diferente (Chrome, Firefox, Edge)
`;

writeFileSync(instructionsPath, instructions);
console.log('✅ Instrucciones creadas en BROWSER_REFRESH_INSTRUCTIONS.md');

console.log('\n🎯 RESUMEN:');
console.log('✅ Cache buster creado y activado');
console.log('✅ Instrucciones de recarga guardadas');
console.log('💡 Sigue las instrucciones en BROWSER_REFRESH_INSTRUCTIONS.md');
console.log('🔄 Haz un HARD REFRESH en tu navegador (Ctrl+Shift+R o F12 > Hard Reload)');
