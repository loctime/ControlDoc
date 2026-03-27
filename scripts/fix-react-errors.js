#!/usr/bin/env node

/**
 * Script para verificar y arreglar problemas de React #130
 * Busca archivos que usen React.Component o React.useState sin importar React
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verificando problemas de React...\n');

// Función para buscar archivos que usen React sin importarlo
function findReactUsageIssues() {
  const srcDir = path.join(__dirname, '..', 'src');
  const issues = [];

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Buscar uso de React sin importación
        const hasReactUsage = /React\.(Component|useState|useEffect|useContext|useRef|useCallback|useMemo|useReducer|useLayoutEffect|useImperativeHandle|useDebugValue)/.test(content);
        const hasReactImport = /import\s+React/.test(content);
        const hasJsxRuntimeComment = /\/\/ React import removed - using JSX runtime/.test(content);
        
        if (hasReactUsage && !hasReactImport && !hasJsxRuntimeComment) {
          issues.push({
            file: filePath,
            type: 'React usage without import'
          });
        }
      }
    }
  }
  
  scanDirectory(srcDir);
  return issues;
}

// Función para limpiar cache
function cleanCache() {
  console.log('🧹 Limpiando cache...');
  
  try {
    // Limpiar node_modules/.cache si existe
    const cacheDir = path.join(__dirname, '..', 'node_modules', '.cache');
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log('✅ Cache de node_modules limpiado');
    }
    
    // Limpiar dist
    const distDir = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
      console.log('✅ Directorio dist limpiado');
    }
    
    // Limpiar .vite si existe
    const viteDir = path.join(__dirname, '..', '.vite');
    if (fs.existsSync(viteDir)) {
      fs.rmSync(viteDir, { recursive: true, force: true });
      console.log('✅ Cache de Vite limpiado');
    }
    
  } catch (error) {
    console.warn('⚠️ Error limpiando cache:', error.message);
  }
}

// Función para verificar imports de React
function checkReactImports() {
  console.log('📋 Verificando imports de React...\n');
  
  const issues = findReactUsageIssues();
  
  if (issues.length === 0) {
    console.log('✅ No se encontraron problemas de imports de React');
    return true;
  }
  
  console.log(`❌ Se encontraron ${issues.length} problemas:`);
  issues.forEach(issue => {
    console.log(`   - ${path.relative(process.cwd(), issue.file)}: ${issue.type}`);
  });
  
  return false;
}

// Función principal
function main() {
  console.log('🚀 Iniciando verificación de React...\n');
  
  // Limpiar cache
  cleanCache();
  console.log('');
  
  // Verificar imports
  const hasIssues = checkReactImports();
  console.log('');
  
  if (hasIssues) {
    console.log('❌ Se encontraron problemas que necesitan ser corregidos manualmente');
    console.log('💡 Revisa los archivos listados arriba y agrega las importaciones de React necesarias');
    process.exit(1);
  } else {
    console.log('✅ Verificación completada exitosamente');
    console.log('🎉 No se encontraron problemas de React');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = {
  findReactUsageIssues,
  cleanCache,
  checkReactImports
};
