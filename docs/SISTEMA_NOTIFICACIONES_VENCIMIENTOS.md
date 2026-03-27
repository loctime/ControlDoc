# Sistema de Notificaciones de Vencimientos - ControlDoc

## 📋 Descripción General

El sistema de notificaciones de vencimientos de ControlDoc envía automáticamente emails a los usuarios cuando:
- Tienen documentos requeridos que no han subido
- Tienen documentos próximos a vencer (7 días o menos)

## 🏗️ Arquitectura del Sistema

### Componentes Principales

1. **Backend Routes** (`backend/routes/notificationRoutes.js`)
   - Endpoint principal: `POST /api/notifications/send-expiration-notifications`
   - Endpoint de prueba: `GET /api/notifications/test`

2. **Email Service** (`backend/utils/emailService.js`)
   - Servicio centralizado para envío de emails
   - Configuración con Zoho SMTP

3. **Scripts de Automatización**
   - `backend/scripts/sendExpirationNotifications.js` - Script principal
   - `backend/scripts/cron-setup.js` - Configurador de cron

## 🚀 Configuración e Instalación

### 1. Variables de Entorno Requeridas

```bash
# Email configuration
ZOHO_EMAIL=tu-email@zoho.com
ZOHO_PASSWORD=tu-password

# API configuration
API_BASE_URL=http://localhost:3000
```

### 2. Instalación de Dependencias

```bash
cd backend
npm install node-fetch dotenv
```

### 3. Configuración del Cron Job

#### Opción A: Configuración Automática
```bash
cd backend
node scripts/cron-setup.js
```

#### Opción B: Configuración Manual
```bash
# Editar crontab
crontab -e

# Agregar línea (ejecutar todos los días a las 9:00 AM)
0 9 * * * cd /path/to/backend && node scripts/sendExpirationNotifications.js
```

## 📡 API Endpoints

### Enviar Notificaciones
```http
POST /api/notifications/send-expiration-notifications
Content-Type: application/json

{}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Notificaciones enviadas correctamente",
  "details": {
    "usuariosNotificados": 5,
    "documentosRequeridos": 12,
    "documentosSubidos": 8,
    "resumen": 3
  }
}
```

### Probar Sistema
```http
GET /api/notifications/test
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Sistema de notificaciones funcionando",
  "testData": {
    "tenants": 3,
    "documentosRequeridos": 12,
    "documentosSubidos": 8,
    "fecha": "2024-01-15T10:30:00.000Z"
  }
}
```

## 🔧 Uso del Sistema

### Ejecución Manual

#### 1. Probar el Sistema
```bash
cd backend
node scripts/sendExpirationNotifications.js test
```

#### 2. Enviar Notificaciones
```bash
cd backend
node scripts/sendExpirationNotifications.js send
```

#### 3. Usar API Directamente
```bash
curl -X POST http://localhost:3000/api/notifications/send-expiration-notifications
```

### Automatización

#### Configurar Cron Job
```bash
# Ejecutar todos los días a las 9:00 AM
0 9 * * * cd /path/to/backend && node scripts/sendExpirationNotifications.js

# Ejecutar solo los lunes a las 8:00 AM
0 8 * * 1 cd /path/to/backend && node scripts/sendExpirationNotifications.js

# Ejecutar lunes, miércoles y viernes a las 10:00 AM
0 10 * * 1,3,5 cd /path/to/backend && node scripts/sendExpirationNotifications.js
```

## 📧 Tipos de Notificaciones

### 1. Documentos Requeridos No Subidos
- **Trigger**: Documento en `requiredDocuments` con `archivoSubido: false`
- **Contenido**: Lista de documentos requeridos con fechas de vencimiento
- **Asunto**: "📌 ControlDoc - Notificación de vencimientos"

