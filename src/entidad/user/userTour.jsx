// src/entidad/user/userTour.jsx

/**
 * Pasos del tour virtual para el dashboard de usuario.
 * Asegúrate de que los elementos tengan los IDs correspondientes en el DOM.
 */
const TIP = "<br/><span style='font-size:0.9em;color:#888;'>TIP: Usa las flechas ← → o la barra espaciadora para avanzar el tour.</span>";
const pasosTour = [
  {
    element: "#user-dashboard-title",
    popover: {
      title: "Bienvenido a ControlDoc",
      description: "Este es tu panel principal para gestionar tus documentos y datos de empresa." + TIP,
      position: "bottom",
    },
  },
  {
    element: "#user-dashboard-company-status",
    popover: {
      title: "Estado de la empresa",
      description: "Aquí puedes ver el estado general de tu empresa y su documentación.",
      position: "bottom",
    },
  },
  {
    element: "#user-dashboard-tabs",
    popover: {
      title: "Navegación por secciones",
      description: "Usa estas pestañas para acceder a la documentacíonde cada categoría.",
      position: "bottom",
    },
  },
  {
    element: "#user-dashboard-panel-documentos",
    popover: {
      title: "Tus Documentos",
      description: "Aquí puedes ver y subir los documentos requeridos para tu empresa.",
      position: "top",
    },
  },
  {
    element: "#user-dashboard-tab-empresa",
    popover: {
      title: "Documentos de Empresa",
      description: "Documentacion requerida para la empresa.",
      position: "top",
    },
  },
  
  {
    element: "#user-dashboard-tab-vehiculos",
    popover: {
      title: "Vehículos",
      description: "Gestiona los documentos y datos de tus vehículos desde esta sección.",
      position: "top",
    },
  },
  {
    element: "#user-vehicle-form-paper",
    popover: {
      title: "Agrega tus vehiculos",
      description: "Agrega vehiculos activos.",
      position: "top",
    },
  },
 
  {
    element: "#user-dashboard-tab-personal",
    popover: {
      title: "Personal",
      description: "Gestiona los documentos y datos del personal de tu empresa aquí.",
      position: "top",
    },
  },
  {
    element: "#user-personal-form-paper",
    popover: {
      title: "Agrega los trabajadores",
      description: "Agrega trabajadores activos.",
      position: "top",
    },
  },
  {
    element: "#user-dashboard-advanced-toggle",
    popover: {
      title: "Vista avanzada (opcional)",
      description: "Activa esta vista para trabajar con tablas profesionales, filtros y ordenamiento. Puedes volver a la vista clásica cuando quieras.",
      position: "left",
    },
  },
  {
    element: "#user-dashboard-advanced-tabs",
    popover: {
      title: "Vistas avanzadas",
      description: "Alterna entre los documentos de empresa y los documentos por entidad con un estilo similar a la vista clásica.",
      position: "bottom",
    },
  },
  {
    element: "#user-dashboard-panel-advanced",
    popover: {
      title: "Tablas avanzadas",
      description: "Explora y ordena la información con filtros personalizados y acciones rápidas sobre cada documento.",
      position: "top",
    },
  },
];

export default pasosTour;
  
  