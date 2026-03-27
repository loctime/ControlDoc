export const ENTITY_TYPE_LABELS = {
  company: "Empresa",
  employee: "Personal",
  personal: "Personal",
  vehicle: "Vehículo",
  fleet: "Flota",
  custom: "Personalizado",
};

export const STATUS_COLOR_MAP = {
  aprobado: "success",
  rechado: "error",
  rechazado: "error",
  "en proceso": "warning",
  subido: "info",
  pendiente: "default",
  "pendiente de revisión": "info",
};

export const normalizeStatus = (status) =>
  (status || "")
    .toString()
    .trim()
    .toLowerCase();

export const resolveDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const buildSubtitleSegments = ({ entityName, entityTypeLabel, statusLabel, expirationLabel }) =>
  [
    entityTypeLabel ? `${entityName} · ${entityTypeLabel}` : entityName,
    statusLabel ? `Estado: ${statusLabel}` : null,
    expirationLabel ? `Vence: ${expirationLabel}` : null,
  ].filter(Boolean);

export const formatExpiration = (expirationDate) =>
  expirationDate
    ? expirationDate.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

export const formatLatestUpdate = (date) =>
  date
    ? date.toLocaleString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

export const buildMailtoHref = ({ contactEmail, contactName, documentName }) =>
  contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(
        `Consulta sobre documento ${documentName || ""}`
      )}&body=${encodeURIComponent(
        `Hola ${contactName || "administrador"},\n\nNecesito actualizar el documento "${documentName ||
          ""}". ¿Podrías revisar el estado actual y liberarlo? Gracias.`
      )}`
    : null;


