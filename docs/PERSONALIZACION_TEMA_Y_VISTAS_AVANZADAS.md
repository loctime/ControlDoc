# 🎨 Personalización de Tema y Vistas Avanzadas

Este documento cubre las mejoras introducidas desde el commit `9962caf`, enfocadas en la experiencia visual y operativa tanto para administradores como para usuarios finales.

---

## 1. Personalización Dinámica de Tema

- **Entrada principal**: `ColorPicker` dentro del menú lateral de administración (`src/components/ColorPicker.jsx`).
- **Persistencia**: Cada color se guarda en `localStorage` (`primary-main`, `background-default`, `page-background`, etc.).
- **Propagación**:
  - Se actualizan variables CSS en `:root`.
  - `DynamicThemeProvider` (`src/components/DynamicThemeProvider.jsx`) recalcula el tema MUI usando `createDynamicTheme` (`src/config/theme.js`).
  - Componentes como `DrawerMenu` responden a cambios para ajustar contraste automáticamente.
- **Colores derivados**: Se calculan variantes `--primary-dark`, `--primary-light` y colores de texto asociados para asegurar contraste.
- **Reset rápido**: Mantener pulsado `Shift` al seleccionar un tema predefinido repone los valores originales (comportamiento del `ColorPicker`).

### Variables clave afectadas

| Variable CSS | Uso principal | Valor derivado |
|--------------|---------------|----------------|
| `--primary-main` | Color corporativo | Calcula `--primary-dark/light`, `--primary-text` |
| `--paper-background` | Fondo de tarjetas | Ajusta `--paper-background-text` y paleta `text` |
| `--page-background` | Fondo general | Define `--tab-active-text` y `--divider-color` |

---

## 2. Vista Avanzada del Dashboard de Usuario

- **Activación**: Botón `Vista avanzada` en `UsuarioDashboard` (`src/entidad/user/UsuarioDashboard.jsx`).
- **Componentes base**:
  - `AdvancedDashboardView` (`src/entidad/user/AdvancedDashboard/AdvancedDashboardView.jsx`)
  - `SuperTable` (`src/components/common/superTable.jsx`) con ordenamiento, filtros y acciones por fila.
- **Características destacadas**:
  - Tablas separadas para documentos de empresa y por entidad.
  - Filtros combinados: estado, categoría, entidad, documento y búsqueda textual.
  - Acceso rápido a modales de gestión (`ModalDocument`) con refresco automático tras subir o actualizar archivos.
- **Tour actualizado**: `userTour.jsx` incorpora pasos específicos para la vista avanzada.

---

## 3. Indicadores y Métricas Refinadas

- **Componente**: `CompanyStatusBadge` (`src/entidad/user/components/CompanyStatusBadge.jsx`)
  - Clasifica documentos vencidos, rechazados, por vencer y pendientes.
  - Construye tooltips con detalle por documento y entidad.
  - Ajusta coloración según severidad máxima detectada para la empresa.
- **Visualización**: `DocumentStatusChart` (`src/components/charts/DocumentStatusChart.jsx`)
  - Usa la nueva paleta dinámica (`var(--paper-background)` y `var(--paper-background-text)`).
  - Presenta versión compacta y detallada con porcentajes y chips por estado.

---

## 4. Formularios de Documentos Requeridos (Administración)

Archivo principal: `src/entidad/adm/DocumentoRequerido/FormularioNuevoDocumento.jsx`.

### Novedades

- **Soporte multi-tenant**: Todas las consultas usan `getTenantCollectionPath` para mantener el aislamiento.
- **Gestión de catálogos**:
  - Alta/baja de nombres de documento disponibles desde Firestore.
  - Diálogo masivo `BulkAddDocumentNamesDialog` para importar listas en bloque.
- **Ejemplos y comentarios**:
  - `ExampleUploader` permite subir ejemplos con vista previa (`VistaPrevia`).
  - Recupera automáticamente ejemplos existentes si el nombre ya está definido.
- **Controles de acceso**:
  - Operaciones críticas (alta/baja de nombres) restringidas a superadministradores (`role === 'max'`).

### Flujo resumido

1. Administrador selecciona entidad (empresa, personal, vehículo o personalizada).
2. Elige/crea nombre desde catálogo multi-tenant.
3. Opcionalmente carga imagen de ejemplo y comentario guía.
4. Define vencimiento y guarda; el sistema valida duplicados y persistencia correspondiente.

---

## 5. Recomendaciones

- **Testing**: Verificar contraste tras aplicar temas oscuros y claridad de chips/indicadores.
- **Comunicación**: Informar a usuarios finales sobre la nueva vista avanzada y cómo activarla.
- **Backups**: Respaldar colecciones `documentNames` y `requiredDocuments` antes de operaciones masivas.

---

**Última actualización**: Noviembre 2025  
**Responsable**: Equipo ControlDoc

