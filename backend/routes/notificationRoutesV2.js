import express from 'express';
import { db } from '../firebaseconfig.js';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { sendEmail } from '../utils/emailService.js';

const router = express.Router();

/**
 * Endpoint para enviar notificaciones de vencimientos
 * POST /api/notifications/send-expiration-notifications
 */
router.post('/send-expiration-notifications', async (req, res) => {
  try {
    console.log('🚀 Iniciando proceso de notificaciones de vencimientos...');
    
    const result = await notificarVencimientos();
    
    res.json({ 
      success: true, 
      message: 'Notificaciones enviadas correctamente',
      details: result
    });
  } catch (error) {
    console.error('❌ Error en notificaciones:', error);
    res.status(500).json({ 
      error: 'Error al enviar notificaciones', 
      details: error.message 
    });
  }
});

/**
 * Endpoint de prueba para notificaciones
 * GET /api/notifications/test
 */
router.get('/test', async (req, res) => {
  try {
    const testResult = await testNotificationSystem();
    res.json({ 
      success: true, 
      message: 'Sistema de notificaciones funcionando',
      testData: testResult
    });
  } catch (error) {
    console.error('❌ Error en test:', error);
    res.status(500).json({ 
      error: 'Error en test de notificaciones', 
      details: error.message 
    });
  }
});

/**
 * Función principal para notificar vencimientos
 */
