import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cleanDuplicateImports(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      cleanDuplicateImports(fullPath);
    } else if (file.name.endsWith('.jsx') || file.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      let modified = false;
      
      // Buscar líneas con importación duplicada de React
      const newLines = [];
      let hasReactImport = false;
      let reactHooks = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Detectar importación de React
        if (line.includes('import React')) {
          if (hasReactImport) {
            // Ya hay una importación de React, saltar esta línea
            modified = true;
            continue;
          }
          hasReactImport = true;
          
          // Extraer hooks de React si están en la misma línea
          if (line.includes('{') && line.includes('}')) {
            const match = line.match(/\{([^}]+)\}/);
            if (match) {
              const hooks = match[1].split(',').map(h => h.trim());
              reactHooks.push(...hooks.filter(h => h !== 'React'));
            }
          }
          
          newLines.push(line);
        } else if (line.includes('import {') && line.includes('React') && line.includes('}')) {
          // Importación con destructuring que incluye React
          if (hasReactImport) {
            // Ya hay una importación de React, extraer solo los hooks
            const match = line.match(/\{([^}]+)\}/);
            if (match) {
              const hooks = match[1].split(',').map(h => h.trim());
              reactHooks.push(...hooks.filter(h => h !== 'React'));
            }
            modified = true;
            continue;
          }
          hasReactImport = true;
          newLines.push(line);
        } else {
          newLines.push(line);
        }
      }
      
      // Si se modificó el archivo, escribirlo
      if (modified) {
        const newContent = newLines.join('\n');
        fs.writeFileSync(fullPath, newContent);
        console.log(`🔧 Limpiado: ${fullPath}`);
      }
    }
  }
}

console.log('🧹 Limpiando importaciones duplicadas de React...');
cleanDuplicateImports(path.join(__dirname, '..', 'src'));
console.log('✅ Limpieza completada');
