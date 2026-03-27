#!/usr/bin/env node

/**
 * Script para verificar que todas las rutas de Firestore estén usando el sistema multi-tenant
 * correctamente en el backend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Archivos a verificar
const filesToCheck = [
  '../routes/upload.js',
  '../routes/adminRoutes.js',
  '../routes/delete-admin.js',
  '../routes/auth.js',
  '../routes/adminAddRoutes.js',
  '../routes/tenantRoutes.js'
];

// Patrones problemáticos (rutas directas sin tenant)
const problematicPatterns = [
  /db\.collection\("companies"\)/g,
  /db\.collection\("users"\)/g,
  /db\.collection\("uploadedDocuments"\)/g,
  /db\.collection\("requiredDocuments"\)/g,
  /db\.collection\("personal"\)/g,
  /db\.collection\("vehiculos"\)/g,
  /db\.collection\("admins"\)/g,
  /db\.collection\("documentos"\)/g,
  /db\.collection\("backups"\)/g,
  /dbAdmin\.collection\("/g
];

// Patrones correctos (rutas con tenant)
const correctPatterns = [
  /req\.getTenantCollectionPath\(/g,
  /tenantCompaniesPath/g,
  /tenantUsersPath/g,
  /tenantUploadedDocsPath/g,
  /tenantRequiredDocsPath/g,
  /tenantPersonalPath/g,
  /tenantVehiculosPath/g,
  /tenantAdminsPath/g,
  /tenantDocumentsPath/g,
  /tenantBackupsPath/g
];

console.log('🔍 Verificando configuración multi-tenant en el backend...\n');

let totalIssues = 0;
let filesWithIssues = 0;

for (const filePath of filesToCheck) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Archivo no encontrado: ${filePath}`);
    continue;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const fileName = path.basename(filePath);
  
  console.log(`📁 Verificando: ${fileName}`);
  
  let fileIssues = 0;
  let hasCorrectPatterns = false;
  
  // Verificar patrones problemáticos
  for (const pattern of problematicPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`  ❌ Problema encontrado: ${pattern.source} (${matches.length} ocurrencias)`);
      fileIssues += matches.length;
    }
  }
  
  // Verificar patrones correctos
  for (const pattern of correctPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      hasCorrectPatterns = true;
      console.log(`  ✅ Patrón correcto: ${pattern.source} (${matches.length} ocurrencias)`);
    }
  }
  
  if (fileIssues > 0) {
    filesWithIssues++;
    totalIssues += fileIssues;
    console.log(`  🔴 Total de problemas en ${fileName}: ${fileIssues}\n`);
  } else if (hasCorrectPatterns) {
    console.log(`  🟢 ${fileName} está correctamente configurado\n`);
  } else {
    console.log(`  🟡 ${fileName} no usa Firestore o no tiene patrones verificables\n`);
  }
}

console.log('📊 Resumen de verificación:');
console.log(`  - Archivos verificados: ${filesToCheck.length}`);
console.log(`  - Archivos con problemas: ${filesWithIssues}`);
console.log(`  - Total de problemas encontrados: ${totalIssues}`);

if (totalIssues === 0) {
  console.log('\n🎉 ¡Excelente! Todos los archivos están correctamente configurados para multi-tenant.');
} else {
  console.log('\n⚠️  Se encontraron problemas. Revisa los archivos mencionados arriba.');
  console.log('\n💡 Recomendaciones:');
  console.log('  1. Reemplaza las rutas directas con req.getTenantCollectionPath()');
  console.log('  2. Usa las variables de tenant (tenantCompaniesPath, etc.)');
  console.log('  3. Asegúrate de que todas las operaciones de Firestore usen el tenant actual');
}

console.log('\n✅ Verificación completada.');

