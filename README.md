# ControlDoc v5 - Sistema Multi-Tenant de Gestión Documental

**ControlDoc v5** es un sistema completo de gestión documental empresarial con arquitectura multi-tenant, diseñado para empresas que necesitan control exhaustivo sobre documentos de empleados, vehículos, clientes y categorías personalizadas.

## 🎯 Características Principales

### 🏢 Sistema Multi-Tenant
- **Aislamiento completo de datos** por organización
- **Detección automática** de tenant por subdominio
- **Escalabilidad ilimitada** sin afectar rendimiento
- **Gestión centralizada** desde panel de administración
- **Migración automática** de datos existentes

### 👥 Gestión de Clientes y Subempresas
- **Empresas principales** pueden gestionar múltiples **clientes/subempresas**
- **Selector de empresa activa** para cambiar entre empresa principal y clientes
- **Documentos requeridos** asignables a empresa principal, todos los clientes o clientes específicos
- **Aprobación de clientes** por administrador (similar a empresas principales)
- **Protección por contraseña** para creación de clientes (`admin321`)
- **Filtrado automático** de datos según cliente seleccionado
- **Vista avanzada** con documentación por empresa y por entidad (empleados/vehículos)
- **Carga masiva** de documentos con soporte para clientes

### 📄 Gestión de Documentos
- **Subida de documentos** por tipo de entidad (Empresa, Empleado, Vehículo, Personalizado)
- **Conversión automática** a PDF (desde imágenes JPG/PNG o documentos Word)
- **Sistema completo de aprobación** con control de versiones
- **Control de vencimientos** con sistema de semáforo visual (verde, amarillo, rojo)
- **Notificaciones automáticas** de vencimientos próximos
- **Visor PDF avanzado** con OCR y detección automática de fechas
- **Aprobación masiva** con agrupación inteligente de páginas

### 🔍 Funcionalidades Avanzadas
- **Búsqueda avanzada** con resaltado de resultados
- **Filtros combinados** por tipo, entidad, estado, vencimiento
- **Vista avanzada** del dashboard con tablas profesionales
- **Personalización de tema** (colores corporativos, fondos, contraste automático)
- **OCR inteligente** para extracción de texto y fechas de PDFs
- **Optimización automática** de imágenes

---

## 🚀 Stack Tecnológico

### Frontend
- **React 18** + **Vite** (build tool)
- **Material-UI (MUI)** v5 para componentes UI
- **TanStack Query** (React Query) para gestión de estado y caché
- **Firebase Auth** + **Firestore** para autenticación y base de datos
- **PDF.js** para visualización de PDFs
- **Tesseract.js** para OCR
- **React Router Dom** v7 para navegación

### Backend
- **Express.js** (Node.js)
- **Firebase Admin SDK** para operaciones administrativas
- **Backblaze B2** para almacenamiento de archivos
- **JWT** para autenticación de API
- **Sharp** para optimización de imágenes
- **PDF-lib** y **pdf-poppler** para manipulación de PDFs
- **Nodemailer** para notificaciones por email

### Infraestructura
- **Firestore** (NoSQL) como base de datos principal
- **Backblaze B2** para almacenamiento de archivos
- **Render** para hosting del backend
- **Vercel** para hosting del frontend
- **Docker** para contenedores (opcional)

---

## 📂 Estructura del Proyecto

```
controldocv5/
├── src/                          # Frontend React
│   ├── components/              # Componentes reutilizables
│   │   ├── common/              # Componentes comunes (botones, modales, tablas)
│   │   └── charts/              # Gráficos y visualizaciones
│   ├── entidad/                 # Componentes por entidad
│   │   ├── adm/                 # Panel administrativo
│   │   │   ├── dashboard/      # Dashboard admin
│   │   │   ├── DocumentoRequerido/  # Gestión de documentos requeridos
│   │   │   └── AdminPanel/     # Panel de gestión de empresas
│   │   ├── user/                # Vista de usuario
│   │   │   ├── components/     # Componentes del dashboard usuario
│   │   │   │   ├── CompanySelector.jsx    # Selector de empresa/cliente
│   │   │   │   ├── ClientManagement.jsx  # Gestión de clientes
│   │   │   │   └── hooks/      # Hooks personalizados
│   │   │   ├── EmpresaPanel/  # Panel de documentos de empresa
│   │   │   ├── PersonalPanel/  # Panel de personal/empleados
│   │   │   └── VehiculosPanel/ # Panel de vehículos
│   │   └── public/             # Vistas públicas (login, registro)
│   ├── context/                # Contextos React (Auth, Empresas, Tenant)
│   ├── hooks/                  # Custom hooks (documentos, auth, tenant)
│   ├── router/                 # Configuración de rutas protegidas
│   ├── utils/                  # Utilidades (vencimientos, validaciones, tenant)
│   └── config/                 # Configuración Firebase
│
├── backend/                     # Backend Express
│   ├── routes/                 # Endpoints API
│   │   ├── upload.js          # Subida de archivos
│   │   ├── adminRoutes.js     # Aprobación/rechazo de documentos
│   │   ├── tenantRoutes.js    # Gestión de tenants
│   │   └── backupRoutes.js    # Backups automáticos
│   ├── middleware/            # Autenticación JWT, roles, tenant
│   ├── services/              # Servicios (Backblaze, PDF, Firestore)
│   ├── scripts/               # Migraciones y cron jobs
│   │   ├── migrateToMultiTenant.js
│   │   └── migrateCompaniesToParentClient.js
│   └── utils/                 # Utilidades tenant, email, logs
│
└── docs/                       # Documentación técnica
    ├── ARQUITECTURA_CLIENTES.md         # Arquitectura de clientes y subempresas
    ├── MIGRACION_CLIENTES_Y_SCRIPTS.md  # Scripts de migración y gestión
    ├── FLUJO_APROBACION_DOCUMENTOS.md
    ├── SISTEMA_VERSIONES_Y_TIMESTAMPS.md
    └── PERSONALIZACION_TEMA_Y_VISTAS_AVANZADAS.md
```