### 2. Documentos Próximos a Vencer
- **Trigger**: Documento en `uploadedDocuments` con vencimiento en 7 días o menos
- **Contenido**: Lista de documentos con días restantes
- **Asunto**: "📌 ControlDoc - Notificación de vencimientos"

### 3. Informe Administrativo
- **Destinatario**: `controldocumentarioapp@gmail.com`
- **Contenido**: Resumen de todas las notificaciones enviadas
- **Frecuencia**: Cada vez que se ejecuta el sistema

## 🏢 Compatibilidad Multi-Tenant

El sistema está diseñado para funcionar con la arquitectura multi-tenant de ControlDoc:

```
tenants/
├── tenant1/
│   ├── requiredDocuments/
│   └── uploadedDocuments/
├── tenant2/
│   ├── requiredDocuments/
│   └── uploadedDocuments/
└── ...
```

### Proceso de Consulta
1. Obtiene todos los tenants de la colección `tenants`
2. Consulta `requiredDocuments` y `uploadedDocuments` de cada tenant
3. Procesa y agrupa las notificaciones por email
4. Envía emails personalizados

## 🔍 Estructura de Datos

### Documento Requerido
```javascript
{
  name: "string",
  archivoSubido: boolean,
  expirationDate: Timestamp,
  createdFor: {
    realemail: "string"
  },
  companyName: "string"
}
```

### Documento Subido
```javascript
{
  documentName: "string",
  expirationDate: Timestamp,
  realemail: "string",
  companyName: "string"
}
```

## 🛠️ Mantenimiento y Monitoreo

### Logs del Sistema
```bash
# Ver logs del servidor
tail -f logs/server.log

# Ver logs de notificaciones
grep "notificaciones" logs/server.log
```

### Verificar Estado del Cron
```bash
# Listar cron jobs
crontab -l

# Verificar último ejecución
grep "sendExpirationNotifications" /var/log/cron
```

### Testing Regular
```bash
# Probar sistema semanalmente
node scripts/sendExpirationNotifications.js test
```

## 🚨 Solución de Problemas

### Error: "No se pudo conectar a la base de datos"
- Verificar variables de entorno de Firebase
- Comprobar conectividad de red
- Revisar credenciales de servicio

### Error: "No se pudieron enviar emails"
- Verificar configuración de Zoho SMTP
- Comprobar límites de envío
- Revisar logs de email

### Error: "No se encontraron tenants"
- Verificar que existan documentos en la colección `tenants`
- Comprobar permisos de lectura en Firestore

### Cron Job No Se Ejecuta
```bash
# Verificar que el cron esté corriendo
systemctl status cron

# Verificar permisos del script
chmod +x scripts/sendExpirationNotifications.js

# Probar ejecución manual
./scripts/sendExpirationNotifications.js
```

## 📈 Métricas y Reportes

### Métricas Disponibles
- Número de usuarios notificados
- Cantidad de documentos requeridos
- Cantidad de documentos próximos a vencer
- Tasa de éxito de envío de emails

### Reportes Automáticos
- Resumen diario enviado a `controldocumentarioapp@gmail.com`
- Logs detallados en consola del servidor
- Métricas de rendimiento en logs

## 🔒 Seguridad

### Consideraciones de Seguridad
- Emails enviados solo a direcciones válidas
- Validación de formato de email
- Rate limiting en envío de emails
- Logs de auditoría de todas las operaciones

### Permisos Requeridos
- Lectura en colecciones `tenants/*/requiredDocuments`
- Lectura en colecciones `tenants/*/uploadedDocuments`
- Envío de emails a través de Zoho SMTP

## 📞 Soporte

Para problemas o consultas sobre el sistema de notificaciones:

1. Revisar logs del servidor
2. Ejecutar test del sistema: `GET /api/notifications/test`
3. Verificar configuración de cron
4. Contactar al equipo de desarrollo

---

**Última actualización**: Enero 2024  
**Versión**: 1.0.0  
**Mantenido por**: Equipo ControlDoc
