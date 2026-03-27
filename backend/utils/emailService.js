import nodemailer from 'nodemailer';

/**
 * Configuración del transporter de email
 */
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_PASSWORD,
  },
});

/**
 * Envía un email usando la configuración de ControlDoc
 * @param {Object} emailData - Datos del email
 * @param {string} emailData.to - Email destinatario
 * @param {string} emailData.subject - Asunto del email
 * @param {string} emailData.text - Contenido del email
 * @param {string} [emailData.html] - Contenido HTML del email (opcional)
 * @returns {Promise<Object>} Resultado del envío
 */
export async function sendEmail({ to, subject, text, html }) {
  try {
    const mailOptions = {
      from: `"ControlDoc Alertas" <${process.env.ZOHO_EMAIL}>`,
      to,
      subject,
      text,
      ...(html && { html })
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email enviado exitosamente a ${to}`);
    return result;
  } catch (error) {
    console.error(`❌ Error enviando email a ${to}:`, error);
    throw error;
  }
}

/**
 * Valida si un email tiene formato válido
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Envía email de notificación de vencimiento personalizado
 * @param {string} to - Email destinatario
 * @param {Array} requeridos - Lista de documentos requeridos
 * @param {Array} subidos - Lista de documentos próximos a vencer
 * @returns {Promise<Object>} Resultado del envío
 */
export async function sendExpirationNotification(to, requeridos = [], subidos = []) {
  const tieneRequeridos = requeridos.length > 0;
  const tieneSubidos = subidos.length > 0;

  let encabezado = '';
  if (tieneRequeridos && tieneSubidos) {
    encabezado = `📌 ControlDoc informa que tiene documentos a vencer y nuevos requerimientos`;
  } else if (tieneRequeridos) {
    encabezado = `📌 ControlDoc informa que tiene un nuevo requerimiento`;
  } else if (tieneSubidos) {
    encabezado = `📌 ControlDoc informa que tiene documentos próximos a vencer`;
  }

  const listaRequeridos = tieneRequeridos
    ? `\n🟥 Usted tiene un nuevo requerimiento:\n${requeridos.map(d => `🔴 ${d.nombre} (vence el ${d.vencimiento}) - ${d.companyName}`).join('\n')}\n`
    : '';

  const listaSubidos = tieneSubidos
    ? `\n🟡 Tiene un documento próximo a vencer:\n${subidos.map(d => `🟡 ${d.nombre} (vence el ${d.vencimiento} - ${d.diasRestantes} días restantes) - ${d.companyName}`).join('\n')}\n`
    : '';

  const cuerpo = `
${encabezado}

${listaRequeridos}${listaSubidos}

👉 Puede gestionar sus documentos ingresando a: https://controldoc.app/login

Saludos,
El equipo de ControlDoc
`.trim();

  return await sendEmail({
    to,
    subject: '📌 ControlDoc - Notificación de vencimientos',
    text: cuerpo
  });
}

/**
 * Envía email de informe administrativo
 * @param {string} to - Email destinatario
 * @param {Object} informeData - Datos del informe
 * @returns {Promise<Object>} Resultado del envío
 */
export async function sendAdminReport(to, informeData) {
  const { cantidadTotal, resumen } = informeData;
  
  const cuerpoInforme = `
📬 Resumen diario de notificaciones de vencimientos

🟢 Correos enviados: ${cantidadTotal}
📎 Detalle por destinatario:

${resumen.join('\n')}

📅 Fecha: ${new Date().toLocaleString('es-AR')}
`.trim();

  return await sendEmail({
    to,
    subject: '📊 Informe de vencimientos enviados',
    text: cuerpoInforme
  });
}
