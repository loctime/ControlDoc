// src/hooks/useDocumentAlertsQuery.js
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';
import { POLLING_INTERVALS, QUERY_DEFAULTS } from '../config/queryConfig';
import { useRealtimePolling } from './useRealtimePolling';

// Query keys
export const documentAlertsKeys = {
  all: ['documentAlerts'],
  byCompany: (companyId) => ['documentAlerts', 'byCompany', companyId],
  stats: (companyId) => ['documentAlerts', 'stats', companyId],
  companies: () => ['documentAlerts', 'companies'],
};

const parseFirestoreDate = (date) => {
  if (!date) return null;
  if (date.toDate) return date.toDate();
  if (date instanceof Date) return date;
  return new Date(date);
};

// Fetch function para alertas de documentos
const fetchDocumentAlerts = async (selectedCompanyId, companies) => {
  const hoy = new Date();
  const filters = selectedCompanyId ? [where('companyId', '==', selectedCompanyId)] : [];

  // Usar rutas de tenant
  const tenantUploadedDocumentsPath = getTenantCollectionPath("uploadedDocuments");
  const tenantPersonalPath = getTenantCollectionPath("personal");
  const tenantVehiculosPath = getTenantCollectionPath("vehiculos");

  let empleadosActivos = new Set();
  let vehiculosActivos = new Set();

  try {
    const personalSnap = await getDocs(query(collection(db, tenantPersonalPath), ...(selectedCompanyId ? [where('companyId', '==', selectedCompanyId)] : [])));
    empleadosActivos = new Set(personalSnap.docs.filter(d => d.data().activo !== false).map(d => d.id));
  } catch (e) { /* fallback: ningún empleado activo */ }
  
  try {
    const vehiculosSnap = await getDocs(query(collection(db, tenantVehiculosPath), ...(selectedCompanyId ? [where('companyId', '==', selectedCompanyId)] : [])));
    vehiculosActivos = new Set(vehiculosSnap.docs.filter(d => d.data().activo !== false).map(d => d.id));
  } catch (e) { /* fallback: ningún vehículo activo */ }

  const snap = await getDocs(query(collection(db, tenantUploadedDocumentsPath), ...filters));

  let approvalPending = 0;
  let rejected = 0;
  let totalConVencimiento = 0;

  const docs = snap.docs.map(docSnap => {
    const data = docSnap.data();
    const exp = parseFirestoreDate(data.expirationDate);
    const diasRestantes = exp ? Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24)) : null;

    if (data.expirationDate) totalConVencimiento++;
    if (data.status === 'Pendiente de revisión') approvalPending++;
    if (data.status === 'Rechazado') rejected++;

    const companyName = companies.find(c => c.id === data.companyId)?.name || 'Sin empresa';

    return {
      id: docSnap.id,
      ...data,
      name: data.name || 'Sin nombre',
      fileName: data.name || 'Sin nombre',
      expirationDate: exp,
      diasRestantes,
      status: data.status || 'Sin estado',
      companyName,
      companyId: data.companyId,
      entityType: data.entityType || 'company',
      entityName: data.entityName || 'Sin entidad',
      uploadedBy: data.uploadedByEmail || data.uploadedBy || 'Desconocido'
    };
  });

  // Filtrar docs de empleados/vehículos activos
  const docsFiltrados = docs.filter(doc => {
    if (["employee", "personal"].includes(doc.entityType)) {
      return empleadosActivos.has(doc.entityId);
    }
    if (["vehicle", "vehiculo"].includes(doc.entityType)) {
      return vehiculosActivos.has(doc.entityId);
    }
    // Para categorías personalizadas, siempre mostrar
    if (!["company", "employee", "vehicle", "personal", "vehiculo"].includes(doc.entityType)) {
      return true;
    }
    return true;
  });

  // Ordenar por días restantes
  docsFiltrados.sort((a, b) => {
    if (a.diasRestantes !== null && b.diasRestantes !== null) return a.diasRestantes - b.diasRestantes;
    if (a.diasRestantes === null) return 1;
    return -1;
  });

  return {
    previewDocs: docsFiltrados,
    stats: { totalDocumentos: totalConVencimiento, approvalPending, rejected }
  };
};

// Fetch function para empresas con vencimientos
const fetchCompaniesWithExpirations = async (companies) => {
  const hoy = new Date();
  const tenantUploadedDocumentsPath = getTenantCollectionPath("uploadedDocuments");
  const snap = await getDocs(collection(db, tenantUploadedDocumentsPath));

  const vencidas = new Set();
  const porVencer = new Set();

  snap.forEach(doc => {
    const data = doc.data();
    const exp = parseFirestoreDate(data.expirationDate);
    const diasRestantes = exp ? Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24)) : null;

    if (diasRestantes !== null && diasRestantes < 0) {
      vencidas.add(data.companyId);
    } else if (diasRestantes !== null && diasRestantes <= 10) {
      porVencer.add(data.companyId);
    }
  });

  return {
    empresasConVencidos: (companies || []).filter(c => vencidas.has(c.id)).map(c => c.name),
    empresasPorVencer: (companies || []).filter(c => porVencer.has(c.id)).map(c => c.name)
  };
};

// Hook principal para alertas de documentos
export function useDocumentAlertsQuery(selectedCompanyId = null, companies = []) {
  const queryClient = useQueryClient();

  const alertsQuery = useQuery({
    queryKey: documentAlertsKeys.byCompany(selectedCompanyId),
    queryFn: () => fetchDocumentAlerts(selectedCompanyId, companies),
    enabled: companies.length > 0,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.DOCUMENT_ALERTS,
  });

  const companiesQuery = useQuery({
    queryKey: documentAlertsKeys.companies(),
    queryFn: () => fetchCompaniesWithExpirations(companies),
    enabled: companies.length > 0,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.DOCUMENT_ALERTS,
  });

  // Polling inteligente
  useRealtimePolling(
    documentAlertsKeys.byCompany(selectedCompanyId),
    POLLING_INTERVALS.DOCUMENT_ALERTS,
    companies.length > 0
  );

  return {
    previewDocs: alertsQuery.data?.previewDocs || [],
    stats: alertsQuery.data?.stats || { totalDocumentos: 0, approvalPending: 0, rejected: 0 },
    loading: alertsQuery.isLoading || companiesQuery.isLoading,
    error: alertsQuery.error?.message || companiesQuery.error?.message || null,
    empresasConVencidos: companiesQuery.data?.empresasConVencidos || [],
    empresasPorVencer: companiesQuery.data?.empresasPorVencer || [],
  };
}

