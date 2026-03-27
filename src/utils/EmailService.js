import axios from "axios";
import { formatDateDDMMAAAA } from './dateHelpers.js';
import { getClientName } from './getClientName.js';

/**
 * Envía un email con los datos del documento.
 * @param {Object} doc - Documento con metadata
 * @param {'aprobar' | 'rechazar'} tipo - Tipo de acción
 * @param {string} [comentario=''] - Comentario si es rechazo
 * @param {string} [fechaVencimiento=''] - Fecha si es aprobación
 */
export async function enviarEmailDocumento({ doc, tipo, comentario = '', fechaVencimiento = '' }) {
  const email = doc?.realemail;
  if (!email) throw new Error("Falta el email del destinatario (doc.realemail)");

  // Obtener datos del documento con fallbacks
  const documentName = doc.name || doc.documentName || 'Documento';
  const entityName = doc.entityName || 'Entidad';
  const entityType = doc.entityType || 'company';
  const companyName = doc.companyName || 'Empresa';
  // Obtener nombre del cliente si existe clientId
  const clientName = doc.clientName || (doc.clientId ? await getClientName(doc.clientId) : null) || 'Principal';
  const baseUrl = window.location.origin;

  // Formatear fecha de vencimiento
  const formatDate = (dateString) => {
    if (!dateString) return 'No asignada';
    try {
      return formatDateDDMMAAAA(dateString);
    } catch {
      return dateString;
    }
  };

  // Generar HTML profesional
  const generateHTML = () => {
    const isApproved = tipo === "aprobar";
    const statusColor = isApproved ? '#28a745' : '#dc3545';
    const statusIcon = isApproved ? '✅' : '❌';
    const statusText = isApproved ? 'APROBADO' : 'RECHAZADO';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ControlDoc - Notificación de Documento</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 300; }
        .content { padding: 30px; }
        .status-card { background-color: #f8f9fa; border-left: 4px solid ${statusColor}; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .status-text { font-size: 18px; font-weight: 600; color: ${statusColor}; margin: 0 0 10px 0; }
        .document-info { background-color: #ffffff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #f8f9fa; }
        .info-label { font-weight: 600; color: #495057; }
        .info-value { color: #212529; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .comment-box { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 15px 0; }
        .comment-label { font-weight: 600; color: #856404; margin-bottom: 5px; }
        .comment-text { color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 ControlDoc</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Gestión Inteligente de Documentos</p>
        </div>
        
        <div class="content">
            <div class="status-card">
                <p class="status-text">${statusIcon} Documento ${statusText}</p>
                <p style="margin: 0; color: #6c757d;">Se ha procesado tu documento en ControlDoc</p>
            </div>

            <div class="document-info">
                <div class="info-row">
                    <span class="info-label">📄 Nombre del Documento:</span>
                    <span class="info-value"><strong>${documentName}</strong></span>
                </div>
                <div class="info-row">
                    <span class="info-label">🏢 Empresa:</span>
                    <span class="info-value">${companyName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">👤 Cliente:</span>
                    <span class="info-value">${clientName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">🏛️ Entidad:</span>
                    <span class="info-value">${entityName} (${entityType})</span>
                </div>
                ${isApproved ? `
                <div class="info-row">
                    <span class="info-label">📅 Fecha de Vencimiento:</span>
                    <span class="info-value">${formatDate(fechaVencimiento)}</span>
                </div>
                ` : ''}
                <div class="info-row">
                    <span class="info-label">📅 Fecha de Procesamiento:</span>
                    <span class="info-value">${formatDateDDMMAAAA(new Date())}</span>
                </div>
            </div>

            ${!isApproved && comentario ? `
            <div class="comment-box">
                <div class="comment-label">💬 Comentarios del Revisor:</div>
                <div class="comment-text">${comentario}</div>
            </div>
            ` : ''}

            <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}" class="cta-button">🔍 Acceder a ControlDoc</a>
            </div>

            ${isApproved ? `
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #155724; font-weight: 600;">🎉 ¡Felicidades!</p>
                <p style="margin: 5px 0 0 0; color: #155724;">Tu documento ha sido aprobado y está disponible en tu biblioteca de documentos.</p>
            </div>
            ` : `
            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #721c24; font-weight: 600;">📝 Acción Requerida</p>
                <p style="margin: 5px 0 0 0; color: #721c24;">Por favor revisa los comentarios y sube una nueva versión del documento corregido.</p>
            </div>
            `}
        </div>

        <div class="footer">
            <p><strong>ControlDoc</strong> - Tu plataforma de gestión documental inteligente</p>
            <p>📧 Soporte: soporte@controldoc.app | 🌐 <a href="https://controldoc.app" style="color: #667eea;">controldoc.app</a></p>
        </div>
    </div>
</body>
</html>`;
  };

  // Generar texto plano para compatibilidad
  const generateText = () => {
    const isApproved = tipo === "aprobar";
    const statusText = isApproved ? 'APROBADO' : 'RECHAZADO';
    const statusIcon = isApproved ? '✅' : '❌';
    
    return `
${statusIcon} ControlDoc - Documento ${statusText}

Estimado/a Usuario,

Te informamos que tu documento ha sido procesado en ControlDoc:

📄 DOCUMENTO: ${documentName}
🏢 EMPRESA: ${companyName}
👤 CLIENTE: ${clientName}
🏛️ ENTIDAD: ${entityName} (${entityType})
📅 FECHA: ${formatDateDDMMAAAA(new Date())}

${isApproved ? `
🎉 ESTADO: APROBADO
📅 VENCIMIENTO: ${formatDate(fechaVencimiento)}

Tu documento ha sido aprobado y está disponible en tu biblioteca.
` : `
❌ ESTADO: RECHAZADO
💬 COMENTARIOS: ${comentario || 'No especificados'}

Por favor revisa los comentarios y sube una nueva versión corregida.
`}

🔍 Accede a ControlDoc: ${baseUrl}

---
Saludos cordiales,
Equipo ControlDoc
📧 soporte@controldoc.app
🌐 https://controldoc.app
`;
  };

  // Definir variables para el subject
  const isApproved = tipo === "aprobar";
  const statusIcon = isApproved ? '✅' : '❌';
  
  const subject = `${statusIcon} ControlDoc - ${documentName} ${isApproved ? 'Aprobado' : 'Rechazado'}`;

  await axios.post(`${import.meta.env.VITE_API_URL}/api/send-email`, {
    to: email,
    subject,
    text: generateText(),
    html: generateHTML()
  });
}

