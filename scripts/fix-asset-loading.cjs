#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Solucionando problema de carga de assets...');

try {
  // 1. Limpiar directorio dist
  console.log('🧹 Limpiando directorio dist...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  // 2. Limpiar caché de node_modules
  console.log('🧹 Limpiando caché de node_modules...');
  if (fs.existsSync('node_modules/.vite')) {
    fs.rmSync('node_modules/.vite', { recursive: true, force: true });
  }

  // 3. Reinstalar dependencias
  console.log('📦 Reinstalando dependencias...');
  execSync('npm install', { stdio: 'inherit' });

  // 4. Copiar PDF worker
  console.log('📄 Copiando PDF worker...');
  if (fs.existsSync('scripts/copyPdfWorker.js')) {
    execSync('node scripts/copyPdfWorker.js', { stdio: 'inherit' });
  }

  // 5. Construir con configuración específica para Vercel
  console.log('🔨 Construyendo aplicación...');
  execSync('npm run build:vercel', { stdio: 'inherit' });

  // 6. Verificar que los archivos críticos existen
  console.log('🔍 Verificando archivos críticos...');
  const criticalFiles = [
    'UsuarioDashboard',
    'TourVirtual', 
    'useDocumentEntityTypes'
  ];

  const assetsDir = path.join('dist', 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    
    criticalFiles.forEach(fileName => {
      const matchingFiles = files.filter(file => file.includes(fileName));
      if (matchingFiles.length > 0) {
        console.log(`✅ ${fileName}: ${matchingFiles.join(', ')}`);
      } else {
        console.warn(`⚠️ No se encontró archivo para ${fileName}`);
      }
    });
  }

  // 7. Crear archivo de verificación de assets
  console.log('📝 Creando archivo de verificación de assets...');
  const assetsVerification = {
    timestamp: new Date().toISOString(),
    assets: fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [],
    criticalFiles: criticalFiles.map(fileName => {
      const files = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
      return {
        name: fileName,
        found: files.filter(file => file.includes(fileName))
      };
    })
  };

  fs.writeFileSync(
    'dist/assets-verification.json', 
    JSON.stringify(assetsVerification, null, 2)
  );

  // 8. Generar archivo de limpieza de caché
  console.log('🧹 Generando archivo de limpieza de caché...');
  if (fs.existsSync('scripts/clear-browser-cache.cjs')) {
    execSync('node scripts/clear-browser-cache.cjs', { stdio: 'inherit' });
  }

  console.log('✅ Problema de assets solucionado exitosamente');
  console.log('📋 Resumen de assets generados:');
  console.log(JSON.stringify(assetsVerification, null, 2));
  console.log('');
  console.log('🚀 Próximos pasos:');
  console.log('1. Sube todos los archivos de la carpeta dist al servidor');
  console.log('2. Accede a: https://tu-dominio.com/cache-clear.html');
  console.log('3. Sigue las instrucciones para limpiar el caché del navegador');
  console.log('4. Recarga la aplicación principal');

} catch (error) {
  console.error('❌ Error durante la solución:', error.message);
  process.exit(1);
}
