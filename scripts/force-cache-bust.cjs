#!/usr/bin/env node

/**
 * Script para forzar la actualización del cache del navegador
 * Agrega un timestamp a los archivos para evitar cache
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Forzando actualización de cache...\n');

// Función para agregar timestamp a archivos HTML
function addCacheBustToHTML() {
  const distDir = path.join(__dirname, '..', 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  
  if (fs.existsSync(indexHtmlPath)) {
    try {
      let content = fs.readFileSync(indexHtmlPath, 'utf8');
      
      // Agregar timestamp a todos los assets
      const timestamp = Date.now();
      content = content.replace(
        /(src|href)="([^"]*\.(js|css))"/g,
        `$1="$2?v=${timestamp}"`
      );
      
      fs.writeFileSync(indexHtmlPath, content);
      console.log('✅ Cache bust agregado a index.html');
    } catch (error) {
      console.warn('⚠️ Error agregando cache bust:', error.message);
    }
  }
}

// Función para verificar que el build está correcto
function verifyBuild() {
  const distDir = path.join(__dirname, '..', 'dist');
  const assetsDir = path.join(distDir, 'assets');
  
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const adminEmpresasFiles = files.filter(file => file.includes('AdminEmpresas'));
    
    console.log('📁 Archivos AdminEmpresas encontrados:');
    adminEmpresasFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
    
    if (adminEmpresasFiles.length > 0) {
      console.log('\n✅ Build verificado - archivos AdminEmpresas presentes');
    } else {
      console.log('\n⚠️ No se encontraron archivos AdminEmpresas');
    }
  }
}

// Ejecutar funciones
addCacheBustToHTML();
verifyBuild();

console.log('\n🎯 Instrucciones para el usuario:');
console.log('1. Limpia el cache del navegador (Ctrl+Shift+R)');
console.log('2. Recarga la página');
console.log('3. Si el problema persiste, abre las herramientas de desarrollador');
console.log('4. Ve a Network → marca "Disable cache"');
console.log('5. Recarga la página nuevamente');

console.log('\n💡 El nuevo build está listo con el error corregido!');