---

## 🏗️ Arquitectura Multi-Tenant

### Estructura de URLs
- `https://controldoc.app` → Tenant principal
- `https://empresa1.controldoc.app` → Tenant para empresa1
- `https://cliente2.controldoc.app` → Tenant para cliente2

### Estructura en Firestore

```
/tenants/{tenantId}/
├── companies/              # Empresas del tenant
│   ├── {companyId}/       # Empresa principal
│   │   ├── type: "main"
│   │   ├── parentCompanyId: null
│   │   └── active: true
│   └── {clientId}/        # Cliente/subempresa
│       ├── type: "client"
│       ├── parentCompanyId: "{companyId}"
│       └── active: true
├── users/                 # Usuarios del tenant
├── uploadedDocuments/     # Documentos subidos
│   └── clientId: null | "{clientId}"  # Asignación a cliente
├── requiredDocuments/     # Documentos requeridos
│   └── appliesTo: {      # Aplicación a empresas/clientes
│       main: true/false,
│       clients: null | [] | ["clientId1", "clientId2"]
│   }
├── personal/              # Personal/empleados
├── vehiculos/             # Vehículos
└── logs/                  # Logs del tenant
```

---

## 🔐 Sistema de Autenticación y Roles

### Roles Implementados
- **Superadmin**: Gestión de tenants y acceso total al sistema
- **Admin**: Aprobación de documentos, gestión de empresas y usuarios
- **User**: Subida de documentos y consultas (usuarios de empresas)

### Flujo de Autenticación
1. **Login** con Firebase Auth (email/contraseña)
2. **Verificación de tenant** por subdominio
3. **Generación de JWT** para backend
4. **Middleware de protección** en todas las rutas

---

## ⚙️ Instalación y Configuración

### Requisitos Previos
- Node.js >= 18.0.0
- npm o yarn
- Cuenta de Firebase
- Cuenta de Backblaze B2
- Cuenta de Render (backend) y Vercel (frontend)

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd controldocv5
```

### 2. Instalar Dependencias

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd backend
npm install
```

### 3. Configurar Variables de Entorno

**Frontend (.env en la raíz):**
```bash
VITE_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Backend (.env en backend/):**
```bash
# Firebase Admin
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'

# Backblaze B2
B2_KEY_ID=your_b2_key_id
B2_APPLICATION_KEY=your_b2_application_key
B2_BUCKET_NAME=your_bucket_name

# JWT
JWT_SECRET=your_jwt_secret
ADMIN_ROLE=DhHkVja

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://controldoc.app,https://*.controldoc.app
```

### 4. Ejecutar en Desarrollo

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
npm run dev
```

O ejecutar ambos simultáneamente:
```bash
npm run dev
```

---

## 🚀 Funcionalidades Detalladas

### 👥 Gestión de Clientes/Subempresas

Las empresas principales pueden crear y gestionar múltiples clientes:

1. **Crear Cliente**: 
   - Clic en "Agregar Cliente" (requiere contraseña: `admin321`)
   - Ingresar nombre del cliente
   - El cliente queda en estado "pending" hasta aprobación del admin

2. **Selector de Empresa Activa**:
   - Dropdown en el dashboard para cambiar entre empresa principal y clientes
   - Los documentos mostrados se filtran según la empresa activa seleccionada

3. **Asignación de Documentos Requeridos**:
   - Al crear un documento requerido, se puede asignar a:
     - Empresa principal únicamente
     - Todos los clientes
     - Clientes específicos (selección múltiple)

4. **Aprobación de Clientes**:
   - Los clientes aparecen en `/admin/company-approvals`
   - Se muestran con chip "Cliente" y nombre de empresa padre
   - Aparecen en notificaciones del admin

### 📄 Sistema de Documentos

#### Subida de Documentos
- **Tipos soportados**: PDF, JPG, JPEG, PNG, DOC, DOCX
- **Conversión automática**: Imágenes y Word se convierten a PDF
- **Optimización**: Imágenes se optimizan automáticamente
- **Metadata**: Se guarda `clientId` para identificar a qué cliente pertenece

