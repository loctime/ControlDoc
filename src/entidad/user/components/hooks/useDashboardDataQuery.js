// src/component/usuario/hooks/useDashboardDataQuery.js
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../../../firebaseconfig';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getTenantCollectionPath } from '../../../../utils/tenantUtils';
import { useEffect, useRef } from 'react';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'],
  company: (companyId) => [...dashboardKeys.all, 'company', companyId],
  requiredDocuments: (companyId) => [...dashboardKeys.all, 'requiredDocuments', companyId],
  uploadedDocuments: (companyId) => [...dashboardKeys.all, 'uploadedDocuments', companyId],
  personal: (companyId) => [...dashboardKeys.all, 'personal', companyId],
  vehiculos: (companyId) => [...dashboardKeys.all, 'vehiculos', companyId],
};

// Normalizar appliesTo: documentos sin campo o con formato antiguo → clients: []
// Esto asegura que documentos antiguos no aparezcan automáticamente para clientes nuevos
const normalizeAppliesTo = (appliesTo) => {
  if (!appliesTo) {
    return { main: true, clients: [] };
  }
  if (typeof appliesTo !== 'object') {
    return { main: true, clients: [] };
  }
  return {
    main: appliesTo.main !== false,
    clients: Array.isArray(appliesTo.clients) ? appliesTo.clients : (appliesTo.clients === null ? null : [])
  };
};

// Fetch functions
const fetchCompany = async (companyId) => {
  const companiesPath = getTenantCollectionPath('companies');
  const companyRef = doc(db, companiesPath, companyId);
  const snap = await getDoc(companyRef);
  return snap.exists() ? snap.data() : null;
};

const fetchRequiredDocuments = async (companyId, activeCompanyId, mainCompanyId) => {
  // Obtener el nombre de la empresa principal para inyectarlo en cada documento
  let companyName = '';
  try {
    const companiesPath = getTenantCollectionPath('companies');
    const snap = await getDoc(doc(db, companiesPath, mainCompanyId || companyId));
    if (snap.exists()) {
      const c = snap.data();
      companyName = c.companyName || c.name || '';
    }
  } catch(e) { companyName = ''; }

  if (import.meta.env.DEV) {
    console.log('[useDashboardDataQuery] fetchRequiredDocuments llamado:', {
      companyId,
      activeCompanyId,
      mainCompanyId,
      isMain: activeCompanyId === mainCompanyId
    });
  }
  
  // IMPORTANTE: Los documentos requeridos siempre están asociados a la empresa principal (mainCompanyId)
  // No al cliente. Por eso usamos mainCompanyId para buscar, no companyId (que puede ser un cliente)
  const searchCompanyId = mainCompanyId || companyId;
  
  const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
  const q = query(collection(db, requiredDocumentsPath), where("companyId", "==", searchCompanyId));
  const snapshot = await getDocs(q);
  const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), companyName: doc.data().companyName || doc.data().name || '' }));
  
  if (import.meta.env.DEV) {
    console.log('[useDashboardDataQuery] Documentos encontrados antes de filtrar:', {
      cantidad: allDocs.length,
      documentos: allDocs.map(d => ({
        id: d.id,
        name: d.name,
        appliesTo: d.appliesTo
      }))
    });
  }
  
  // Filtrar según vista: empresa principal vs cliente
  const isClientView = activeCompanyId && mainCompanyId && activeCompanyId !== mainCompanyId;
  let filteredDocs = allDocs;

  if (isClientView) {
    // Vista cliente: solo documentos que aplican a todos (clients=null) o a este cliente (clients incluye activeCompanyId)
    filteredDocs = allDocs.filter((d) => {
      const norm = normalizeAppliesTo(d.appliesTo);
      const appliesToAll = norm.clients === null;
      const appliesToThisClient = Array.isArray(norm.clients) && norm.clients.length > 0 && norm.clients.includes(activeCompanyId);
      const include = appliesToAll || appliesToThisClient;
      if (import.meta.env.DEV) {
        console.log('[useDashboardDataQuery] requiredDoc appliesTo decisión:', {
          docId: d.id,
          name: d.name,
          activeCompanyId,
          mainCompanyId,
          type: 'client',
          appliesTo: d.appliesTo,
          normClients: norm.clients,
          appliesToAll,
          appliesToThisClient,
          include
        });
      }
      return include;
    });
  } else if (import.meta.env.DEV) {
    console.log('[useDashboardDataQuery] requiredDocuments vista principal (sin filtrar por appliesTo):', {
      activeCompanyId,
      mainCompanyId,
      cantidad: filteredDocs.length,
      documentos: filteredDocs.map(d => ({ id: d.id, name: d.name, appliesTo: d.appliesTo }))
    });
  }

  return filteredDocs;
};