async function notificarVencimientos() {
  const hoy = new Date();
  const usuarios = {};
  const resumen = [];
  const INFORME_EMAIL = 'controldocumentarioapp@gmail.com';

  try {
    console.log('📋 Obteniendo documentos requeridos...');
    // 🔴 1. Documentos requeridos no subidos
    const docsRequeridos = await obtenerDocumentosRequeridos();
    console.log(`📄 Encontrados ${docsRequeridos.length} documentos requeridos`);
    
    docsRequeridos.forEach(doc => {
      const data = doc.data();
      if (!data) return;
      if (data.archivoSubido === true) return; // Ya subido

      const email = obtenerEmailResponsable(data);
      if (!email) return;

      if (!usuarios[email]) usuarios[email] = { requeridos: [], subidos: [] };

      const fechaExp = data.expirationDate?.toDate ? data.expirationDate.toDate() : 
                      data.expirationDate ? new Date(data.expirationDate) : null;

      usuarios[email].requeridos.push({
        nombre: data.name || 'Documento sin nombre',
        vencimiento: fechaExp ? fechaExp.toLocaleDateString('es-AR') : 'Sin fecha',
        companyName: data.companyName || 'Sin empresa'
      });
    });

    console.log('📋 Obteniendo documentos subidos...');
    // 🟡 2. Documentos subidos próximos a vencer
    const docsSubidos = await obtenerDocumentosSubidos();
    console.log(`📄 Encontrados ${docsSubidos.length} documentos subidos`);
    
    docsSubidos.forEach(doc => {
      const data = doc.data();
      if (!data) return;

      const email = obtenerEmailResponsable(data);
      if (!email) return;

      const fechaExp = data.expirationDate?.toDate ? data.expirationDate.toDate() : 
                      data.expirationDate ? new Date(data.expirationDate) : null;
      
      if (!fechaExp || isNaN(fechaExp)) return;

      const diasRestantes = calcularDiasRestantes(fechaExp, hoy);
      if (diasRestantes < 0 || diasRestantes > 7) return;

      if (!usuarios[email]) usuarios[email] = { requeridos: [], subidos: [] };

      usuarios[email].subidos.push({
        nombre: data.documentName || data.name || 'Documento sin nombre',
        vencimiento: fechaExp.toLocaleDateString('es-AR'),
        diasRestantes,
        companyName: data.companyName || 'Sin empresa'
      });
    });

    console.log(`👥 Procesando notificaciones para ${Object.keys(usuarios).length} usuarios...`);
    // ✉️ 3. Enviar correos personalizados
    let cantidadTotal = 0;

    for (const email in usuarios) {
      const data = usuarios[email];
      const tieneRequeridos = data.requeridos.length > 0;
      const tieneSubidos = data.subidos.length > 0;
      if (!tieneRequeridos && !tieneSubidos) continue;

      let encabezado = '';
      if (tieneRequeridos && tieneSubidos) {
        encabezado = `📌 ControlDoc informa que tiene documentos a vencer y nuevos requerimientos`;
      } else if (tieneRequeridos) {
        encabezado = `📌 ControlDoc informa que tiene un nuevo requerimiento`;
      } else if (tieneSubidos) {
        encabezado = `📌 ControlDoc informa que tiene documentos próximos a vencer`;
      }

      const listaRequeridos = tieneRequeridos
        ? `\n🟥 Usted tiene un nuevo requerimiento:\n${data.requeridos.map(d => `🔴 ${d.nombre} (vence el ${d.vencimiento}) - ${d.companyName}`).join('\n')}\n`
        : '';

      const listaSubidos = tieneSubidos
        ? `\n🟡 Tiene un documento próximo a vencer:\n${data.subidos.map(d => `🟡 ${d.nombre} (vence el ${d.vencimiento} - ${d.diasRestantes} días restantes) - ${d.companyName}`).join('\n')}\n`
        : '';

      const cuerpo = `
${encabezado}

${listaRequeridos}${listaSubidos}

👉 Puede gestionar sus documentos ingresando a: https://controldoc.app/login

Saludos,
El equipo de ControlDoc
`.trim();

      try {
        await sendEmail({
          to: email,
          subject: '📌 ControlDoc - Notificación de vencimientos',
          text: cuerpo
        });
        console.log(`✅ Email enviado a ${email}`);
        cantidadTotal++;

        // ✅ Resumen interno
        const detalles = [
          ...data.requeridos.map(d => `🔴 NUEVO REQUERIMIENTO → ${d.nombre} (vence el ${d.vencimiento}) - ${d.companyName}`),
          ...data.subidos.map(d => `🟡 DOCUMENTO A VENCER → ${d.nombre} (vence el ${d.vencimiento} - ${d.diasRestantes} días) - ${d.companyName}`)
        ].join('\n');

        resumen.push(`• ${email}\n${detalles}\n`);
      } catch (emailError) {
        console.error(`❌ Error enviando email a ${email}:`, emailError);
      }
    }

    // 📨 4. Enviar resumen a ControlDoc
    if (cantidadTotal > 0) {
      const cuerpoInforme = `
📬 Resumen diario de notificaciones de vencimientos

🟢 Correos enviados: ${cantidadTotal}
📎 Detalle por destinatario:

${resumen.join('\n')}

📅 Fecha: ${new Date().toLocaleString('es-AR')}
`.trim();

      try {
        await sendEmail({
          to: INFORME_EMAIL,
          subject: '📊 Informe de vencimientos enviados',
          text: cuerpoInforme
        });
        console.log(`✅ Informe enviado a ${INFORME_EMAIL}`);
      } catch (emailError) {
        console.error(`❌ Error enviando informe:`, emailError);
      }
    } else {
      console.log('📭 No se enviaron correos hoy.');
    }

    return {
      usuariosNotificados: cantidadTotal,
      documentosRequeridos: docsRequeridos.length,
      documentosSubidos: docsSubidos.length,
      resumen: resumen.length
    };

  } catch (error) {
    console.error('❌ Error en notificaciones:', error);
    throw error;
  }
}

/**
 * Obtener documentos requeridos de todos los tenants (MULTI-TENANT)
 */
async function obtenerDocumentosRequeridos() {
  try {
    console.log('📋 Obteniendo documentos requeridos desde estructura multi-tenant...');
    
    // 1. Obtener todos los tenants
    const tenants = await obtenerTodosLosTenants();
    console.log(`🏢 Procesando ${tenants.length} tenants:`, tenants);
    
    const todosLosDocs = [];
    
    // 2. Buscar en cada tenant
    for (const tenantId of tenants) {
      try {
        console.log(`🔍 Buscando documentos requeridos en tenant: ${tenantId}`);
        const collectionPath = `tenants/${tenantId}/requiredDocuments`;
        const requiredDocsRef = collection(db, collectionPath);
        const requiredDocsSnapshot = await getDocs(requiredDocsRef);
        
        let docsEnTenant = 0;
        requiredDocsSnapshot.forEach(doc => {
          todosLosDocs.push({
            id: doc.id,
            tenantId: tenantId,
            data: () => doc.data()
          });
          docsEnTenant++;
        });
        
        console.log(`📄 Encontrados ${docsEnTenant} documentos en tenant ${tenantId}`);
      } catch (error) {
        console.error(`❌ Error obteniendo documentos del tenant ${tenantId}:`, error);
      }
    }
    
    console.log(`📊 Total de documentos requeridos encontrados: ${todosLosDocs.length}`);
    return todosLosDocs;
  } catch (error) {
    console.error('❌ Error obteniendo documentos requeridos:', error);
    return [];
  }
}

