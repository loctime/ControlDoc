#!/usr/bin/env node
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// 1. Verificar versión de Node
const nodeVersion = process.version;
if (!nodeVersion.includes('v22.14.0')) {
  console.error('❌ Error: Se requiere Node.js v22.14.0');
  process.exit(1);
}

// 2. Verificar variables de entorno
const requiredVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'PORT'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Variables faltantes: ${missingVars.join(', ')}`);
  process.exit(1);
}

console.log('✅ Pre-deploy checks passed');