const fetchUploadedDocuments = async (companyId, activeCompanyId, mainCompanyId) => {
  // IMPORTANTE: Los documentos subidos siempre están asociados a la empresa principal (mainCompanyId)
  // No al cliente. Por eso usamos mainCompanyId para buscar, no companyId (que puede ser un cliente)
  const searchCompanyId = mainCompanyId || companyId;
  // Usar ruta del tenant (igual que requiredDocuments, personal, vehiculos) para que el cliente vea sus documentos
  const uploadedDocumentsPath = getTenantCollectionPath('uploadedDocuments');
  const q = query(collection(db, uploadedDocumentsPath), where("companyId", "==", searchCompanyId));
  const snapshot = await getDocs(q);
  const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), companyName: doc.data().companyName || doc.data().name || '' }));
  
  // Filtrar según cliente activo
  // IMPORTANTE: Si activeCompanyId === mainCompanyId, no filtrar (mostrar todos los documentos de la empresa)
  // Solo filtrar si estamos viendo un cliente específico
  if (activeCompanyId && mainCompanyId && activeCompanyId !== mainCompanyId) {
    // Solo estamos en un cliente, filtrar documentos de ese cliente
    // El documento debe tener clientId === activeCompanyId
    const filtered = allDocs.filter(doc => {
      const docClientId = doc.clientId;
      // Comparar como strings para evitar problemas de tipo
      return String(docClientId) === String(activeCompanyId);
    });
    
    // Debug log
    if (import.meta.env.DEV) {
      console.log('[useDashboardDataQuery] 🔍 Filtrado para cliente:', {
        activeCompanyId,
        mainCompanyId,
        totalDocs: allDocs.length,
        filteredDocs: filtered.length,
        sampleFiltered: filtered.slice(0, 2).map(d => ({
          id: d.id,
          clientId: d.clientId,
          companyId: d.companyId
        }))
      });
    }
    
    return filtered;
  }
  
  // Si estamos en la empresa principal o no hay filtro, mostrar todos los documentos
  return allDocs;
};

const fetchPersonal = async (companyId, activeCompanyId, mainCompanyId) => {
  // IMPORTANTE: Los empleados siempre están asociados a la empresa principal (mainCompanyId)
  // No al cliente. Por eso usamos mainCompanyId para buscar, no companyId (que puede ser un cliente)
  const searchCompanyId = mainCompanyId || companyId;
  
  const personalPath = getTenantCollectionPath('personal');
  const q = query(collection(db, personalPath), where("companyId", "==", searchCompanyId));
  const snapshot = await getDocs(q);
  const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), companyName: doc.data().companyName || doc.data().name || '' }));
  
  // Filtrar según cliente activo
  if (activeCompanyId && mainCompanyId) {
    // Si estamos en la empresa principal, mostrar TODO (empleados propios y de clientes)
    if (activeCompanyId === mainCompanyId) {
      return allDocs;
    }
    
    // Si estamos en un cliente, mostrar solo empleados de ese cliente
    return allDocs.filter(doc => {
      const docClientId = doc.clientId || null;
      return docClientId === activeCompanyId;
    });
  }
  
  return allDocs;
};

const fetchVehiculos = async (companyId, activeCompanyId, mainCompanyId) => {
  // IMPORTANTE: Los vehículos siempre están asociados a la empresa principal (mainCompanyId)
  // No al cliente. Por eso usamos mainCompanyId para buscar, no companyId (que puede ser un cliente)
  const searchCompanyId = mainCompanyId || companyId;
  
  const vehiculosPath = getTenantCollectionPath('vehiculos');
  const q = query(collection(db, vehiculosPath), where("companyId", "==", searchCompanyId));
  const snapshot = await getDocs(q);
  const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), companyName: doc.data().companyName || doc.data().name || '' }));
  
  // Filtrar según cliente activo
  if (activeCompanyId && mainCompanyId) {
    // Si estamos en la empresa principal, mostrar TODO (vehículos propios y de clientes)
    if (activeCompanyId === mainCompanyId) {
      return allDocs;
    }
    
    // Si estamos en un cliente, mostrar solo vehículos de ese cliente
    return allDocs.filter(doc => {
      const docClientId = doc.clientId || null;
      return docClientId === activeCompanyId;
    });
  }
  
  return allDocs;
};

