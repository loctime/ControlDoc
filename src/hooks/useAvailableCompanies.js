import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';

/**
 * Hook para obtener empresas disponibles del usuario (empresa principal + clientes)
 * @param {string} userCompanyId - ID de la empresa principal del usuario
 * @returns {Object} Query con availableCompanies
 */
export function useAvailableCompanies(userCompanyId) {
  return useQuery({
    queryKey: ['availableCompanies', userCompanyId],
    queryFn: async () => {
      if (!userCompanyId) return [];

      const companiesPath = getTenantCollectionPath('companies');
      
      // Obtener empresa principal directamente por ID
      const mainCompanyRef = doc(db, companiesPath, userCompanyId);
      
      // Obtener clientes (empresas con parentCompanyId === userCompanyId)
      const clientsQuery = query(
        collection(db, companiesPath),
        where('parentCompanyId', '==', userCompanyId),
        where('active', '==', true)
      );

      const [mainDoc, clientsSnapshot] = await Promise.all([
        getDoc(mainCompanyRef),
        getDocs(clientsQuery)
      ]);

      const companies = [];

      // Agregar empresa principal
      if (mainDoc.exists()) {
        const mainData = mainDoc.data();
        companies.push({
          id: mainDoc.id,
          companyId: mainDoc.id,
          companyName: mainData.companyName || mainData.name || 'Sin nombre',
          type: mainData.type || 'main',
          parentCompanyId: mainData.parentCompanyId || null,
          isMain: true,
          ...mainData
        });
      }

      // Agregar clientes
      clientsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        companies.push({
          id: doc.id,
          companyId: doc.id,
          companyName: data.companyName || data.name || 'Sin nombre',
          type: data.type || 'client',
          parentCompanyId: data.parentCompanyId,
          isMain: false,
          ...data
        });
      });

      return companies;
    },
    enabled: !!userCompanyId,
    staleTime: 30000, // 30 segundos
  });
}

