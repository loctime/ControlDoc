#!/usr/bin/env node

/**
 * Script para limpiar completamente el cache y hacer un build limpio
 * Resuelve problemas de caché que pueden causar errores de React
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 Limpieza completa del proyecto...\n');

// Función para limpiar directorios
function cleanDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`✅ ${dirPath} eliminado`);
    } catch (error) {
      console.warn(`⚠️ Error eliminando ${dirPath}:`, error.message);
    }
  } else {
    console.log(`ℹ️ ${dirPath} no existe, saltando...`);
  }
}

// Función para limpiar archivos
function cleanFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ ${filePath} eliminado`);
    } catch (error) {
      console.warn(`⚠️ Error eliminando ${filePath}:`, error.message);
    }
  }
}

// Limpiar directorios de cache
const dirsToClean = [
  'node_modules/.cache',
  'dist',
  '.vite',
  '.eslintcache',
  'coverage'
];

console.log('📁 Limpiando directorios de cache...');
dirsToClean.forEach(dir => {
  cleanDirectory(path.join(__dirname, '..', dir));
});

// Limpiar archivos de cache
const filesToClean = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
];

console.log('\n📄 Limpiando archivos de cache...');
filesToClean.forEach(file => {
  cleanFile(path.join(__dirname, '..', file));
});

// Reinstalar dependencias
console.log('\n📦 Reinstalando dependencias...');
try {
  execSync('npm install', { 
    cwd: path.join(__dirname, '..'), 
    stdio: 'inherit' 
  });
  console.log('✅ Dependencias reinstaladas');
} catch (error) {
  console.error('❌ Error reinstalando dependencias:', error.message);
  process.exit(1);
}

// Build limpio
console.log('\n🔨 Haciendo build limpio...');
try {
  execSync('npm run build', { 
    cwd: path.join(__dirname, '..'), 
    stdio: 'inherit' 
  });
  console.log('✅ Build completado exitosamente');
} catch (error) {
  console.error('❌ Error en el build:', error.message);
  process.exit(1);
}

console.log('\n🎉 Limpieza y build completados exitosamente!');
console.log('💡 Si sigues teniendo problemas, intenta:');
console.log('   1. Reiniciar el servidor de desarrollo');
console.log('   2. Limpiar el cache del navegador');
console.log('   3. Verificar que no hay errores en la consola');