// Real-time listeners hook
export function useRealtimeListeners(companyId, personalRefresh = 0, vehiculosRefresh = 0, mainCompanyId = null, activeCompanyId = null) {
  const queryClient = useQueryClient();
  const unsubscribers = useRef([]);

  useEffect(() => {
    if (!companyId) return;

    // Clear previous listeners
    unsubscribers.current.forEach(unsub => unsub());
    unsubscribers.current = [];

    // IMPORTANTE: Todos los datos (documentos, empleados, vehículos) están asociados a la empresa principal (mainCompanyId)
    // No al cliente. Por eso usamos mainCompanyId para buscar, no companyId (que puede ser un cliente)
    const searchCompanyId = mainCompanyId || companyId;

    // Required Documents listener
    const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
    const requiredQ = query(collection(db, requiredDocumentsPath), where("companyId", "==", searchCompanyId));
    const unsubRequired = onSnapshot(requiredQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Invalidar todas las queries de requiredDocuments para que se vuelvan a filtrar
      queryClient.invalidateQueries({ queryKey: dashboardKeys.requiredDocuments(searchCompanyId) });
    });
    unsubscribers.current.push(unsubRequired);

    // Uploaded Documents listener (ruta del tenant para coincidir con fetchUploadedDocuments)
    const uploadedDocumentsPath = getTenantCollectionPath('uploadedDocuments');
    const uploadedQ = query(collection(db, uploadedDocumentsPath), where("companyId", "==", searchCompanyId));
    const unsubUploaded = onSnapshot(uploadedQ, (snapshot) => {
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), companyName: doc.data().companyName || doc.data().name || '' }));
      // Filtrar según cliente activo
      // IMPORTANTE: Si activeCompanyId === mainCompanyId, no filtrar (mostrar todos los documentos de la empresa)
      // Solo filtrar si estamos viendo un cliente específico
      let filteredDocs = allDocs;
      if (activeCompanyId && mainCompanyId && activeCompanyId !== mainCompanyId) {
        // Solo estamos en un cliente, filtrar documentos de ese cliente
        // El documento debe tener clientId === activeCompanyId
        filteredDocs = allDocs.filter(doc => {
          const docClientId = doc.clientId;
          // Comparar como strings para evitar problemas de tipo
          return String(docClientId) === String(activeCompanyId);
        });
      }
      // Si estamos en la empresa principal, filteredDocs = allDocs (sin filtrar)
      
      // Debug: Log cuando el listener detecta cambios
      console.log('[useDashboardDataQuery] 🔔 Listener uploadedDocuments detectó cambio:', {
        totalDocs: allDocs.length,
        filteredDocs: filteredDocs.length,
        activeCompanyId,
        mainCompanyId,
        sampleDocs: allDocs.slice(0, 2).map(d => ({
          id: d.id,
          companyId: d.companyId,
          clientId: d.clientId || 'null',
          requiredDocumentId: d.requiredDocumentId,
          entityType: d.entityType
        })),
        newestDoc: filteredDocs.length > 0 ? {
          id: filteredDocs[filteredDocs.length - 1].id,
          requiredDocumentId: filteredDocs[filteredDocs.length - 1].requiredDocumentId,
          documentType: filteredDocs[filteredDocs.length - 1].documentType,
          entityId: filteredDocs[filteredDocs.length - 1].entityId,
          entityType: filteredDocs[filteredDocs.length - 1].entityType,
          status: filteredDocs[filteredDocs.length - 1].status,
          companyId: filteredDocs[filteredDocs.length - 1].companyId,
          clientId: filteredDocs[filteredDocs.length - 1].clientId
        } : null
      });
      
      queryClient.setQueryData([...dashboardKeys.uploadedDocuments(companyId), activeCompanyId, mainCompanyId], filteredDocs);
    });
    unsubscribers.current.push(unsubUploaded);

    // Personal listener
    const personalPath = getTenantCollectionPath('personal');
    const personalQ = query(collection(db, personalPath), where("companyId", "==", searchCompanyId));
    const unsubPersonal = onSnapshot(personalQ, (snapshot) => {
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), companyName: doc.data().companyName || doc.data().name || '' }));
      // Filtrar según cliente activo
      let filteredDocs = allDocs;
      if (activeCompanyId && mainCompanyId) {
        // Si estamos en la empresa principal, mostrar TODO (empleados propios y de clientes)
        if (activeCompanyId === mainCompanyId) {
          filteredDocs = allDocs;
        } else {
          // Si estamos en un cliente, mostrar solo empleados de ese cliente
          filteredDocs = allDocs.filter(doc => {
            const docClientId = doc.clientId || null;
            return docClientId === activeCompanyId;
          });
        }
      }
      queryClient.setQueryData([...dashboardKeys.personal(companyId), activeCompanyId, mainCompanyId], filteredDocs);
    });
    unsubscribers.current.push(unsubPersonal);

    // Vehiculos listener
    const vehiculosPath = getTenantCollectionPath('vehiculos');
    const vehiculosQ = query(collection(db, vehiculosPath), where("companyId", "==", searchCompanyId));
    const unsubVehiculos = onSnapshot(vehiculosQ, (snapshot) => {
      const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), companyName: doc.data().companyName || doc.data().name || '' }));
      // Filtrar según cliente activo
      let filteredDocs = allDocs;
      if (activeCompanyId && mainCompanyId) {
        // Si estamos en la empresa principal, mostrar TODO (vehículos propios y de clientes)
        if (activeCompanyId === mainCompanyId) {
          filteredDocs = allDocs;
        } else {
          // Si estamos en un cliente, mostrar solo vehículos de ese cliente
          filteredDocs = allDocs.filter(doc => {
            const docClientId = doc.clientId || null;
            return docClientId === activeCompanyId;
          });
        }
      }
      queryClient.setQueryData([...dashboardKeys.vehiculos(companyId), activeCompanyId, mainCompanyId], filteredDocs);
    });
    unsubscribers.current.push(unsubVehiculos);

    return () => {
      unsubscribers.current.forEach(unsub => unsub());
    };
  }, [companyId, personalRefresh, vehiculosRefresh, queryClient, mainCompanyId, activeCompanyId]);
}

