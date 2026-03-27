/**
 * Bulk Upload V2 — Motor de sugerencias para vehículos.
 * Patente: detección y normalización. Vehículo: búsqueda por patente. Requerido: scoring por similitud con exampleMetadata.
 */
import { db } from '../firebaseconfig.js';

const PATENTE_PATTERNS = [
  /\b[A-Z]{2,3}\s?\d{3}[A-Z]{0,3}\b/gi,
  /\b[A-Z]{2}\d{3}[A-Z]{2}\b/gi,
  /\b\d{3}[A-Z]{3}\b/gi
];

/**
 * Normaliza patente: mayúsculas, sin espacios ni guiones.
 */
export function normalizePatente(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/\s/g, '').replace(/-/g, '').toUpperCase();
}

/**
 * Detecta patentes en texto y devuelve array normalizado (sin duplicados).
 */
export function detectPatentes(text) {
  if (!text) return [];
  const found = new Set();
  for (const re of PATENTE_PATTERNS) {
    const matches = text.match(re);
    if (matches) {
      matches.forEach((m) => found.add(normalizePatente(m)));
    }
  }
  return [...found];
}

/**
 * Detecta fechas y números en texto (para analysis.detected).
 */
export function detectDatesAndNumbers(text) {
  const detected = { fechas: [], numbers: [] };
  if (!text) return detected;
  const fechaRe = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g;
  const matches = text.match(fechaRe);
  if (matches) detected.fechas = [...new Set(matches)];
  const numRe = /\b\d{4,}\b/g;
  const numMatch = text.match(numRe);
  if (numMatch) detected.numbers = numMatch.slice(0, 20);
  return detected;
}

/**
 * Busca vehículos por patente. Filtra activo, companyId, clientId si aplica.
 * @returns { vehicleCandidates: Array<{ id, patente, ... }>, suggestedVehicleId: string|null, confidenceVehicle: 'high'|'med'|'low' }
 */
export async function suggestVehicle(db, tenantId, companyId, clientId, patenteNormalized) {
  if (!patenteNormalized || !companyId) {
    return { vehicleCandidates: [], suggestedVehicleId: null, confidenceVehicle: 'low' };
  }
  const vehiculosPath = `tenants/${tenantId}/vehiculos`;
  const snapshot = await db.collection(vehiculosPath)
    .where('companyId', '==', companyId)
    .limit(50)
    .get();
  const candidates = [];
  for (const doc of snapshot.docs) {
    const d = doc.data();
    if (d.activo === false) continue;
    if (clientId != null && clientId !== '' && d.clientId !== clientId) continue;
    const p = normalizePatente(d.patente || '');
    if (p && (p === patenteNormalized || p.includes(patenteNormalized) || patenteNormalized.includes(p))) {
      candidates.push({ id: doc.id, ...d });
    }
  }
  let suggestedVehicleId = null;
  let confidenceVehicle = 'low';
  if (candidates.length === 1) {
    suggestedVehicleId = candidates[0].id;
    confidenceVehicle = 'high';
  } else if (candidates.length > 1) {
    suggestedVehicleId = candidates[0].id;
    confidenceVehicle = 'med';
  }
  return { vehicleCandidates: candidates, suggestedVehicleId, confidenceVehicle };
}

/**
 * Similitud Jaccard simple entre dos textos.
 */
function compareTexts(text1, text2) {
  if (!text1 || !text2) return 0;
  const w1 = new Set(text1.toLowerCase().trim().split(/\s+/).filter(Boolean));
  const w2 = new Set(text2.toLowerCase().trim().split(/\s+/).filter(Boolean));
  const inter = [...w1].filter((w) => w2.has(w)).length;
  const union = new Set([...w1, ...w2]).size;
  return union > 0 ? inter / union : 0;
}

/**
 * Sugiere documento requerido (entityType vehicle). Scoring por exampleMetadata.text.
 * @returns { requiredCandidates: Array<{ id, name, score }>, suggestedRequiredId: string|null, confidenceRequired: number }
 */
export async function suggestRequired(db, tenantId, companyId, clientId, ocrText) {
  const requiredPath = `tenants/${tenantId}/requiredDocuments`;
  const snapshot = await db.collection(requiredPath)
    .where('companyId', '==', companyId)
    .where('entityType', 'in', ['vehicle', 'vehiculo'])
    .limit(50)
    .get();
  const vehicleDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const withExample = vehicleDocs.filter((d) => d.exampleMetadata?.text || d.exampleImage);
  const scored = [];
  const ocr = (ocrText || '').trim();
  for (const doc of withExample) {
    const exampleText = doc.exampleMetadata?.text || '';
    const score = exampleText ? compareTexts(ocr, exampleText) : 0;
    scored.push({ id: doc.id, name: doc.name || doc.id, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top5 = scored.slice(0, 5);
  const suggestedRequiredId = top5.length > 0 ? top5[0].id : null;
  const confidenceRequired = top5.length > 0 ? top5[0].score : 0;
  return {
    requiredCandidates: top5,
    suggestedRequiredId,
    confidenceRequired
  };
}
