#!/usr/bin/env node

// Script de build específico para Vercel
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando build para Vercel...');

try {
  // Usar el script de preparación completo
  if (fs.existsSync('scripts/pre-deploy.cjs')) {
    console.log('📋 Ejecutando script de preparación completo...');
    execSync('node scripts/pre-deploy.cjs', { stdio: 'inherit' });
  } else {
    // Fallback al proceso original si no existe el script de preparación
    console.log('⚠️ Script de preparación no encontrado, usando proceso original...');
    
    // Verificar que estamos en el directorio correcto
    if (!fs.existsSync('package.json')) {
      throw new Error('No se encontró package.json en el directorio actual');
    }

    // Instalar dependencias (solo si no están instaladas)
    // Vercel ya instala las dependencias antes de ejecutar este script
    if (!fs.existsSync('node_modules')) {
      console.log('📦 Instalando dependencias...');
      execSync('npm install', { stdio: 'inherit' });
    } else {
      console.log('✅ Dependencias ya instaladas, omitiendo instalación...');
    }
    
    // Verificar versiones de React
    console.log('🔍 Verificando versiones de React...');
    if (fs.existsSync('scripts/verify-react-versions.cjs')) {
      execSync('node scripts/verify-react-versions.cjs', { stdio: 'inherit' });
    }

    // Copiar el worker de PDF si es necesario
    console.log('📄 Copiando PDF worker...');
    if (fs.existsSync('scripts/copyPdfWorker.js')) {
      execSync('node scripts/copyPdfWorker.js', { stdio: 'inherit' });
    }

    // Verificar y corregir importaciones de React
    console.log('🔧 Verificando importaciones de React...');
    if (fs.existsSync('scripts/fix-react-imports.cjs')) {
      execSync('node scripts/fix-react-imports.cjs', { stdio: 'inherit' });
    }
    
    // Corregir componentes lazy
    console.log('🔧 Corrigiendo componentes lazy...');
    if (fs.existsSync('scripts/fix-lazy-components.cjs')) {
      execSync('node scripts/fix-lazy-components.cjs', { stdio: 'inherit' });
    }

    // Construir la aplicación con configuración específica para Vercel
    console.log('🔨 Construyendo aplicación...');
    execSync('npm run build:vercel', { stdio: 'inherit' });

    // Verificar que el build se completó correctamente
    if (!fs.existsSync('dist/index.html')) {
      throw new Error('El build no generó el archivo index.html');
    }

    // Verificar que los archivos de Emotion estén presentes
    const distFiles = fs.readdirSync('dist/assets');
    const emotionFiles = distFiles.filter(file => file.includes('emotion'));
    
    if (emotionFiles.length === 0) {
      console.warn('⚠️ No se encontraron archivos de Emotion en el build');
    } else {
      console.log('✅ Archivos de Emotion encontrados:', emotionFiles);
    }

    // Verificación final del build
    console.log('🔍 Verificación final del build...');
    if (fs.existsSync('scripts/verify-final-build.cjs')) {
      execSync('node scripts/verify-final-build.cjs', { stdio: 'inherit' });
    }
    
    // Verificación específica de React
    console.log('🔍 Verificación de React...');
    if (fs.existsSync('scripts/verify-react-build.cjs')) {
      execSync('node scripts/verify-react-build.cjs', { stdio: 'inherit' });
    }
    
    // Verificación de componentes lazy
    console.log('🔍 Verificación de componentes lazy...');
    if (fs.existsSync('scripts/verify-lazy-imports.cjs')) {
      execSync('node scripts/verify-lazy-imports.cjs', { stdio: 'inherit' });
    }
    
    // Fix para unstable_scheduleCallback
    console.log('🔧 Aplicando fix para unstable_scheduleCallback...');
    if (fs.existsSync('scripts/fix-react-scheduler.cjs')) {
      execSync('node scripts/fix-react-scheduler.cjs', { stdio: 'inherit' });
    }
  }

  console.log('✅ Build completado exitosamente');
  
} catch (error) {
  console.error('❌ Error durante el build:', error.message);
  process.exit(1);
}