// Main hook
export default function useDashboardDataQuery(companyIdFromLocalStorage, personalRefresh = 0, vehiculosRefresh = 0, activeCompanyId = null, mainCompanyId = null) {
  const queryClient = useQueryClient();
  
  // Setup real-time listeners
  // IMPORTANTE: Pasar mainCompanyId para que el listener de requiredDocuments use la empresa principal
  useRealtimeListeners(companyIdFromLocalStorage, personalRefresh, vehiculosRefresh, mainCompanyId, activeCompanyId);

  // Company query (static data)
  // IMPORTANTE: Usar siempre mainCompanyId para la query de company, nunca el cliente activo
  const companyIdForQuery = mainCompanyId || companyIdFromLocalStorage;
  const {
    data: company,
    isLoading: companyLoading,
    error: companyError
  } = useQuery({
    queryKey: dashboardKeys.company(companyIdForQuery),
    queryFn: () => fetchCompany(companyIdForQuery),
    enabled: !!companyIdForQuery,
    staleTime: Infinity, // Company data doesn't change often
  });

          // Required Documents query (real-time via listeners)
          // IMPORTANTE: Usar mainCompanyId en la queryKey porque los documentos están asociados a la empresa principal
          const searchCompanyId = mainCompanyId || companyIdFromLocalStorage;
          // Incluir activeCompanyId y mainCompanyId en la queryKey para que se invalide cuando cambien
          const {
            data: requiredDocuments = [],
            isLoading: requiredLoading,
            error: requiredError
          } = useQuery({
            queryKey: [...dashboardKeys.requiredDocuments(searchCompanyId), activeCompanyId, mainCompanyId],
            queryFn: () => fetchRequiredDocuments(companyIdFromLocalStorage, activeCompanyId, mainCompanyId),
            enabled: !!companyIdFromLocalStorage && !!activeCompanyId && !!mainCompanyId,
            staleTime: 0, // Always fresh due to real-time listeners
          });

  // Uploaded Documents query (real-time via listeners)
  const {
    data: uploadedDocuments = [],
    isLoading: uploadedLoading,
    error: uploadedError
  } = useQuery({
    queryKey: [...dashboardKeys.uploadedDocuments(companyIdFromLocalStorage), activeCompanyId, mainCompanyId],
    queryFn: () => fetchUploadedDocuments(companyIdFromLocalStorage, activeCompanyId, mainCompanyId),
    enabled: !!companyIdFromLocalStorage && !!activeCompanyId && !!mainCompanyId,
    staleTime: 0, // Always fresh due to real-time listeners
  });

  // Personal query (real-time via listeners)
  const {
    data: personal = [],
    isLoading: personalLoading,
    error: personalError
  } = useQuery({
    queryKey: [...dashboardKeys.personal(companyIdFromLocalStorage), activeCompanyId, mainCompanyId],
    queryFn: () => fetchPersonal(companyIdFromLocalStorage, activeCompanyId, mainCompanyId),
    enabled: !!companyIdFromLocalStorage && !!activeCompanyId && !!mainCompanyId,
    staleTime: 0, // Always fresh due to real-time listeners
  });

  // Vehiculos query (real-time via listeners)
  const {
    data: vehiculos = [],
    isLoading: vehiculosLoading,
    error: vehiculosError
  } = useQuery({
    queryKey: [...dashboardKeys.vehiculos(companyIdFromLocalStorage), activeCompanyId, mainCompanyId],
    queryFn: () => fetchVehiculos(companyIdFromLocalStorage, activeCompanyId, mainCompanyId),
    enabled: !!companyIdFromLocalStorage && !!activeCompanyId && !!mainCompanyId,
    staleTime: 0, // Always fresh due to real-time listeners
  });

  // Combined loading and error states
  const loading = companyLoading || requiredLoading || uploadedLoading || personalLoading || vehiculosLoading;
  const error = companyError || requiredError || uploadedError || personalError || vehiculosError;

  // Refresh function for uploaded documents
  const refreshUploadedDocuments = async () => {
    if (!companyIdFromLocalStorage) return;
    const searchCompanyId = mainCompanyId || companyIdFromLocalStorage;
    // Invalidar con la queryKey completa que incluye activeCompanyId y mainCompanyId
    console.log('[useDashboardDataQuery] 🔄 Refrescando uploadedDocuments:', {
      companyIdFromLocalStorage,
      activeCompanyId,
      mainCompanyId,
      searchCompanyId
    });
    
    // Obtener datos actuales antes del refresh
    const dataBefore = queryClient.getQueryData([...dashboardKeys.uploadedDocuments(companyIdFromLocalStorage), activeCompanyId, mainCompanyId]);
    console.log('[useDashboardDataQuery] 📊 Datos ANTES del refresh:', {
      count: dataBefore?.length || 0
    });
    
    // Invalidar y refetch
    await queryClient.invalidateQueries({
      queryKey: [...dashboardKeys.uploadedDocuments(companyIdFromLocalStorage), activeCompanyId, mainCompanyId]
    });
    
    const refetchResult = await queryClient.refetchQueries({
      queryKey: [...dashboardKeys.uploadedDocuments(companyIdFromLocalStorage), activeCompanyId, mainCompanyId]
    });
    
    // Debug: Ver qué datos se obtuvieron
    const currentData = queryClient.getQueryData([...dashboardKeys.uploadedDocuments(companyIdFromLocalStorage), activeCompanyId, mainCompanyId]);
    console.log('[useDashboardDataQuery] ✅ Refetch completado:', {
      refetchSuccess: refetchResult && refetchResult.length > 0 ? refetchResult[0]?.status === 'success' : false,
      refetchResultLength: refetchResult?.length || 0,
      documentsCount: currentData?.length || 0,
      recentDocs: currentData?.slice(-3).map(d => ({
        id: d.id,
        requiredDocumentId: d.requiredDocumentId,
        documentType: d.documentType,
        entityId: d.entityId,
        entityType: d.entityType,
        status: d.status,
        companyId: d.companyId,
        clientId: d.clientId || 'null'
      })) || []
    });
  };

  return {
    company,
    requiredDocuments,
    uploadedDocuments,
    personal,
    vehiculos,
    loading,
    error: error?.message || (companyIdFromLocalStorage ? "" : "No se encontró la empresa asignada."),
    refreshUploadedDocuments
  };
}
