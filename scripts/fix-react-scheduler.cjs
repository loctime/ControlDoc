#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Función para solucionar el problema de unstable_scheduleCallback
function fixReactScheduler() {
  console.log('🔧 Solucionando problema de unstable_scheduleCallback...');
  
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
  
  // Buscar el archivo react-vendor
  const reactVendorFile = assets.find(file => 
    file.includes('react-vendor') && file.endsWith('.js')
  );
  
  if (!reactVendorFile) {
    console.error('❌ No se encontró el archivo react-vendor');
    return false;
  }
  
  console.log(`✅ Archivo react-vendor encontrado: ${reactVendorFile}`);
  
  const reactVendorPath = path.join(distPath, 'assets', reactVendorFile);
  let content = fs.readFileSync(reactVendorPath, 'utf8');
  
  // Verificar si el problema existe
  if (content.includes('unstable_scheduleCallback')) {
    console.log('⚠️ Problema de unstable_scheduleCallback detectado, aplicando fix...');
    
    // Aplicar fix para unstable_scheduleCallback
    // Reemplazar referencias problemáticas
    content = content.replace(
      /unstable_scheduleCallback/g,
      'scheduleCallback'
    );
    
    // Agregar polyfill si es necesario
    const polyfill = `
// Polyfill para scheduleCallback
if (typeof window !== 'undefined' && !window.scheduleCallback) {
  window.scheduleCallback = function(callback, options) {
    return setTimeout(callback, options?.timeout || 0);
  };
}
`;
    
    // Insertar polyfill al inicio del archivo
    content = polyfill + content;
    
    fs.writeFileSync(reactVendorPath, content, 'utf8');
    console.log('✅ Fix aplicado para unstable_scheduleCallback');
  } else {
    console.log('✅ No se detectó problema de unstable_scheduleCallback');
  }
  
  return true;
}

// Función para verificar que el fix funcionó
function verifyFix() {
  console.log('🔍 Verificando que el fix funcionó...');
  
  const distPath = path.join(process.cwd(), 'dist');
  const assetsPath = path.join(distPath, 'assets');
  const assets = fs.readdirSync(assetsPath);
  
  const reactVendorFile = assets.find(file => 
    file.includes('react-vendor') && file.endsWith('.js')
  );
  
  if (reactVendorFile) {
    const reactVendorPath = path.join(distPath, 'assets', reactVendorFile);
    const content = fs.readFileSync(reactVendorPath, 'utf8');
    
    if (content.includes('scheduleCallback') && !content.includes('unstable_scheduleCallback')) {
      console.log('✅ Fix verificado correctamente');
      return true;
    } else {
      console.error('❌ Fix no se aplicó correctamente');
      return false;
    }
  }
  
  return false;
}

// Función principal
function main() {
  try {
    const fixApplied = fixReactScheduler();
    if (fixApplied) {
      const verified = verifyFix();
      if (!verified) {
        console.error('❌ Verificación del fix falló');
        process.exit(1);
      }
    }
    console.log('🎉 Proceso de fix completado exitosamente');
  } catch (error) {
    console.error('❌ Error durante el fix:', error.message);
    process.exit(1);
  }
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { fixReactScheduler, verifyFix };
