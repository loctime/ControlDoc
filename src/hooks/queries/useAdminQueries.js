// src/hooks/queries/useAdminQueries.js
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseconfig';
import { getTenantCollectionPath } from '../../utils/tenantUtils';
import { POLLING_INTERVALS, QUERY_DEFAULTS } from '../../config/queryConfig';
import { useRealtimePolling } from '../useRealtimePolling';
import { useAuth } from '../../context/AuthContext';

// Query keys
export const adminKeys = {
  all: ['admin'],
  dashboard: () => ['admin', 'dashboard'],
  companies: () => ['admin', 'companies'],
  company: (companyId) => ['admin', 'company', companyId],
  admins: () => ['admin', 'admins'],
  admin: (adminId) => ['admin', 'admin', adminId],
  pendingDocuments: () => ['admin', 'pendingDocuments'],
  inProgressDocuments: () => ['admin', 'inProgressDocuments'],
  historyDocuments: () => ['admin', 'historyDocuments'],
  notifications: () => ['admin', 'notifications'],
  logs: () => ['admin', 'logs'],
};

// Helper function para obtener IDs de empresas asignadas a un admin
const getAssignedCompanyIds = async (currentUserId) => {
  if (!currentUserId) return new Set();
  
  const companiesPath = getTenantCollectionPath('companies');
  
  // Hacer dos consultas: una para assignedAdminIds (nuevo formato) y otra para assignedAdminId (antiguo)
  const [newFormatSnapshot, oldFormatSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, companiesPath),
      where("assignedAdminIds", "array-contains", currentUserId),
      where("status", "==", "approved")
    )),
    getDocs(query(
      collection(db, companiesPath),
      where("assignedAdminId", "==", currentUserId),
      where("status", "==", "approved")
    ))
  ]);
  
  const companyIds = new Set();
  [...newFormatSnapshot.docs, ...oldFormatSnapshot.docs].forEach(doc => {
    companyIds.add(doc.id);
  });
  
  return companyIds;
};

// Fetch functions
const fetchAdminDashboard = async (currentUserId) => {
  if (!currentUserId) {
    return {
      totalCompanies: 0,
      totalDocuments: 0,
      totalRequiredDocs: 0,
      pendingApprovals: 0,
    };
  }
  
  // Obtener IDs de empresas asignadas al admin
  const assignedCompanyIds = await getAssignedCompanyIds(currentUserId);
  
  if (assignedCompanyIds.size === 0) {
    return {
      totalCompanies: 0,
      totalDocuments: 0,
      totalRequiredDocs: 0,
      pendingApprovals: 0,
    };
  }
  
  // Filtrar documentos por empresas asignadas
  const uploadedDocsPath = getTenantCollectionPath('uploadedDocuments');
  const requiredDocsPath = getTenantCollectionPath('requiredDocuments');
  
  const [uploadedDocsSnap, requiredDocsSnap] = await Promise.all([
    getDocs(collection(db, uploadedDocsPath)),
    getDocs(collection(db, requiredDocsPath))
  ]);
  
  const filteredUploadedDocs = uploadedDocsSnap.docs.filter(doc => 
    assignedCompanyIds.has(doc.data().companyId)
  );
  const filteredRequiredDocs = requiredDocsSnap.docs.filter(doc => 
    assignedCompanyIds.has(doc.data().companyId)
  );

  return {
    totalCompanies: assignedCompanyIds.size,
    totalDocuments: filteredUploadedDocs.length,
    totalRequiredDocs: filteredRequiredDocs.length,
    pendingApprovals: filteredUploadedDocs.filter(doc => doc.data().status === 'Pendiente de revisión').length,
  };
};

const fetchCompanies = async (currentUserId) => {
  if (!currentUserId) return [];
  
  const companiesPath = getTenantCollectionPath('companies');
  
  // Hacer dos consultas: una para assignedAdminIds (nuevo formato) y otra para assignedAdminId (antiguo)
  const [newFormatSnapshot, oldFormatSnapshot] = await Promise.all([
    getDocs(query(
      collection(db, companiesPath),
      where("assignedAdminIds", "array-contains", currentUserId),
      where("status", "==", "approved")
    )),
    getDocs(query(
      collection(db, companiesPath),
      where("assignedAdminId", "==", currentUserId),
      where("status", "==", "approved")
    ))
  ]);
  
  // Combinar resultados y eliminar duplicados
  const companiesMap = new Map();
  
  [...newFormatSnapshot.docs, ...oldFormatSnapshot.docs].forEach(doc => {
    if (!companiesMap.has(doc.id)) {
      companiesMap.set(doc.id, { id: doc.id, ...doc.data() });
    }
  });
  
  return Array.from(companiesMap.values());
};

const fetchCompany = async (companyId) => {
  const companiesPath = getTenantCollectionPath('companies');
  const companyRef = doc(db, companiesPath, companyId);
  const snap = await getDoc(companyRef);
  
  if (!snap.exists()) {
    throw new Error('Company not found');
  }
  
  return { id: snap.id, ...snap.data() };
};

