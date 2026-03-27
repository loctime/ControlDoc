#!/usr/bin/env node

/**
 * Script para establecer role "owner" a un usuario (cliente principal del tenant).
 * Uso: node setOwnerRole.js <userId> [tenantId]
 *
 * tenantId = ID del tenant en Firestore (ej: hise, dev). Es el documento en colección "tenants".
 * Si no lo pasas, se usa "hise" por defecto.
 */

import { db, auth } from '../firebaseconfig.js';
import { getTenantCollectionPath } from '../utils/tenantUtils.js';

const DEFAULT_TENANT_ID = 'hise';

const userId = process.argv[2];
const tenantId = process.argv[3] || DEFAULT_TENANT_ID;

if (!userId) {
  console.error('❌ Error: Debes proporcionar el userId');
  console.log('Uso: node setOwnerRole.js <userId> [tenantId]');
  console.log('Ejemplo: node setOwnerRole.js R8PKT1gmEWVxT2ojXyvV7qKocV93 hise');
  process.exit(1);
}

async function setOwnerRole() {
  try {
    console.log(`🔧 Estableciendo role "owner" para usuario ${userId} en tenant ${tenantId}...`);

    const usersPath = getTenantCollectionPath(tenantId, 'users');
    const userRef = db.collection(usersPath).doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const currentData = userDoc.data();
      console.log(`📋 Role actual: ${currentData.role || 'no definido'}`);
      await userRef.update({
        role: 'owner',
        updatedAt: new Date()
      });
      console.log(`✅ Role "owner" establecido exitosamente para usuario ${userId}`);
      console.log(`📧 Email: ${currentData.realemail || currentData.email || 'N/A'}`);
      console.log(`🏢 Empresa: ${currentData.companyName || currentData.companyId || 'N/A'}`);
      process.exit(0);
      return;
    }

    // Usuario no existe en Firestore: obtener de Firebase Auth y crear en tenants/<tenantId>/users
    console.log(`📄 Usuario no está en Firestore; se creará en ${usersPath} con datos de Firebase Auth...`);
    let authUser;
    try {
      authUser = await auth.getUser(userId);
    } catch (authErr) {
      console.error(`❌ Usuario ${userId} no existe en Firebase Auth:`, authErr.message);
      process.exit(1);
    }

    const email = authUser.email || '';
    const displayName = authUser.displayName || null;
    const newUser = {
      uid: userId,
      firebaseUid: userId,
      email,
      realemail: email,
      displayName,
      role: 'owner',
      tenantId,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'script-setOwnerRole'
    };

    await userRef.set(newUser);
    console.log('✅ Usuario creado en Firestore con role "owner"');
    console.log(`   📧 Email: ${email}`);
    console.log(`   👤 Display name: ${displayName || 'N/A'}`);
    console.log(`   📍 Ruta: ${usersPath}/${userId}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setOwnerRole();

