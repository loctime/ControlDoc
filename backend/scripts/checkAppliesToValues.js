#!/usr/bin/env node

/**
 * Script para verificar los valores de appliesTo en documentos requeridos
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar Firebase
let db;
try {
  const projectRoot = path.join(__dirname, '../../');
  const googleJsonPath = path.join(projectRoot, 'google.json');
  const credentialsFile = fs.readFileSync(googleJsonPath, 'utf8');
  const serviceAccount = JSON.parse(credentialsFile);
  const fixedServiceAccount = {
    ...serviceAccount,
    private_key: serviceAccount.private_key.replace(/\\n/g, '\n')
  };
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(fixedServiceAccount)
    });
  }
  
  db = admin.firestore();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

const tenantId = 'hise';
const mainCompanyId = '22222222222';

const getTenantPath = (collectionName) => `tenants/${tenantId}/${collectionName}`;

async function checkAppliesTo() {
  const requiredPath = getTenantPath('requiredDocuments');
  const requiredQuery = db.collection(requiredPath)
    .where('companyId', '==', mainCompanyId);
  const requiredSnapshot = await requiredQuery.get();
  
  const stats = {
    mainTrueClientsNull: [],
    mainTrueClientsArray: [],
    mainFalseClientsArray: []
  };
  
  requiredSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const appliesTo = data.appliesTo || { main: true, clients: null };
    
    if (appliesTo.main === true && (!appliesTo.clients || appliesTo.clients.length === 0)) {
      stats.mainTrueClientsNull.push({
        id: doc.id,
        name: data.name,
        appliesTo
      });
    } else if (appliesTo.main === true && Array.isArray(appliesTo.clients) && appliesTo.clients.length > 0) {
      stats.mainTrueClientsArray.push({
        id: doc.id,
        name: data.name,
        appliesTo
      });
    } else if (appliesTo.main === false && Array.isArray(appliesTo.clients) && appliesTo.clients.length > 0) {
      stats.mainFalseClientsArray.push({
        id: doc.id,
        name: data.name,
        appliesTo
      });
    }
  });
  
  console.log('📊 Análisis de appliesTo:');
  console.log('');
  console.log(`   main=true, clients=null/[]: ${stats.mainTrueClientsNull.length} (solo empresa principal)`);
  console.log(`   main=true, clients=[...]: ${stats.mainTrueClientsArray.length} (empresa principal Y clientes)`);
  console.log(`   main=false, clients=[...]: ${stats.mainFalseClientsArray.length} (solo clientes)`);
  console.log('');
  
  if (stats.mainTrueClientsArray.length > 0) {
    console.log('⚠️  Documentos con main=true y clients asignados (aparecen en empresa principal Y clientes):');
    stats.mainTrueClientsArray.slice(0, 5).forEach(doc => {
      console.log(`   - ${doc.name.substring(0, 60)}`);
      console.log(`     appliesTo: ${JSON.stringify(doc.appliesTo)}`);
    });
    console.log('');
  }
}

checkAppliesTo()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

