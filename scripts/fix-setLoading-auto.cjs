
#!/usr/bin/env node

// Script para corregir problemas comunes con setLoading
const fs = require('fs');
const path = require('path');

function fixSetLoadingIssues(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Patrón 1: Agregar useState si falta
    if (content.includes('setLoading(') && !content.includes('const [loading, setLoading] = useState')) {
      // Buscar imports de React
      if (content.includes('import React') && !content.includes('useState')) {
        content = content.replace(
          /import React(?:,s*{[^}]*})?s+froms+['"]react['"]/,
          'import React, { useState } from 'react''
        );
        modified = true;
      }
      
      // Agregar useState después de la declaración del componente
      const componentMatch = content.match(/export default function (w+)/);
      if (componentMatch) {
        const componentName = componentMatch[1];
        const componentStart = content.indexOf(`export default function ${componentName}`);
        const braceStart = content.indexOf('{', componentStart);
        
        if (braceStart !== -1) {
          const useStateLine = '  const [loading, setLoading] = useState(false);
';
          content = content.slice(0, braceStart + 1) + '
' + useStateLine + content.slice(braceStart + 1);
          modified = true;
        }
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Corregido: ${filePath}`);
    }
    
  } catch (error) {
    console.warn(`⚠️ Error procesando ${filePath}:`, error.message);
  }
}

// Ejecutar correcciones
const issues = JSON.parse(fs.readFileSync('setLoading-diagnostic.json', 'utf8'));
issues.issues.forEach(issue => {
  fixSetLoadingIssues(issue.file);
});

console.log('🔧 Correcciones aplicadas');
