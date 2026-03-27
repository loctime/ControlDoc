import 'dotenv/config';
import admin from 'firebase-admin';

console.log('🚀 Iniciando script de prueba...');

try {
  // Verificar variables de entorno
  console.log('📋 Variables de entorno:');
  console.log('- GOOGLE_APPLICATION_CREDENTIALS_JSON:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? '✅ Presente' : '❌ Ausente');
  console.log('- FIREBASE_STORAGE_BUCKET:', process.env.FIREBASE_STORAGE_BUCKET || '❌ Ausente');

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.error('❌ Error: GOOGLE_APPLICATION_CREDENTIALS_JSON no está configurada');
    process.exit(1);
  }

  // Parsear credenciales
  const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  console.log('✅ Credenciales parseadas correctamente');
  console.log('- Project ID:', serviceAccount.project_id);
  console.log('- Client Email:', serviceAccount.client_email);

  // Inicializar Firebase
  const fixedServiceAccount = {
    ...serviceAccount,
    private_key: serviceAccount.private_key.replace(/\\n/g, '\n')
  };

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(fixedServiceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('✅ Firebase inicializado correctamente');
  }

  const db = admin.firestore();
  
  // Probar conexión
  const tenantsRef = db.collection('tenants');
  const tenantsSnapshot = await tenantsRef.limit(1).get();
  
  console.log(`✅ Conexión exitosa. Tenants encontrados: ${tenantsSnapshot.size}`);

  console.log('🎉 Script de prueba completado exitosamente');

} catch (error) {
  console.error('❌ Error en script de prueba:', error);
  process.exit(1);
}
