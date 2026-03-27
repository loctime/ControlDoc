#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para buscar archivos JSX recursivamente
function findJsxFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findJsxFiles(fullPath, files);
    } else if (item.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Función para verificar importaciones de React
function checkReactImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  
  lines.forEach((line, index) => {
    // Buscar importaciones incorrectas de React
    if (line.includes('import { React,') || line.includes('import {React,')) {
      issues.push({
        line: index + 1,
        content: line.trim(),
        type: 'incorrect_react_import'
      });
    }
    
    // Buscar uso de useState sin importar React
    if (line.includes('useState(') && !content.includes('import React') && !content.includes('import { useState')) {
      issues.push({
        line: index + 1,
        content: line.trim(),
        type: 'useState_without_react'
      });
    }
  });
  
  return issues;
}

// Función principal
function main() {
  console.log('🔍 Verificando importaciones de React...\n');
  
  const srcDir = path.join(__dirname, '..', 'src');
  const jsxFiles = findJsxFiles(srcDir);
  
  let totalIssues = 0;
  let filesWithIssues = 0;
  
  for (const file of jsxFiles) {
    const issues = checkReactImports(file);
    
    if (issues.length > 0) {
      filesWithIssues++;
      const relativePath = path.relative(process.cwd(), file);
      console.log(`❌ ${relativePath}:`);
      
      issues.forEach(issue => {
        console.log(`   Línea ${issue.line}: ${issue.content}`);
        if (issue.type === 'incorrect_react_import') {
          console.log('   → Debería ser: import React, { useState, useEffect } from "react"');
        }
        totalIssues++;
      });
      console.log('');
    }
  }
  
  if (totalIssues === 0) {
    console.log('✅ Todas las importaciones de React son correctas');
  } else {
    console.log(`❌ Se encontraron ${totalIssues} problemas en ${filesWithIssues} archivos`);
    process.exit(1);
  }
}

main();
