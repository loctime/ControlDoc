// backend/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './firebaseconfig.js';
import uploadRoute from './routes/upload.js';
import adminRoutes from './routes/adminRoutes.js';
import upload from './middleware/multerMiddleware.js';
import convertImageRoute from './routes/convertImageRoute.js';
import proxyRouter from './routes/proxy.js'; // Importar router proxy
import devRoutes from './routes/devRoutes.js';
import backupRoutes from './routes/backupRoutes.js'; // Nuevo import
import analyzeFileRoute from './routes/analyzeFile.js';
import adminAddRoutes from './routes/adminAddRoutes.js';
import deleteFileRoute from './routes/deleteFileRoute.js';
import generateBackupRoute from './routes/backup/generateBackup.js';
import downloadRoute from './routes/download.js';
import sendEmailRoute from './routes/send-email.js';
import deleteAdminRoute from './routes/delete-admin.js';
import optimizeUploadRoutes from './routes/optimizeUploadRoutes.js';
import tenantRoutes from './routes/tenantRoutes.js';
import searchHistoryRoute from './routes/searchHistory.js';
import ihatePdfRoutes from './routes/ihatepdf.js';
import extractPdfPagesRoute from './routes/extractPdfPagesRoute.js';
import notificationRoutes from './routes/notificationRoutesV2.js';
import bulkUploadRoute from './routes/bulkUpload.js';
import bulkV2VehiclesRoute from './routes/bulkV2Vehicles.js';
import patternsRoute from './routes/patterns.js';
import requiredDocumentsRoute from './routes/requiredDocuments.js';
import pdfSeparationsRoute from './routes/pdfSeparations.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import registerDocumentRoute from './routes/registerDocument.js';
import { tenantMiddleware } from './utils/tenantUtils.js';
const app = express();
const port = process.env.PORT || 3001;

import { isAllowedOrigin } from './allowed-origins.js';

// Configuración CORS mejorada con manejo explícito de preflight
app.use(cors({
  origin: function (origin, callback) {
    // Log del origen recibido para debugging
    if (process.env.DEBUG_CORS || process.env.NODE_ENV === 'development') {
      console.log(`🌐 [CORS] Petición recibida desde origen: ${origin || '(sin origin - puede ser same-origin o herramienta)'}`);
    }
    
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ [CORS] Bloqueado: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // 24 horas para preflight cache
}));

// Manejo explícito de OPTIONS (preflight) para asegurar respuesta correcta
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  
  if (process.env.DEBUG_CORS || process.env.NODE_ENV === 'development') {
    console.log(`🔍 [CORS] Preflight OPTIONS desde: ${origin}`);
  }
  
  if (isAllowedOrigin(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Tenant');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    res.sendStatus(204);
  } else {
    res.sendStatus(403);
  }
});
app.use(express.json());

// Hacer la base de datos disponible globalmente (antes del middleware tenant, por si rutas públicas lo necesitan)
app.locals.db = db;

// Rutas públicas sin resolución de tenant (ping/health para UptimeRobot y wake del frontend)
app.get('/api/ping', (req, res) => {
  res.send('pong');
});
app.get('/api/health', (req, res) => {
  res.json({
    status: 'active',
    firebase: true,
    timestamp: new Date().toISOString()
  });
});

// Middleware para detectar tenant
app.use(tenantMiddleware);

// ✅ Ruta principal de subida de archivos
app.use('/api/upload', uploadRoute(upload)); 

// ✅ Ruta de análisis de archivos
app.use('/api/analyze-file', analyzeFileRoute);

// ✅ Proxy para descargas seguras desde el CDN (CORS bypass)
app.use('/api', proxyRouter);

// ✅ Rutas de administración (eliminar empresa, etc.)
app.use('/api/admin', adminRoutes);

// ❌ Rutas de gestión de tenants - DESHABILITADAS
// app.use('/api/tenants', tenantRoutes);

// ✅ Rutas de desarrollo
app.use('/api/dev', devRoutes);

// ✅ Ruta de conversión de imágenes a PDF
app.use('/api/convert-image', convertImageRoute);

// ✅ Ruta de extracción de páginas de PDF
app.use('/api', extractPdfPagesRoute);


// ✅ Ruta de descargas
app.use('/api', downloadRoute);

// ✅ Ruta de eliminación de administrador
app.use('/api/admin', deleteAdminRoute);

// ✅ Ruta de envío de emails
app.use('/api/send-email', sendEmailRoute);


// ✅ Ruta de generación de backup
app.use('/api/generate-backup', generateBackupRoute);

// ✅ Ruta de backup mensual
app.use('/api/backup', backupRoutes);

// ✅ Ruta de optimización de subida de archivos
app.use('/api/optimize-upload', optimizeUploadRoutes);

// ✅ Ruta de historial de búsquedas
app.use('/api/search-history', searchHistoryRoute);

// ✅ Ruta de carga masiva unificada
app.use('/api/bulk-upload', bulkUploadRoute);

// ✅ Bulk Upload V2 — Vehicle (staging + job lifecycle)
app.use('/api/bulk/v2/vehicles', bulkV2VehiclesRoute);

// ✅ Ruta de documentos requeridos (análisis de ejemplo)
app.use('/api/required-documents', requiredDocumentsRoute);

// ✅ Ruta de separación de PDFs (detección automática de múltiples documentos)
app.use('/api/pdf-separations', pdfSeparationsRoute);

// ✅ Ruta de feedback y aprendizaje
app.use('/api/feedback', feedbackRoutes);

// ✅ Registro de documento tras upload a ControlFile (sin subida de archivo)
app.use('/api/register-document', registerDocumentRoute);

// ✅ Ruta de patrones de extracción
app.use('/api/patterns', patternsRoute);

// ✅ Ruta para agregar administrador
app.use('/api/admin', adminAddRoutes);

// ✅ Ruta para eliminar archivo
app.use('/api/delete', deleteFileRoute);

// ✅ Ruta de iHatePDF - Herramientas PDF
app.use('/api/ihatepdf', ihatePdfRoutes());

// ✅ Rutas de notificaciones de vencimientos
app.use('/api/notifications', notificationRoutes);

// ✅ Ruta para aprobar empresa
app.post('/api/approve-company', async (req, res) => {
  const { companyId, adminId } = req.body;

  try {
    const isAdmin = await isUserAdmin(adminId);
    if (!isAdmin) {
      return res.status(403).json({ error: "Acceso no autorizado" });
    }

    await db.collection('companies').doc(companyId).update({ 
      approved: true,
      approvedAt: db.firestore.FieldValue.serverTimestamp(),
      approvedBy: adminId
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error aprobando empresa:", error);
    res.status(500).json({ error: "Error al aprobar empresa" });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
