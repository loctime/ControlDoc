#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patrones de importación a corregir
const patterns = [
  {
    from: /import React, \{ (useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer|useLayoutEffect|useImperativeHandle|useDebugValue|useDeferredValue|useTransition|useId|useSyncExternalStore|useInsertionEffect) \} from ['"]react['"];?/g,
    to: (match, hook) => `import { ${hook} } from 'react';`
  },
  {
    from: /import React, \{ (useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer|useLayoutEffect|useImperativeHandle|useDebugValue|useDeferredValue|useTransition|useId|useSyncExternalStore|useInsertionEffect) \} from [""]react[""];?/g,
    to: (match, hook) => `import { ${hook} } from "react";`
  },
  {
    from: /import React from ['"]react['"];?/g,
    to: '// React import removed - using JSX runtime'
  },
  {
    from: /import React from [""]react[""];?/g,
    to: '// React import removed - using JSX runtime'
  }
];

// Función para procesar un archivo
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    patterns.forEach(pattern => {
      const newContent = content.replace(pattern.from, pattern.to);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Corregido: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    return false;
  }
}

// Función principal
function main() {
  console.log('🔧 Iniciando corrección de importaciones de React...');
  
  // Buscar todos los archivos JSX
  const jsxFiles = glob.sync('src/**/*.jsx', { absolute: true });
  
  let totalFiles = 0;
  let modifiedFiles = 0;
  
  jsxFiles.forEach(file => {
    totalFiles++;
    if (processFile(file)) {
      modifiedFiles++;
    }
  });
  
  console.log(`\n📊 Resumen:`);
  console.log(`   Archivos procesados: ${totalFiles}`);
  console.log(`   Archivos modificados: ${modifiedFiles}`);
  console.log(`\n✅ Corrección completada!`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { processFile, patterns };
