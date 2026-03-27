#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Buscando problemas con setLoading...');

// Función para buscar archivos que contengan setLoading
function findSetLoadingIssues(directory) {
  const issues = [];
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        scanDirectory(filePath);
      } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Buscar patrones problemáticos
          const patterns = [
            {
              name: 'setLoading sin useState',
              regex: /setLoading\(/g,
              check: (content, filePath) => {
                const hasUseState = /const\s*\[\s*loading\s*,\s*setLoading\s*\]\s*=\s*useState/;
                const setLoadingCalls = content.match(/setLoading\(/g) || [];
                const useStateDeclarations = content.match(hasUseState) || [];
                
                if (setLoadingCalls.length > 0 && useStateDeclarations.length === 0) {
                  return {
                    file: filePath,
                    issue: 'setLoading usado sin useState',
                    count: setLoadingCalls.length
                  };
                }
                return null;
              }
            },
            {
              name: 'setLoading en función asíncrona sin contexto',
              regex: /async.*function.*\{[\s\S]*?setLoading\(/g,
              check: (content, filePath) => {
                const asyncFunctions = content.match(/async\s+(?:function\s+\w+\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{[\s\S]*?\}/g) || [];
                
                for (const func of asyncFunctions) {
                  if (func.includes('setLoading(') && !func.includes('useState')) {
                    return {
                      file: filePath,
                      issue: 'setLoading en función async sin contexto de useState',
                      function: func.substring(0, 100) + '...'
                    };
                  }
                }
                return null;
              }
            },
            {
              name: 'setLoading en useEffect sin dependencias',
              regex: /useEffect\s*\([^)]*\)\s*=>\s*\{[\s\S]*?setLoading\(/g,
              check: (content, filePath) => {
                const useEffects = content.match(/useEffect\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}/g) || [];
                
                for (const effect of useEffects) {
                  if (effect.includes('setLoading(') && !effect.includes('setLoading')) {
                    return {
                      file: filePath,
                      issue: 'setLoading en useEffect sin dependencias correctas',
                      effect: effect.substring(0, 100) + '...'
                    };
                  }
                }
                return null;
              }
            }
          ];
          
          for (const pattern of patterns) {
            const issue = pattern.check(content, filePath);
            if (issue) {
              issues.push(issue);
            }
          }
          
        } catch (error) {
          console.warn(`⚠️ Error leyendo archivo ${filePath}:`, error.message);
        }
      }
    }
  }
  
  scanDirectory(directory);
  return issues;
}

// Buscar problemas
const issues = findSetLoadingIssues('src');

console.log('📋 Problemas encontrados:');
if (issues.length === 0) {
  console.log('✅ No se encontraron problemas evidentes con setLoading');
} else {
  issues.forEach((issue, index) => {
    console.log(`${index + 1}. ${issue.file}`);
    console.log(`   Problema: ${issue.issue}`);
    if (issue.count) console.log(`   Cantidad: ${issue.count}`);
    if (issue.function) console.log(`   Función: ${issue.function}`);
    if (issue.effect) console.log(`   useEffect: ${issue.effect}`);
    console.log('');
  });
}

// Crear archivo de diagnóstico
const diagnostic = {
  timestamp: new Date().toISOString(),
  issues: issues,
  recommendations: [
    'Verificar que setLoading esté definido con useState en cada componente',
    'Asegurar que setLoading se use dentro del contexto del hook',
    'Revisar funciones asíncronas que usen setLoading',
    'Verificar dependencias en useEffect que usen setLoading'
  ]
};

fs.writeFileSync(
  'setLoading-diagnostic.json',
  JSON.stringify(diagnostic, null, 2)
);

console.log('📝 Diagnóstico guardado en setLoading-diagnostic.json');

// Crear script de corrección automática
const fixScript = `
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
          /import React(?:,\s*\{[^}]*\})?\s+from\s+['"]react['"]/,
          'import React, { useState } from \'react\''
        );
        modified = true;
      }
      
      // Agregar useState después de la declaración del componente
      const componentMatch = content.match(/export default function (\w+)/);
      if (componentMatch) {
        const componentName = componentMatch[1];
        const componentStart = content.indexOf(\`export default function \${componentName}\`);
        const braceStart = content.indexOf('{', componentStart);
        
        if (braceStart !== -1) {
          const useStateLine = '  const [loading, setLoading] = useState(false);\n';
          content = content.slice(0, braceStart + 1) + '\n' + useStateLine + content.slice(braceStart + 1);
          modified = true;
        }
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(\`✅ Corregido: \${filePath}\`);
    }
    
  } catch (error) {
    console.warn(\`⚠️ Error procesando \${filePath}:\`, error.message);
  }
}

// Ejecutar correcciones
const issues = JSON.parse(fs.readFileSync('setLoading-diagnostic.json', 'utf8'));
issues.issues.forEach(issue => {
  fixSetLoadingIssues(issue.file);
});

console.log('🔧 Correcciones aplicadas');
`;

fs.writeFileSync('scripts/fix-setLoading-auto.cjs', fixScript);

console.log('🔧 Script de corrección automática creado: scripts/fix-setLoading-auto.cjs');
console.log('📋 Para aplicar correcciones automáticas, ejecuta: node scripts/fix-setLoading-auto.cjs');