#### Aprobación de Documentos
- **Estados**: Pendiente → En proceso → Aprobado/Rechazado
- **Control de versiones**: Cada aprobación incrementa la versión
- **Comentarios**: Admin puede agregar comentarios al aprobar/rechazar
- **Trazabilidad**: Se registra quién y cuándo aprobó/rechazó

#### Visor PDF Avanzado
- **Detección automática de fechas** con OCR
- **Selección interactiva** de fechas para asignar vencimientos
- **Agrupación de páginas** para aprobación masiva
- **Detección de páginas similares** con aplicación automática de fechas

### 🔍 Búsqueda y Filtros

- **Búsqueda por texto** en nombres de documentos
- **Filtros por**:
  - Tipo de entidad (Empresa, Empleado, Vehículo, Personalizado)
  - Estado (Pendiente, Aprobado, Rechazado)
  - Vencimiento (Vencido, Próximo, Sin vencimiento)
  - Empresa/Cliente activo

### 📊 Dashboard Avanzado

- **Vista estándar**: Cards con documentos organizados
- **Vista avanzada**: Tablas profesionales con:
  - Ordenamiento por columnas
  - Filtros combinados
  - Acciones rápidas (aprobar, rechazar, descargar)
  - Indicadores visuales de estado

---

## 🔧 Scripts Disponibles

### Desarrollo
```bash
npm run dev              # Ejecuta frontend y backend simultáneamente
npm run clean-ports      # Limpia puertos ocupados
npm run fix-emotion      # Corrige problemas de Emotion (MUI)
```

### Build
```bash
npm run build            # Build de producción
npm run preview          # Preview del build
npm run vercel-build     # Build para Vercel
```

### Migraciones
```bash
# Migrar a sistema multi-tenant
cd backend
node scripts/migrateToMultiTenant.js migrate

# Migrar empresas a estructura de clientes
node scripts/migrateCompaniesToParentClient.js

# Crear nuevo tenant
node scripts/migrateToMultiTenant.js create-tenant empresa1 "Nombre" "Descripción"
```

---

## 📚 Documentación Adicional

Para información detallada sobre funcionalidades específicas:

- **[Flujo de Aprobación de Documentos](./docs/FLUJO_APROBACION_DOCUMENTOS.md)** - Explicación completa del ciclo de aprobación
- **[Sistema de Versiones y Timestamps](./docs/SISTEMA_VERSIONES_Y_TIMESTAMPS.md)** - Control de versiones y auditoría
- **[Personalización de Tema](./docs/PERSONALIZACION_TEMA_Y_VISTAS_AVANZADAS.md)** - Configuración visual y vistas avanzadas
- **[Registro de Superadministrador](./docs/SUPERADMIN_REGISTRATION.md)** - Gestión de roles máximos
- **[Sistema de Notificaciones](./docs/SISTEMA_NOTIFICACIONES_VENCIMIENTOS.md)** - Notificaciones automáticas

---

## 🔒 Seguridad

### Implementaciones de Seguridad
- **Autenticación JWT** en todos los endpoints del backend
- **Validación de roles** (solo admins pueden aprobar documentos)
- **Aislamiento de datos** por tenant (multi-tenant)
- **Protección de rutas** frontend mediante `AuthContext`
- **Rate limiting** para prevenir abuso
- **Validación de CUIT** única por tenant
- **Contraseña para creación de clientes** (`admin321`)

### Mejores Prácticas
- Nunca exponer credenciales en el código
- Usar variables de entorno para configuración sensible
- Validar todos los inputs del usuario
- Mantener logs de auditoría de acciones importantes

---

## 🗺️ Roadmap

### ✅ Completado
- Sistema multi-tenant completo
- Gestión de clientes/subempresas
- Sistema de aprobación con versiones
- Visor PDF con OCR
- Aprobación masiva de documentos
- Personalización de tema
- Vista avanzada del dashboard
- Notificaciones de vencimientos

### 🔜 Próximas Funcionalidades
- Integración con AFIP / Firma digital
- App móvil (React Native)
- Módulo de auditoría y reportes descargables (PDF)
- Exportación masiva de documentos
- API pública para integraciones

---

## 🤝 Contribución

Este es un proyecto privado. Para contribuciones o sugerencias, contactar al equipo de desarrollo.

---

## 📝 Licencia

Proyecto privado - Todos los derechos reservados

---

## 👨‍💻 Autor

**ControlDoc v5** - Sistema de Gestión Documental Empresarial

Desarrollado por **Fernando Vidal**

Última actualización: **Enero 2025**

---

## 📞 Soporte

Para soporte técnico o consultas:
- Revisar la documentación en `/docs`
- Contactar al equipo de desarrollo

---

## 🎉 Agradecimientos

Gracias a todas las tecnologías open-source que hacen posible este proyecto:
- React, Vite, Material-UI
- Firebase, Express.js
- Y todas las librerías y herramientas utilizadas
