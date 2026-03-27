#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de Vite...');

try {
  // Verificar archivo de configuración principal
  const viteConfigPath = 'vite.config.js';
  const viteConfigVercelPath = 'vite.config.vercel.js';
  
  if (!fs.existsSync(viteConfigPath)) {
    throw new Error('No se encontró vite.config.js');
  }
  
  if (!fs.existsSync(viteConfigVercelPath)) {
    throw new Error('No se encontró vite.config.vercel.js');
  }

  console.log('✅ Archivos de configuración encontrados');

  // Verificar que la configuración de Vercel tenga la configuración correcta para assets
  const vercelConfig = fs.readFileSync(viteConfigVercelPath, 'utf8');
  
  // Verificar configuraciones importantes
  const checks = [
    {
      name: 'manualChunks configurado',
      pattern: /manualChunks:/,
      required: true
    },
    {
      name: 'sourcemap deshabilitado',
      pattern: /sourcemap:\s*false/,
      required: true
    },
    {
      name: 'minify configurado',
      pattern: /minify:\s*['"]esbuild['"]/,
      required: true
    },
    {
      name: 'commonjsOptions configurado',
      pattern: /commonjsOptions:/,
      required: true
    }
  ];

  console.log('🔍 Verificando configuraciones críticas...');
  
  checks.forEach(check => {
    const found = check.pattern.test(vercelConfig);
    if (found === check.required) {
      console.log(`✅ ${check.name}`);
    } else {
      console.warn(`⚠️ ${check.name} - ${check.required ? 'Faltante' : 'Presente pero no requerido'}`);
    }
  });

  // Verificar package.json
  const packageJsonPath = 'package.json';
  let packageJson = null;
  if (fs.existsSync(packageJsonPath)) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    console.log('📦 Verificando dependencias...');
    
    // Verificar versiones críticas
    const criticalDeps = ['react', 'react-dom', 'vite', '@vitejs/plugin-react'];
    criticalDeps.forEach(dep => {
      if (packageJson.dependencies && packageJson.dependencies[dep]) {
        console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
      } else if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
        console.log(`✅ ${dep}: ${packageJson.devDependencies[dep]} (dev)`);
      } else {
        console.warn(`⚠️ ${dep}: No encontrado`);
      }
    });
  }

  // Verificar scripts de build
  console.log('🔧 Verificando scripts de build...');
  const scripts = ['build', 'build:vercel', 'fix-assets'];
  scripts.forEach(script => {
    if (packageJson && packageJson.scripts && packageJson.scripts[script]) {
      console.log(`✅ ${script}: ${packageJson.scripts[script]}`);
    } else {
      console.warn(`⚠️ ${script}: No encontrado`);
    }
  });

  // Recomendaciones
  console.log('\n📋 Recomendaciones para evitar problemas de assets:');
  console.log('1. Asegúrate de que el build use siempre la configuración de Vercel');
  console.log('2. Limpia el caché antes de cada build: npm run fix-assets');
  console.log('3. Verifica que todos los archivos se suban al servidor');
  console.log('4. Usa el archivo cache-clear.html para limpiar caché del navegador');
  console.log('5. Considera usar un hash de versión en el index.html para forzar recarga');

  console.log('\n✅ Verificación completada');

} catch (error) {
  console.error('❌ Error durante la verificación:', error.message);
  process.exit(1);
}
