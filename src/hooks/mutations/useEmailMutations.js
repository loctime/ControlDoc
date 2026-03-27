// src/hooks/mutations/useEmailMutations.js
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { formatDateDDMMAAAA } from '../utils/dateHelpers.js';
import { MUTATION_DEFAULTS } from '../config/queryConfig';

// Mutation para enviar email de documento
const sendDocumentEmailMutation = async ({ doc, tipo, comentario = '', fechaVencimiento = '' }) => {
  const email = doc?.realemail;
  if (!email) throw new Error("Falta el email del destinatario (doc.realemail)");

  // Obtener datos del documento con fallbacks
  const documentName = doc.name || doc.documentName || 'Documento';
  const entityName = doc.entityName || 'Entidad';
  const entityType = doc.entityType || 'company';
  const companyName = doc.companyName || 'Empresa';
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
        .status { text-align: center; margin: 20px 0; }
        .status-badge { display: inline-block; padding: 10px 20px; border-radius: 25px; font-weight: bold; font-size: 16px; }
        .approved { background-color: #d4edda; color: #155724; border: 2px solid #c3e6cb; }
        .rejected { background-color: #f8d7da; color: #721c24; border: 2px solid #f5c6cb; }
        .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .info-table td { padding: 12px; border-bottom: 1px solid #e9ecef; }
        .info-table td:first-child { font-weight: bold; background-color: #f8f9fa; width: 30%; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .button:hover { background-color: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ControlDoc</h1>
            <p>Gestión de Documentos Empresariales</p>
        </div>
        
        <div class="content">
            <h2>Notificación de Documento ${statusText}</h2>
            
            <div class="status">
                <div class="status-badge ${isApproved ? 'approved' : 'rejected'}">
                    ${statusIcon} ${statusText}
                </div>
            </div>
            
            <table class="info-table">
                <tr><td>Documento:</td><td>${documentName}</td></tr>
                <tr><td>Entidad:</td><td>${entityName}</td></tr>
                <tr><td>Tipo:</td><td>${entityType}</td></tr>
                <tr><td>Empresa:</td><td>${companyName}</td></tr>
                ${isApproved && fechaVencimiento ? `<tr><td>Vencimiento:</td><td>${formatDate(fechaVencimiento)}</td></tr>` : ''}
                ${comentario ? `<tr><td>Comentario:</td><td>${comentario}</td></tr>` : ''}
            </table>
            
            <p>Su documento ha sido ${isApproved ? 'aprobado' : 'rechazado'} por el administrador del sistema.</p>
            
            <div style="text-align: center;">
                <a href="${baseUrl}" class="button">Acceder a ControlDoc</a>
            </div>
        </div>
        
        <div class="footer">
            <p>Este es un mensaje automático de ControlDoc. Por favor, no responda a este email.</p>
            <p>© ${new Date().getFullYear()} ControlDoc. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>`;
  };

  const emailData = {
    to: email,
    subject: `ControlDoc - Documento ${tipo === 'aprobar' ? 'Aprobado' : 'Rechazado'}`,
    html: generateHTML(),
    text: `Su documento "${documentName}" ha sido ${tipo === 'aprobar' ? 'aprobado' : 'rechazado'}. ${comentario ? `Comentario: ${comentario}` : ''}`
  };

  const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/send-email`, emailData);
  return response.data;
};

// Mutation para enviar email de notificación
const sendNotificationEmailMutation = async ({ to, subject, html, text }) => {
  const emailData = { to, subject, html, text };
  const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/send-email`, emailData);
  return response.data;
};

// Hook principal
export function useEmailMutations() {
  const sendDocumentEmailMutation = useMutation({
    mutationFn: sendDocumentEmailMutation,
    ...MUTATION_DEFAULTS,
  });

  const sendNotificationEmailMutation = useMutation({
    mutationFn: sendNotificationEmailMutation,
    ...MUTATION_DEFAULTS,
  });

  return {
    // Document email operations
    sendDocumentEmail: sendDocumentEmailMutation.mutate,
    isSendingDocumentEmail: sendDocumentEmailMutation.isPending,
    documentEmailError: sendDocumentEmailMutation.error,

    // Notification email operations
    sendNotificationEmail: sendNotificationEmailMutation.mutate,
    isSendingNotificationEmail: sendNotificationEmailMutation.isPending,
    notificationEmailError: sendNotificationEmailMutation.error,

    // Combined loading state
    isLoading: sendDocumentEmailMutation.isPending || sendNotificationEmailMutation.isPending,
  };
}

