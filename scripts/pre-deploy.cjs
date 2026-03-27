#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando preparación para deploy...');

try {
  // 1. Verificar que estamos en el directorio correcto
  if (!fs.existsSync('package.json')) {
    throw new Error('No se encontró package.json en el directorio actual');
  }

  // 2. Limpiar directorio dist si existe
  console.log('🧹 Limpiando directorio dist...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  // 3. Instalar dependencias (solo si no están instaladas)
  // Vercel ya instala las dependencias antes de ejecutar este script
  if (!fs.existsSync('node_modules')) {
    console.log('📦 Instalando dependencias...');
    execSync('npm install', { stdio: 'inherit' });
  } else {
    console.log('✅ Dependencias ya instaladas, omitiendo instalación...');
  }

  // 4. Copiar el worker de PDF
  console.log('📄 Copiando PDF worker...');
  if (fs.existsSync('scripts/copyPdfWorker.js')) {
    execSync('node scripts/copyPdfWorker.js', { stdio: 'inherit' });
  }

  // 5. Verificar y corregir importaciones de React
  console.log('🔧 Verificando importaciones de React...');
  if (fs.existsSync('scripts/fix-react-imports.cjs')) {
    execSync('node scripts/fix-react-imports.cjs', { stdio: 'inherit' });
  }

  // 6. Construir la aplicación con configuración específica para Vercel
  console.log('🔨 Construyendo aplicación...');
  execSync('npm run build:vercel', { stdio: 'inherit' });

  // 7. Verificar que el build se completó correctamente
  if (!fs.existsSync('dist/index.html')) {
    throw new Error('El build no generó el archivo index.html');
  }

  // 8. Verificar que los archivos de Emotion estén presentes
  const distFiles = fs.readdirSync('dist/assets');
  const emotionFiles = distFiles.filter(file => file.includes('emotion'));
  
  if (emotionFiles.length === 0) {
    console.warn('⚠️ No se encontraron archivos de Emotion en el build');
  } else {
    console.log('✅ Archivos de Emotion encontrados:', emotionFiles);
  }

  // 9. Verificación final del build
  console.log('🔍 Verificación final del build...');
  if (fs.existsSync('scripts/verify-final-build.cjs')) {
    execSync('node scripts/verify-final-build.cjs', { stdio: 'inherit' });
  }

  console.log('✅ Preparación para deploy completada exitosamente');
  
} catch (error) {
  console.error('❌ Error durante la preparación para deploy:', error.message);
  process.exit(1);
}