const fetchAdmins = async () => {
  const adminsPath = getTenantCollectionPath('admins');
  const snap = await getDocs(collection(db, adminsPath));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const fetchPendingDocuments = async (currentUserId) => {
  if (!currentUserId) return [];
  
  // Obtener IDs de empresas asignadas al admin
  const assignedCompanyIds = await getAssignedCompanyIds(currentUserId);
  
  if (assignedCompanyIds.size === 0) return [];
  
  const uploadedDocsPath = getTenantCollectionPath('uploadedDocuments');
  const q = query(
    collection(db, uploadedDocsPath),
    where('status', '==', 'Pendiente de revisión')
  );
  const snap = await getDocs(q);
  
  // Filtrar por empresas asignadas
  return snap.docs
    .filter(doc => assignedCompanyIds.has(doc.data().companyId))
    .map(doc => ({ id: doc.id, ...doc.data() }));
};

const fetchInProgressDocuments = async (currentUserId) => {
  if (!currentUserId) return [];
  
  // Obtener IDs de empresas asignadas al admin
  const assignedCompanyIds = await getAssignedCompanyIds(currentUserId);
  
  if (assignedCompanyIds.size === 0) return [];
  
  const uploadedDocsPath = getTenantCollectionPath('uploadedDocuments');
  const q = query(
    collection(db, uploadedDocsPath),
    where('status', '==', 'En proceso')
  );
  const snap = await getDocs(q);
  
  // Filtrar por empresas asignadas
  return snap.docs
    .filter(doc => assignedCompanyIds.has(doc.data().companyId))
    .map(doc => ({ id: doc.id, ...doc.data() }));
};

const fetchHistoryDocuments = async (currentUserId) => {
  if (!currentUserId) return [];
  
  // Obtener IDs de empresas asignadas al admin
  const assignedCompanyIds = await getAssignedCompanyIds(currentUserId);
  
  if (assignedCompanyIds.size === 0) return [];
  
  const uploadedDocsPath = getTenantCollectionPath('uploadedDocuments');
  const q = query(
    collection(db, uploadedDocsPath),
    where('status', 'in', ['Aprobado', 'Rechazado'])
  );
  const snap = await getDocs(q);
  
  // Filtrar por empresas asignadas
  return snap.docs
    .filter(doc => assignedCompanyIds.has(doc.data().companyId))
    .map(doc => ({ id: doc.id, ...doc.data() }));
};

// Hooks
export function useAdminDashboardQuery() {
  const { user } = useAuth();
  
  const query = useQuery({
    queryKey: adminKeys.dashboard(),
    queryFn: () => fetchAdminDashboard(user?.uid),
    enabled: !!user?.uid,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.DASHBOARD,
  });

  useRealtimePolling(adminKeys.dashboard(), POLLING_INTERVALS.DASHBOARD, true);

  return {
    ...query,
    dashboard: query.data,
  };
}

export function useCompaniesQuery() {
  const { user } = useAuth();
  
  const query = useQuery({
    queryKey: adminKeys.companies(),
    queryFn: () => fetchCompanies(user?.uid),
    enabled: !!user?.uid,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.COMPANY_STATS,
  });

  useRealtimePolling(adminKeys.companies(), POLLING_INTERVALS.COMPANY_STATS, true);

  return {
    ...query,
    companies: query.data || [],
  };
}

export function useCompanyQuery(companyId) {
  const query = useQuery({
    queryKey: adminKeys.company(companyId),
    queryFn: () => fetchCompany(companyId),
    enabled: !!companyId,
    ...QUERY_DEFAULTS,
  });

  return {
    ...query,
    company: query.data,
  };
}

export function useAdminsQuery() {
  const query = useQuery({
    queryKey: adminKeys.admins(),
    queryFn: fetchAdmins,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.COMPANY_STATS,
  });

  useRealtimePolling(adminKeys.admins(), POLLING_INTERVALS.COMPANY_STATS, true);

  return {
    ...query,
    admins: query.data || [],
  };
}

export function usePendingDocumentsQuery() {
  const { user } = useAuth();
  
  const query = useQuery({
    queryKey: adminKeys.pendingDocuments(),
    queryFn: () => fetchPendingDocuments(user?.uid),
    enabled: !!user?.uid,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.DOCUMENT_ALERTS,
  });

  useRealtimePolling(adminKeys.pendingDocuments(), POLLING_INTERVALS.DOCUMENT_ALERTS, true);

  return {
    ...query,
    pendingDocuments: query.data || [],
  };
}

export function useInProgressDocumentsQuery() {
  const { user } = useAuth();
  
  const query = useQuery({
    queryKey: adminKeys.inProgressDocuments(),
    queryFn: () => fetchInProgressDocuments(user?.uid),
    enabled: !!user?.uid,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.DOCUMENT_ALERTS,
  });

  useRealtimePolling(adminKeys.inProgressDocuments(), POLLING_INTERVALS.DOCUMENT_ALERTS, true);

  return {
    ...query,
    inProgressDocuments: query.data || [],
  };
}

export function useHistoryDocumentsQuery() {
  const { user } = useAuth();
  
  const query = useQuery({
    queryKey: adminKeys.historyDocuments(),
    queryFn: () => fetchHistoryDocuments(user?.uid),
    enabled: !!user?.uid,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.DOCUMENT_ALERTS,
  });

  useRealtimePolling(adminKeys.historyDocuments(), POLLING_INTERVALS.DOCUMENT_ALERTS, true);

  return {
    ...query,
    historyDocuments: query.data || [],
  };
}