/**
 * Obtener documentos subidos de todos los tenants (MULTI-TENANT)
 */
async function obtenerDocumentosSubidos() {
  try {
    console.log('📋 Obteniendo documentos subidos desde estructura multi-tenant...');
    
    // 1. Obtener todos los tenants
    const tenants = await obtenerTodosLosTenants();
    console.log(`🏢 Procesando ${tenants.length} tenants:`, tenants);
    
    const todosLosDocs = [];
    
    // 2. Buscar en cada tenant
    for (const tenantId of tenants) {
      try {
        console.log(`🔍 Buscando documentos subidos en tenant: ${tenantId}`);
        const collectionPath = `tenants/${tenantId}/uploadedDocuments`;
        const uploadedDocsRef = collection(db, collectionPath);
        const uploadedDocsSnapshot = await getDocs(uploadedDocsRef);
        
        let docsEnTenant = 0;
        uploadedDocsSnapshot.forEach(doc => {
          todosLosDocs.push({
            id: doc.id,
            tenantId: tenantId,
            data: () => doc.data()
          });
          docsEnTenant++;
        });
        
        console.log(`📄 Encontrados ${docsEnTenant} documentos en tenant ${tenantId}`);
      } catch (error) {
        console.error(`❌ Error obteniendo documentos del tenant ${tenantId}:`, error);
      }
    }
    
    console.log(`📊 Total de documentos subidos encontrados: ${todosLosDocs.length}`);
    return todosLosDocs;
  } catch (error) {
    console.error('❌ Error obteniendo documentos subidos:', error);
    return [];
  }
}

/**
 * Obtener todos los tenants del sistema
 */
async function obtenerTodosLosTenants() {
  try {
    console.log('🔍 Buscando tenants en la base de datos...');
    
    // Obtener todos los tenants desde la colección principal
    const tenantsRef = collection(db, 'tenants');
    const tenantsSnapshot = await getDocs(tenantsRef);
    
    const tenantIds = [];
    tenantsSnapshot.forEach(doc => {
      console.log(`📋 Tenant encontrado: ${doc.id}`);
      tenantIds.push(doc.id);
    });
    
    console.log(`🏢 Total de tenants encontrados: ${tenantIds.length}`);
    
    // Si no hay tenants en la colección principal, intentar obtener desde companies
    if (tenantIds.length === 0) {
      console.log('⚠️ No se encontraron tenants en colección principal, buscando en companies...');
      const companiesRef = collection(db, 'companies');
      const companiesSnapshot = await getDocs(companiesRef);
      
      companiesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.tenantId) {
          console.log(`📋 Tenant desde companies: ${data.tenantId}`);
          tenantIds.push(data.tenantId);
        }
      });
    }
    
    // Si aún no hay tenants, usar un tenant por defecto
    if (tenantIds.length === 0) {
      console.log('⚠️ No se encontraron tenants, usando tenant por defecto');
      tenantIds.push('default');
    }
    
    console.log(`🏢 Tenants finales: ${tenantIds.join(', ')}`);
    return tenantIds;
  } catch (error) {
    console.error('❌ Error obteniendo tenants:', error);
    console.log('🔄 Usando tenant por defecto como fallback');
    return ['default'];
  }
}

/**
 * Calcular días restantes entre fechas
 */
function calcularDiasRestantes(fecha, hoy) {
  return Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
}

/**
 * Obtener email responsable desde los datos del documento
 */
function obtenerEmailResponsable(data) {
  return (
    data.createdFor?.realemail ||
    data.realemail ||
    data.uploadedByEmail ||
    ''
  );
}

/**
 * Función de prueba del sistema de notificaciones
 */
async function testNotificationSystem() {
  try {
    const docsRequeridos = await obtenerDocumentosRequeridos();
    const docsSubidos = await obtenerDocumentosSubidos();
    
    return {
      documentosRequeridos: docsRequeridos.length,
      documentosSubidos: docsSubidos.length,
      fecha: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Error en test: ${error.message}`);
  }
}

export default router;
