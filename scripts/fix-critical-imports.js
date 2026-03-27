import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lista de archivos críticos que necesitan React
const criticalFiles = [
  'src/hooks/useDocumentAlerts.js',
  'src/hooks/useGroupedDocuments.js',
  'src/hooks/useTenantFirestore.js',
  'src/hooks/useTenantReady.js',
  'src/utils/useDocumentEntityTypes.js',
  'src/ForceLogoutOnMount.jsx'
];

function fixCriticalFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ Archivo no encontrado: ${filePath}`);
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Verificar si ya tiene la importación correcta
  if (content.includes('import React')) {
    console.log(`✅ ${filePath} ya tiene React importado`);
    return;
  }
  
  // Agregar React al inicio
  const lines = content.split('\n');
  let newContent;
  
  // Buscar la primera importación
  let importIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      importIndex = i;
      break;
    }
  }
  
  if (importIndex === -1) {
    // No hay importaciones, agregar al inicio
    newContent = `import React from 'react';\n${content}`;
  } else {
    // Agregar React antes de la primera importación
    lines.splice(importIndex, 0, "import React from 'react';");
    newContent = lines.join('\n');
  }
  
  fs.writeFileSync(fullPath, newContent);
  console.log(`🔧 Corregido: ${filePath}`);
}

console.log('🔧 Corrigiendo importaciones críticas de React...');
criticalFiles.forEach(fixCriticalFile);
console.log('✅ Corrección completada');
