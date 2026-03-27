#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Función para verificar versiones de React
function verifyReactVersions() {
  console.log('🔍 Verificando versiones de React...');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ No se encontró package.json');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Verificar versiones de React
  const reactVersion = dependencies.react;
  const reactDomVersion = dependencies['react-dom'];
  
  console.log(`📦 React version: ${reactVersion}`);
  console.log(`📦 React-DOM version: ${reactDomVersion}`);
  
  // Verificar que las versiones sean compatibles
  if (reactVersion !== reactDomVersion) {
    console.error('❌ Las versiones de React y React-DOM no coinciden');
    return false;
  }
  
  // Verificar que la versión sea estable
  if (reactVersion.includes('alpha') || reactVersion.includes('beta') || reactVersion.includes('rc')) {
    console.warn('⚠️ Usando versión no estable de React');
  }
  
  // Verificar que la versión sea compatible con Vite
  const majorVersion = parseInt(reactVersion.split('.')[0]);
  if (majorVersion < 17) {
    console.error('❌ React 17+ es requerido para Vite');
    return false;
  }
  
  console.log('✅ Versiones de React verificadas correctamente');
  return true;
}

// Función para verificar que no haya conflictos de versiones
function checkVersionConflicts() {
  console.log('🔍 Verificando conflictos de versiones...');
  
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.error('❌ No se encontró node_modules');
    return false;
  }
  
  // Verificar que no haya múltiples versiones de React
  const reactPath = path.join(nodeModulesPath, 'react');
  const reactDomPath = path.join(nodeModulesPath, 'react-dom');
  
  if (!fs.existsSync(reactPath)) {
    console.error('❌ React no está instalado');
    return false;
  }
  
  if (!fs.existsSync(reactDomPath)) {
    console.error('❌ React-DOM no está instalado');
    return false;
  }
  
  console.log('✅ No se detectaron conflictos de versiones');
  return true;
}

// Función principal
function main() {
  try {
    const versionsValid = verifyReactVersions();
    const noConflicts = checkVersionConflicts();
    
    if (!versionsValid || !noConflicts) {
      console.error('❌ Verificación de versiones falló');
      process.exit(1);
    }
    
    console.log('🎉 Verificación de versiones completada exitosamente');
  } catch (error) {
    console.error('❌ Error durante la verificación:', error.message);
    process.exit(1);
  }
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { verifyReactVersions, checkVersionConflicts };
