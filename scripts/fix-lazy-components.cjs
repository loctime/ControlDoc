#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Función para verificar y corregir importaciones de React en componentes lazy
function fixLazyComponents() {
  console.log('🔧 Verificando y corrigiendo importaciones de React en componentes lazy...');
  
  // Lista de archivos que se cargan de forma lazy
  const lazyComponents = [
    'src/entidad/adm/dashboard/AdminEmpresas.jsx',
    'src/entidad/adm/dashboard/EmpresasTable.jsx',
    'src/entidad/adm/AdminDashboard.jsx',
    'src/entidad/adm/AdminPanel/AdminCompaniesPage.jsx',
    'src/entidad/adm/AceptCompany.jsx'
  ];
  
  let fixedCount = 0;
  
  for (const componentPath of lazyComponents) {
    const fullPath = path.join(process.cwd(), componentPath);
    
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Archivo no encontrado: ${componentPath}`);
      continue;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    // Verificar si necesita importación de React
    if (!content.includes('import React') && !content.includes('import {') && content.includes('useState')) {
      // Agregar importación de React al inicio
      const reactImport = "import React, { useState } from 'react';\n";
      content = reactImport + content;
      modified = true;
      console.log(`✅ ${componentPath}: Agregada importación de React`);
    }
    
    // Verificar si necesita importación de useEffect
    if (content.includes('useEffect') && !content.includes('useEffect') && !content.includes('import { useEffect }')) {
      // Modificar la importación existente para incluir useEffect
      if (content.includes('import React, { useState }')) {
        content = content.replace('import React, { useState }', 'import React, { useState, useEffect }');
        modified = true;
        console.log(`✅ ${componentPath}: Agregado useEffect a la importación`);
      } else if (content.includes('import { useState }')) {
        content = content.replace('import { useState }', 'import { useState, useEffect }');
        modified = true;
        console.log(`✅ ${componentPath}: Agregado useEffect a la importación`);
      }
    }
    
    // Verificar si necesita importación de useContext
    if (content.includes('useContext') && !content.includes('useContext') && !content.includes('import { useContext }')) {
      // Modificar la importación existente para incluir useContext
      if (content.includes('import React, { useState, useEffect }')) {
        content = content.replace('import React, { useState, useEffect }', 'import React, { useState, useEffect, useContext }');
        modified = true;
        console.log(`✅ ${componentPath}: Agregado useContext a la importación`);
      } else if (content.includes('import { useState, useEffect }')) {
        content = content.replace('import { useState, useEffect }', 'import { useState, useEffect, useContext }');
        modified = true;
        console.log(`✅ ${componentPath}: Agregado useContext a la importación`);
      }
    }
    
    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      fixedCount++;
    } else {
      console.log(`✅ ${componentPath}: Importaciones correctas`);
    }
  }
  
  console.log(`🎉 Proceso completado. ${fixedCount} archivos modificados.`);
  return true;
}

// Función principal
function main() {
  try {
    fixLazyComponents();
  } catch (error) {
    console.error('❌ Error durante la corrección:', error.message);
    process.exit(1);
  }
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { fixLazyComponents };
