#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Función para verificar importaciones de React en archivos JSX
function verifyReactImports() {
  console.log('🔍 Verificando importaciones de React en componentes lazy...');
  
  const srcPath = path.join(process.cwd(), 'src');
  
  // Lista de archivos que se cargan de forma lazy
  const lazyComponents = [
    'src/entidad/adm/dashboard/AdminEmpresas.jsx',
    'src/entidad/adm/dashboard/EmpresasTable.jsx',
    'src/entidad/adm/AdminDashboard.jsx',
    'src/entidad/adm/AdminPanel/AdminCompaniesPage.jsx',
    'src/entidad/adm/AceptCompany.jsx'
  ];
  
  let allValid = true;
  
  for (const componentPath of lazyComponents) {
    const fullPath = path.join(process.cwd(), componentPath);
    
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Archivo no encontrado: ${componentPath}`);
      continue;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Verificar que tenga importación de React
    if (!content.includes('import React') && !content.includes('import {') && !content.includes('useState')) {
      console.error(`❌ ${componentPath}: No tiene importación de React`);
      allValid = false;
    }
    
    // Verificar que tenga importación de useState si lo usa
    if (content.includes('useState') && !content.includes('import { useState }') && !content.includes('import React, { useState }')) {
      console.error(`❌ ${componentPath}: Usa useState pero no lo importa`);
      allValid = false;
    }
    
    // Verificar que tenga importación de useEffect si lo usa
    if (content.includes('useEffect') && !content.includes('import { useEffect }') && !content.includes('import React, { useEffect }')) {
      console.error(`❌ ${componentPath}: Usa useEffect pero no lo importa`);
      allValid = false;
    }
    
    console.log(`✅ ${componentPath}: Importaciones verificadas`);
  }
  
  return allValid;
}

// Función para verificar que el build incluya React en los chunks correctos
function verifyBuildChunks() {
  console.log('🔍 Verificando chunks del build...');
  
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
  
  // Verificar que exista el chunk de React vendor
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
  
  if (!reactVendorContent.includes('useEffect')) {
    console.error('❌ useEffect no está disponible en react-vendor');
    return false;
  }
  
  console.log('✅ React vendor chunk verificado correctamente');
  return true;
}

// Función principal
function main() {
  console.log('🚀 Iniciando verificación de componentes lazy...');
  
  const importsValid = verifyReactImports();
  const chunksValid = verifyBuildChunks();
  
  if (!importsValid || !chunksValid) {
    console.error('❌ Verificación de componentes lazy falló');
    process.exit(1);
  }
  
  console.log('🎉 Verificación de componentes lazy completada exitosamente');
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { verifyReactImports, verifyBuildChunks };
