// Script de prueba para verificar el endpoint de tenant vacío
// Ejecutar con: node test-tenant-empty.js

const testTenantEmpty = async () => {
  try {
    console.log('🧪 Probando endpoint /api/tenants/is-empty...');
    
    // Cambiar la URL según tu entorno
    const baseUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${baseUrl}/api/tenants/is-empty`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Respuesta del endpoint:', data);
    
    if (data.isEmpty) {
      console.log('📝 El tenant está vacío - se puede crear superadmin');
    } else {
      console.log('👥 El tenant tiene usuarios - usar registro normal');
    }
    
  } catch (error) {
    console.error('❌ Error probando endpoint:', error.message);
  }
};

testTenantEmpty();
