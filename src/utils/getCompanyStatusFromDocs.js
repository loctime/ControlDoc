import { parseFirestoreDate } from "../utils/dateHelpers";
// No importar componentes JSX aquí
// import { Cancel, Warning, CheckCircle } from "@mui/icons-material";

/**
 * Evalúa el estado general de una empresa según sus documentos subidos.
 * Devuelve el estado (string), color (string), y una indicación para el ícono.
 *
 * @param {Array} docsEmpresa - Lista de documentos asociados a la empresa.
 * @returns {{ estado: string, color: string, iconName: string, vencido: boolean, porVencer: boolean }}
 */
export function getCompanyStatusFromDocs(docsEmpresa) {
  const hoy = new Date();
  const requeridos = {};

  // Agrupar documentos por nombre
  docsEmpresa.forEach(doc => {
    if (!requeridos[doc.name]) requeridos[doc.name] = [];
    requeridos[doc.name].push(doc);
  });

  let tieneVencidos = false;

  // Verificar si cada conjunto de documentos tiene alguno vigente
  Object.values(requeridos).forEach(docs => {
    let expDate = null;
    docs.forEach(doc => {
      const parsed = parseFirestoreDate(doc.expirationDate);
      if (parsed && (!expDate || parsed > expDate)) expDate = parsed;
    });

    // Si no hay ninguno vigente ni aprobado válido => deshabilitada
    if (expDate && expDate >= hoy) return;

    const aprobadoVigente = docs.some(doc =>
      doc.status === "Aprobado" &&
      parseFirestoreDate(doc.expirationDate) >= hoy
    );

    if (!aprobadoVigente) tieneVencidos = true;
  });

  // Detectar si alguno está por vencer
  const tienePorVencer = docsEmpresa.some(d =>
    d.diasRestantes !== null &&
    d.diasRestantes <= 10 &&
    d.diasRestantes >= 0
  );

  // --- Resultado final ---
  if (tieneVencidos || docsEmpresa.length === 0) {
    return {
      estado: "Deshabilitada",
      color: "error",
      iconName: "Cancel", // Devolver solo el nombre del ícono
      vencido: true,
      porVencer: tienePorVencer
    };
  }

  if (tienePorVencer) {
    return {
      estado: "En riesgo",
      color: "warning",
      iconName: "Warning", // Devolver solo el nombre del ícono
      vencido: false,
      porVencer: true
    };
  }

  return {
    estado: "Habilitada",
    color: "success",
    iconName: "CheckCircle", // Devolver solo el nombre del ícono
    vencido: false,
    porVencer: false
  };
}
