#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Script para verificar que la solución de Emotion esté funcionando
 */

console.log('🔍 Verificando solución de Emotion...');

// 1. Verificar que los archivos se hayan creado
const filesToCheck = [
  'src/emotion-polyfill.js',
  'src/config/emotionConfigAdvanced.js'
];

let allFilesExist = true;
filesToCheck.forEach(file => {
  if (existsSync(resolve(process.cwd(), file))) {
    console.log(`✅ ${file} existe`);
  } else {
    console.log(`❌ ${file} no existe`);
    allFilesExist = false;
  }
});

// 2. Verificar configuración de vite.config.js
const viteConfigPath = resolve(process.cwd(), 'vite.config.js');
if (existsSync(viteConfigPath)) {
  const viteConfig = readFileSync(viteConfigPath, 'utf8');
  
  const checks = [
    { name: 'jsxImportSource: @emotion/react', check: viteConfig.includes('jsxImportSource: \'@emotion/react\'') },
    { name: 'emotion babel plugin', check: viteConfig.includes('@emotion/babel-plugin') },
    { name: 'emotion alias', check: viteConfig.includes('@emotion/react:') },
    { name: 'force: true', check: viteConfig.includes('force: true') }
  ];
  
  console.log('\n📋 Verificaciones de vite.config.js:');
  checks.forEach(check => {
    console.log(`${check.check ? '✅' : '❌'} ${check.name}`);
  });
} else {
  console.log('❌ vite.config.js no existe');
  allFilesExist = false;
}

// 3. Verificar main.jsx
const mainJsxPath = resolve(process.cwd(), 'src/main.jsx');
if (existsSync(mainJsxPath)) {
  const mainJsx = readFileSync(mainJsxPath, 'utf8');
  
  const checks = [
    { name: 'emotion-polyfill import', check: mainJsx.includes('emotion-polyfill') },
    { name: 'CacheProvider', check: mainJsx.includes('CacheProvider') },
    { name: 'emotionCache', check: mainJsx.includes('emotionCache') }
  ];
  
  console.log('\n📋 Verificaciones de main.jsx:');
  checks.forEach(check => {
    console.log(`${check.check ? '✅' : '❌'} ${check.name}`);
  });
} else {
  console.log('❌ main.jsx no existe');
  allFilesExist = false;
}

// 4. Verificar package.json
const packageJsonPath = resolve(process.cwd(), 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = readFileSync(packageJsonPath, 'utf8');
  
  const checks = [
    { name: 'fix-emotion-aggressive script', check: packageJson.includes('fix-emotion-aggressive') },
    { name: '@emotion/react dependency', check: packageJson.includes('"@emotion/react"') },
    { name: '@emotion/styled dependency', check: packageJson.includes('"@emotion/styled"') }
  ];
  
  console.log('\n📋 Verificaciones de package.json:');
  checks.forEach(check => {
    console.log(`${check.check ? '✅' : '❌'} ${check.name}`);
  });
} else {
  console.log('❌ package.json no existe');
  allFilesExist = false;
}

console.log('\n🎯 Resumen:');
if (allFilesExist) {
  console.log('✅ Todos los archivos necesarios están presentes');
  console.log('✅ La solución agresiva de Emotion se ha aplicado correctamente');
  console.log('💡 Si el error persiste, puede ser un problema de caché del navegador');
  console.log('🔄 Intenta hacer un hard refresh (Ctrl+F5) en el navegador');
} else {
  console.log('❌ Algunos archivos están faltando');
  console.log('🔧 Ejecuta nuevamente: node scripts/fix-emotion-aggressive.js');
}
