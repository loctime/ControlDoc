#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Función para verificar que React esté disponible en el build
function verifyReactBuild() {
  console.log('🔍 Verificando disponibilidad de React en el build...');
  
  const distPath = path.join(process.cwd(), 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ No se encontró el directorio dist/');
    return false;
  }
  
  const assetsPath = path.join(distPath, 'assets');
  if (!fs.existsSync(assetsPath)) {
    console.error('❌ No se encontró el directorio assets/');
    return false;
  }
  
  const assets = fs.readdirSync(assetsPath);
  
  // Buscar el archivo principal de JavaScript
  const mainJsFile = assets.find(file => 
    file.startsWith('index-') && file.endsWith('.js')
  );
  
  if (!mainJsFile) {
    console.error('❌ No se encontró el archivo principal de JavaScript');
    return false;
  }
  
  console.log(`✅ Archivo principal encontrado: ${mainJsFile}`);
  
  // Verificar que el archivo principal contenga React
  const mainJsPath = path.join(distPath, 'assets', mainJsFile);
  const content = fs.readFileSync(mainJsPath, 'utf8');
  
  // Verificar que React esté disponible
  if (!content.includes('React') && !content.includes('react')) {
    console.error('❌ React no está disponible en el archivo principal');
    return false;
  }
  
  // Verificar que useState esté disponible
  if (!content.includes('useState')) {
    console.error('❌ useState no está disponible en el archivo principal');
    return false;
  }
  
  // Verificar que el archivo de React vendor esté presente
  const reactVendorFile = assets.find(file => 
    file.includes('react-vendor') && file.endsWith('.js')
  );
  
  if (!reactVendorFile) {
    console.error('❌ No se encontró el archivo react-vendor');
    return false;
  }
  
  console.log(`✅ Archivo react-vendor encontrado: ${reactVendorFile}`);
  
  // Verificar el contenido del archivo react-vendor
  const reactVendorPath = path.join(distPath, 'assets', reactVendorFile);
  const reactVendorContent = fs.readFileSync(reactVendorPath, 'utf8');
  
  if (!reactVendorContent.includes('useState')) {
    console.error('❌ useState no está disponible en react-vendor');
    return false;
  }
  
  console.log('✅ React está disponible correctamente en el build');
  return true;
}

// Función principal
function main() {
  const success = verifyReactBuild();
  
  if (!success) {
    console.error('❌ Verificación de React falló');
    process.exit(1);
  }
  
  console.log('🎉 Verificación de React completada exitosamente');
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { verifyReactBuild };
