// src/hooks/useCompanyStatsQuery.js
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';
import { POLLING_INTERVALS, QUERY_DEFAULTS } from '../config/queryConfig';
import { useRealtimePolling } from './useRealtimePolling';

// Query keys
export const companyStatsKeys = {
  all: ['companyStats'],
  single: (companyId) => ['companyStats', companyId],
  multiple: (companyIds) => ['companyStats', 'multiple', companyIds],
};

// Fetch function para estadísticas de una empresa
const fetchCompanyStats = async (companyId) => {
  if (!companyId) return null;

  // Obtener empleados
  const personalPath = getTenantCollectionPath('personal');
  const personalQuery = query(
    collection(db, personalPath),
    where('companyId', '==', companyId)
  );
  const personalSnap = await getDocs(personalQuery);
  
  let empleadosActivos = 0;
  let empleadosInactivos = 0;
  personalSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.activo !== false) {
      empleadosActivos++;
    } else {
      empleadosInactivos++;
    }
  });

  // Obtener vehículos
  const vehiculosPath = getTenantCollectionPath('vehiculos');
  const vehiculosQuery = query(
    collection(db, vehiculosPath),
    where('companyId', '==', companyId)
  );
  const vehiculosSnap = await getDocs(vehiculosQuery);
  
  let vehiculosActivos = 0;
  let vehiculosInactivos = 0;
  vehiculosSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.activo !== false) {
      vehiculosActivos++;
    } else {
      vehiculosInactivos++;
    }
  });

  // Obtener documentos subidos
  const uploadedDocumentsPath = 'uploadedDocuments';
  const uploadedQuery = query(
    collection(db, uploadedDocumentsPath),
    where('companyId', '==', companyId)
  );
  const uploadedSnap = await getDocs(uploadedQuery);
  
  let documentosAprobados = 0;
  let documentosPendientes = 0;
  let documentosRechazados = 0;
  let documentosVencidos = 0;
  let documentosPorVencer = 0;
  
  const hoy = new Date();
  uploadedSnap.docs.forEach(doc => {
    const data = doc.data();
    
    // Contar por estado
    if (data.status === 'Aprobado') {
      documentosAprobados++;
    } else if (data.status === 'Pendiente de revisión') {
      documentosPendientes++;
    } else if (data.status === 'Rechazado') {
      documentosRechazados++;
    }

    // Verificar vencimientos
    if (data.expirationDate) {
      const expDate = data.expirationDate.toDate ? data.expirationDate.toDate() : new Date(data.expirationDate);
      const diasRestantes = Math.ceil((expDate - hoy) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes < 0) {
        documentosVencidos++;
      } else if (diasRestantes <= 10) {
        documentosPorVencer++;
      }
    }
  });

  // Obtener documentos requeridos no subidos
  const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
  const requiredQuery = query(
    collection(db, requiredDocumentsPath),
    where('companyId', '==', companyId),
    where('archivoSubido', '==', false)
  );
  const requiredSnap = await getDocs(requiredQuery);
  
  const documentosRequeridosNoSubidos = requiredSnap.size;
  documentosPendientes += documentosRequeridosNoSubidos;

  return {
    empleados: {
      total: personalSnap.size,
      activos: empleadosActivos,
      inactivos: empleadosInactivos
    },
    vehiculos: {
      total: vehiculosSnap.size,
      activos: vehiculosActivos,
      inactivos: vehiculosInactivos
    },
    documentos: {
      total: uploadedSnap.size,
      aprobados: documentosAprobados,
      pendientes: documentosPendientes,
      rechazados: documentosRechazados,
      vencidos: documentosVencidos,
      porVencer: documentosPorVencer
    }
  };
};

// Hook principal para estadísticas de una empresa
export function useCompanyStatsQuery(companyId) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: companyStatsKeys.single(companyId),
    queryFn: () => fetchCompanyStats(companyId),
    enabled: !!companyId,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.COMPANY_STATS,
  });

  // Polling inteligente
  useRealtimePolling(
    companyStatsKeys.single(companyId),
    POLLING_INTERVALS.COMPANY_STATS,
    !!companyId
  );

  return {
    ...query,
    stats: query.data,
    loading: query.isLoading,
    error: query.error?.message || null,
  };
}

// Hook para estadísticas de múltiples empresas
export function useMultipleCompanyStatsQuery(companyIds) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: companyStatsKeys.multiple(companyIds),
    queryFn: async () => {
      if (!companyIds || companyIds.length === 0) return {};
      
      const statsPromises = companyIds.map(async (companyId) => {
        const stats = await fetchCompanyStats(companyId);
        return { companyId, stats };
      });

      const results = await Promise.all(statsPromises);
      const statsMap = {};
      results.forEach(({ companyId, stats }) => {
        statsMap[companyId] = stats;
      });
      return statsMap;
    },
    enabled: !!companyIds && companyIds.length > 0,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.COMPANY_STATS,
  });

  // Polling inteligente
  useRealtimePolling(
    companyStatsKeys.multiple(companyIds),
    POLLING_INTERVALS.COMPANY_STATS,
    !!companyIds && companyIds.length > 0
  );

  return {
    allStats: query.data || {},
    loading: query.isLoading,
    error: query.error?.message || null,
  };
}

