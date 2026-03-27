import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';

/**
 * Hook para obtener estadísticas detalladas de una empresa
 * @param {string} companyId - ID de la empresa
 * @returns {Object} Estadísticas de la empresa
 */
export function useCompanyStats(companyId) {
  const [stats, setStats] = useState({
    empleados: { total: 0, activos: 0, inactivos: 0 },
    vehiculos: { total: 0, activos: 0, inactivos: 0 },
    documentos: { 
      total: 0, 
      aprobados: 0, 
      pendientes: 0, 
      rechazados: 0,
      vencidos: 0,
      porVencer: 0
    },
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!companyId) {
      setStats(prev => ({ ...prev, loading: false }));
      return;
    }

    const fetchCompanyStats = async () => {
      try {
        setStats(prev => ({ ...prev, loading: true, error: null }));

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

        setStats({
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
          },
          loading: false,
          error: null
        });

      } catch (error) {
        console.error('Error fetching company stats:', error);
        setStats(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    };

    fetchCompanyStats();
  }, [companyId]);

  return stats;
}

/**
 * Hook para obtener estadísticas de múltiples empresas
 * @param {Array} companyIds - Array de IDs de empresas
 * @returns {Object} Estadísticas de todas las empresas
 */
export function useMultipleCompanyStats(companyIds) {
  const [allStats, setAllStats] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchAllStats = useCallback(async (ids) => {
    if (!ids || ids.length === 0) {
      setAllStats({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const statsPromises = ids.map(async (companyId) => {
      const stats = await getCompanyStatsSync(companyId);
      return { companyId, stats };
    });

    try {
      const results = await Promise.all(statsPromises);
      const statsMap = {};
      results.forEach(({ companyId, stats }) => {
        statsMap[companyId] = stats;
      });
      setAllStats(statsMap);
    } catch (error) {
      console.error('Error fetching multiple company stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAllStats(companyIds);
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [companyIds, fetchAllStats]);

  return { allStats, loading };
}

/**
 * Función auxiliar para obtener estadísticas de una empresa de forma síncrona
 * @param {string} companyId - ID de la empresa
 * @returns {Promise<Object>} Estadísticas de la empresa
 */
async function getCompanyStatsSync(companyId) {
  try {
    // Obtener empleados
    const personalPath = getTenantCollectionPath('personal');
    const personalQuery = query(
      collection(db, personalPath),
      where('companyId', '==', companyId)
    );
    const personalSnap = await getDocs(personalQuery);
    
    let empleadosActivos = 0;
    personalSnap.docs.forEach(doc => {
      if (doc.data().activo !== false) empleadosActivos++;
    });

    // Obtener vehículos
    const vehiculosPath = getTenantCollectionPath('vehiculos');
    const vehiculosQuery = query(
      collection(db, vehiculosPath),
      where('companyId', '==', companyId)
    );
    const vehiculosSnap = await getDocs(vehiculosQuery);
    
    let vehiculosActivos = 0;
    vehiculosSnap.docs.forEach(doc => {
      if (doc.data().activo !== false) vehiculosActivos++;
    });

    // Obtener documentos
    const uploadedDocumentsPath = getTenantCollectionPath('uploadedDocuments');
    const uploadedQuery = query(
      collection(db, uploadedDocumentsPath),
      where('companyId', '==', companyId)
    );
    const uploadedSnap = await getDocs(uploadedQuery);
    
    let documentosAprobados = 0;
    let documentosPendientes = 0;
    let documentosRechazados = 0;
    
    uploadedSnap.docs.forEach(doc => {
      const status = doc.data().status;
      if (status === 'Aprobado') documentosAprobados++;
      else if (status === 'Pendiente de revisión') documentosPendientes++;
      else if (status === 'Rechazado') documentosRechazados++;
    });

    return {
      empleados: {
        total: personalSnap.size,
        activos: empleadosActivos
      },
      vehiculos: {
        total: vehiculosSnap.size,
        activos: vehiculosActivos
      },
      documentos: {
        total: uploadedSnap.size,
        aprobados: documentosAprobados,
        pendientes: documentosPendientes,
        rechazados: documentosRechazados
      }
    };
  } catch (error) {
    console.error('Error in getCompanyStatsSync:', error);
    return {
      empleados: { total: 0, activos: 0 },
      vehiculos: { total: 0, activos: 0 },
      documentos: { total: 0, aprobados: 0, pendientes: 0, rechazados: 0 }
    };
  }
}
