// src/entidad/adm/DocumentoRequerido/requiredTour.jsx

/**
 * Pasos del tour virtual para la gestión de documentos requeridos.
 * Asegúrate de que los elementos tengan los IDs correspondientes en el DOM.
 */
const TIP = "<br/><span style='font-size:0.9em;color:#888;'>TIP: Usa las flechas ← → o la barra espaciadora para avanzar el tour.</span>";
const pasosTour = [
    {
        element: "#menu-documentos-requeridos, #tour-titulo-docs, #tour-subtitulo-nuevo-doc",
        popover: {
          title: "Documentos Requeridos",
          description: "Aquí accedes y gestionas los documentos requeridos, y puedes añadir uno nuevo." + TIP,
          position: "bottom",
        },
      },
    {
      element: "#adm-required-docs-company-selector",
      popover: {
        title: "Selector de empresas",
        description: "Elije la empresa para crear requeridos.",
        position: "bottom",
      },
    },
    {
      element: "#adm-required-docs-select-nombre",
      popover: {
        title: "Nombre del documento",
        description: "Selecciona un nombre de la lista.",
        position: "right",
      },
    },
    {
        element: "#adm-required-docs-select-entitytype",
        popover: {
          title: "Tipo de documento",
          description: "Selecciona una categoria de la lista.",
          position: "right",
        },
      },
    {
      element: "#adm-required-docs-expiration",
      popover: {
        title: "Fecha de vencimiento",
        description: "Asigna una fecha limite para que el documento sea subido.",
        position: "right",
      },
    },
      {
        element: "#adm-required-docs-example-uploader",
        popover: {
          title: "Formulario",
          description: "Selecciona un archivo de ejemplo. Puede seleccionarse desde el almacenamiento interno de ControlDoc",
          position: "right",
        },
      },
    {
      element: "#adm-required-docs-template-btns",
      popover: {
        title: "Plantillas",
        description: "Puedes crear una plantilla de los documentos requeridos actuales, o elejir una plantilla para aplicar a la empresa seleccionada.",
        position: "top",
      },
    },
  ];
  
  export default pasosTour;
  
  