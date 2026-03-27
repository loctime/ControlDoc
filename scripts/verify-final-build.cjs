#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Función para verificar que el build se completó correctamente
function verifyBuild() {
  console.log('🔍 Verificando build final...');
  
  const distPath = path.join(process.cwd(), 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ No se encontró el directorio dist/');
    return false;
  }
  
  // Verificar archivos críticos
  const criticalFiles = [
    'index.html'
  ];
  
  for (const file of criticalFiles) {
    const filePath = path.join(distPath, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Archivo crítico no encontrado: ${file}`);
      return false;
    }
  }
  
  // Verificar que los archivos de React estén presentes
  const assetsPath = path.join(distPath, 'assets');
  if (!fs.existsSync(assetsPath)) {
    console.error('❌ No se encontró el directorio assets/');
    return false;
  }
  
  const assets = fs.readdirSync(assetsPath);
  
  // Buscar el archivo principal de JavaScript (index-*.js)
  const mainJsFile = assets.find(file => 
    file.startsWith('index-') && file.endsWith('.js')
  );
  
  if (!mainJsFile) {
    console.error('❌ No se encontró el archivo principal de JavaScript (index-*.js)');
    return false;
  }
  
  console.log(`✅ Archivo principal encontrado: ${mainJsFile}`);
  
  // Buscar archivos de React
  const reactFiles = assets.filter(file => 
    file.includes('react') || 
    file.includes('index-') && file.endsWith('.js')
  );
  
  if (reactFiles.length === 0) {
    console.error('❌ No se encontraron archivos de React en el build');
    return false;
  }
  
  console.log('✅ Archivos de React encontrados:', reactFiles);
  
  // Verificar que el archivo principal no tenga errores obvios
  const mainJsPath = path.join(distPath, 'assets', mainJsFile);
  if (fs.existsSync(mainJsPath)) {
    const content = fs.readFileSync(mainJsPath, 'utf8');
    
    if (content.includes('useState is not defined')) {
      console.error('❌ Error detectado: useState is not defined');
      return false;
    }
    
    if (content.includes('React is not defined')) {
      console.error('❌ Error detectado: React is not defined');
      return false;
    }
    
    console.log('✅ Archivo principal verificado sin errores obvios');
  }
  
  console.log('✅ Build verificado correctamente');
  return true;
}

// Función principal
function main() {
  const success = verifyBuild();
  
  if (!success) {
    console.error('❌ Verificación del build falló');
    process.exit(1);
  }
  
  console.log('🎉 Build verificado exitosamente');
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { verifyBuild };
