// routes/sendEmail.js
import express from "express";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";

const router = express.Router();

// --- Opcional: Limitar a 5 emails por IP cada 10 minutos ---
 const emailLimiter = rateLimit({
   windowMs: 10 * 60 * 1000,
   max: 5,
   message: { error: "Demasiados envíos desde esta IP. Intenta más tarde." }
});
router.use(emailLimiter);

/**
 * Utilidad para validar emails con regex simple
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Lógica centralizada para enviar emails
 */
async function sendEmail({ to, subject, text, html }) {
  // Verificar que las variables de entorno estén configuradas
  if (!process.env.ZOHO_EMAIL || !process.env.ZOHO_PASSWORD) {
    throw new Error(`Variables de entorno faltantes: ZOHO_EMAIL=${!!process.env.ZOHO_EMAIL}, ZOHO_PASSWORD=${!!process.env.ZOHO_PASSWORD}`);
  }

  console.log(`📧 Intentando enviar email a ${to} desde ${process.env.ZOHO_EMAIL}`);
  
  const transporter = nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.ZOHO_EMAIL,
      pass: process.env.ZOHO_PASSWORD,
    },
  });

  // Verificar la conexión antes de enviar
  try {
    await transporter.verify();
    console.log(`✅ Conexión SMTP verificada para ${process.env.ZOHO_EMAIL}`);
  } catch (verifyError) {
    console.error("❌ Error verificando conexión SMTP:", verifyError);
    throw new Error(`Error de autenticación SMTP: ${verifyError.message}`);
  }

  return transporter.sendMail({
    from: `"ControlDoc Alertas" <${process.env.ZOHO_EMAIL}>`,
    to,
    subject,
    text,
    ...(html && { html })
  });
}

/**
 * Endpoint POST /
 * Requiere: { to, subject, text }
 * Solo permite emails válidos y campos completos.
 */
router.post("/", async (req, res) => {
  const { to, subject, text, html } = req.body;
  
  console.log(`📬 Solicitud de envío de email recibida:`, { to, subject: subject?.substring(0, 50) + '...' });
  
  if (!to || !subject || !text) {
    console.error("❌ Campos faltantes:", { to: !!to, subject: !!subject, text: !!text });
    return res.status(400).json({ error: "Faltan campos obligatorios." });
  }
  
  if (!isValidEmail(to)) {
    console.error("❌ Email inválido:", to);
    return res.status(400).json({ error: "Email destinatario inválido." });
  }
  
  try {
    await sendEmail({ to, subject, text, html });
    console.info(`✅ Email enviado exitosamente a ${to} | Asunto: ${subject}`);
    res.status(200).json({ success: true, message: "Email enviado correctamente." });
  } catch (err) {
    console.error("❌ Error detallado al enviar email:", {
      message: err.message,
      code: err.code,
      response: err.response,
      stack: err.stack
    });
    res.status(500).json({ 
      error: "Error al enviar email.", 
      details: err.message,
      code: err.code || 'UNKNOWN_ERROR'
    });
  }
});

export default router;
