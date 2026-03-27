import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)),
});

const uid = 'R8PKT1gmEWVxT2ojXyvV7qKocV93'; // ⬅️ reemplazá con el UID real

async function assignRole() {
  try {
    await admin.auth().setCustomUserClaims(uid, {
      role: 'max'
    });
    console.log(`✅ Rol "max" asignado a ${uid}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

assignRole();
