# 🧱 Nombre de la App

**ControlDoc v2**

----

## 🎯 Descripción general

Sistema multi-tenant de gestión documental empresarial que permite subir, aprobar, versionar y controlar vencimientos de documentos de forma centralizada. Diseñado para empresas que necesitan control exhaustivo sobre documentos de empleados, vehículos y categorías personalizadas, con aislamiento completo de datos por organización.

---

## ⚙️ Principales funcionalidades

- **Sistema Multi-Tenant**: Múltiples clientes en una misma aplicación con datos completamente aislados por subdominio
- **Gestión de documentos por entidad**: Empresas, empleados, vehículos y categorías personalizadas
- **Flujo de aprobación completo**: Sistema de aprobación/rechazo con control de versiones y trazabilidad
- **Visor PDF inteligente**: Detección automática de fechas con OCR, agrupación de páginas y aplicación masiva de vencimientos
- **Conversión automática**: Imágenes y Word a PDF, con optimización y generación de miniaturas
- **Control de vencimientos**: Sistema de semáforo visual (verde, amarillo, rojo) con notificaciones automáticas
- **Búsqueda avanzada**: Con resaltado de resultados y filtros por tipo, entidad, estado o vencimiento
- **Historial y auditoría**: Logs completos de acciones, versiones históricas y backup automático

---

## 🧩 Stack tecnológico

**Frontend:**
- React 18 + Vite
- Material-UI (@mui/material)
- Firebase Auth + Firestore
- PDF.js (pdfjs-dist) para visualización
- Tesseract.js para OCR
- React Router Dom v7

**Backend:**
- Express (Node.js)
- Firebase Admin SDK
- Backblaze B2 (almacenamiento)
- JWT para autenticación
- LibreOffice + ImageMagick (conversión)
- Sharp (optimización de imágenes)
- Nodemailer (notificaciones)

**Infraestructura:**
- Deploy: Render (backend) + Vercel (frontend)
- Base de datos: Firestore (NoSQL)
- Contenedores: Docker
- DNS: Wildcard subdomain support

---

## 🧑‍💻 Estructura del proyecto

```
controldocv5/
├── src/                          # Frontend React
│   ├── components/               # Componentes reutilizables
│   ├── entidad/                  # Componentes por entidad
│   │   ├── adm/                  # Panel administrativo
│   │   ├── user/                 # Vista de usuario
│   │   └── public/               # Vistas públicas
│   ├── context/                  # Contextos (Auth, Empresas, Tenant)
│   ├── hooks/                    # Custom hooks (documentos, auth, tenant)
│   ├── router/                   # Configuración de rutas protegidas
│   ├── utils/                    # Utilidades (vencimientos, validaciones, tenant)
│   └── config/                   # Configuración Firebase
│
├── backend/                      # Backend Express
│   ├── routes/                   # Endpoints API
│   │   ├── upload.js             # Subida de archivos
│   │   ├── adminRoutes.js        # Aprobación/rechazo
│   │   ├── tenantRoutes.js       # Gestión de tenants
│   │   └── backupRoutes.js       # Backups automáticos
│   ├── middleware/               # Autenticación JWT, roles, tenant
│   ├── services/                 # Backblaze, PDF, Firestore
│   ├── scripts/                  # Migraciones y cron jobs
│   └── utils/                    # Utilidades tenant, email, logs
│
└── docs/                         # Documentación técnica
```

---

## 🔐 Autenticación / Roles

**Sistema de autenticación:**
- Firebase Authentication (email/contraseña)
- JWT tokens para backend
- Middleware de verificación en cada endpoint

**Roles implementados:**
- **Superadmin**: Gestión de tenants y acceso total
- **Admin**: Aprobación de documentos, gestión de empresas y usuarios
- **Empresa/Usuario**: Subida de documentos y consultas

**Gestión de tenants:**
- Detección automática por subdominio (`empresa1.controldoc.app`)
- Aislamiento completo de datos en Firestore por `tenantId`
- Panel de administración para crear/gestionar tenants

---

## 🔗 Integraciones

**Almacenamiento:**
- Backblaze B2 para archivos (documentos, imágenes, PDFs)
- Firebase Storage para miniaturas y cache

**Conversión de archivos:**
- LibreOffice (Word/Excel a PDF)
- ImageMagick (imágenes a PDF)
- Sharp (optimización de imágenes)

**OCR y procesamiento:**
- Tesseract.js (detección de fechas en PDFs)
- pdf-parse (extracción de texto)
- pdf-lib (manipulación de PDFs)

**Notificaciones:**
- Nodemailer (emails de vencimiento)
- Sistema de notificaciones en tiempo real con Firestore

**APIs externas (roadmap):**
- AFIP (firma digital)
- WhatsApp Business API (notificaciones)

---

## 🧾 Planes / Modelo de uso

**Modelo actual: SaaS Multi-Tenant**

- **Tenant principal**: Acceso completo para desarrollador
- **Tenants personalizados**: Un tenant por cada cliente/organización
- **Escalabilidad**: Sin límites de tenants

**Próximos planes:**
- Freemium: Tenant básico con límite de documentos
- Pro: Tenant ilimitado con OCR y notificaciones
- Enterprise: Tenants múltiples + integración AFIP + app móvil

---

## 🚀 Pendientes o mejoras planificadas

**Q1 2025:**
- ✅ Sistema multi-tenant completo
- ✅ Visor PDF con detección automática de fechas
- ✅ Aprobación masiva de documentos
- ✅ OCR y búsqueda avanzada

**Q2-Q3 2025:**
- 🔜 Integración con AFIP para firma digital
- 🔜 App móvil (React Native) para usuarios
- 🔜 Módulo de auditoría y reportes descargables
- 🔜 Panel de analytics y métricas por tenant
- 🔜 Sistema de notificaciones por WhatsApp
- 🔜 API pública para integraciones

**Q4 2025:**
- 🔜 Marketplace de plugins/integraciones
- 🔜 IA para clasificación automática de documentos
- 🔜 Flujos de trabajo personalizables

---

## 📧 Contacto

**Desarrollado por:** Fernando Vidal  
**Última actualización:** Diciembre 2025  
**Versión:** 2.0  
**Estado:** ✅ Producción  
**Demo:** [controldoc.app](https://controldoc.app)






