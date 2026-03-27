import { useQuery } from '@tanstack/react-query';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '../config/firebaseconfig';
import { getTenantCollectionPath } from './tenantUtils';

/**
 * Obtiene el nombre de un cliente por su ID
 * @param {string} clientId - ID del cliente
 * @returns {Promise<string|null>} Nombre del cliente o null si no existe
 */
export async function getClientName(clientId) {
  if (!clientId) return null;

  try {
    const companiesPath = getTenantCollectionPath('companies');
    const clientRef = doc(db, companiesPath, clientId);
    const clientDoc = await getDoc(clientRef);

    if (clientDoc.exists()) {
      const data = clientDoc.data();
      return data.companyName || data.name || null;
    }

    return null;
  } catch (error) {
    console.error('[getClientName] Error obteniendo nombre de cliente:', error);
    return null;
  }
}

/**
 * Obtiene múltiples nombres de clientes en batch
 * @param {string[]} clientIds - Array de IDs de clientes
 * @returns {Promise<Object>} Mapa {clientId: clientName}
 */
export async function getClientNamesBatch(clientIds) {
  if (!clientIds || clientIds.length === 0) return {};

  // Filtrar nulls y duplicados
  const uniqueIds = [...new Set(clientIds.filter(id => id))];
  if (uniqueIds.length === 0) return {};

  try {
    const companiesPath = getTenantCollectionPath('companies');
    const companiesRef = collection(db, companiesPath);
    
    // Firestore permite hasta 10 elementos en 'in', así que hacemos chunks
    const chunks = [];
    for (let i = 0; i < uniqueIds.length; i += 10) {
      chunks.push(uniqueIds.slice(i, i + 10));
    }

    const results = await Promise.all(
      chunks.map(chunk => {
        const q = query(companiesRef, where('__name__', 'in', chunk));
        return getDocs(q);
      })
    );

    const clientNamesMap = {};
    
    results.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        clientNamesMap[doc.id] = data.companyName || data.name || null;
      });
    });

    return clientNamesMap;
  } catch (error) {
    console.error('[getClientNamesBatch] Error obteniendo nombres de clientes:', error);
    return {};
  }
}

/**
 * Hook para obtener un mapa de nombres de clientes con cache
 * @param {string[]} clientIds - Array de IDs de clientes (puede incluir nulls)
 * @returns {Object} { data: {clientId: clientName}, isLoading, error }
 */
export function useClientNamesMap(clientIds) {
  // Filtrar nulls y duplicados para la query key
  const uniqueIds = clientIds ? [...new Set(clientIds.filter(id => id))] : [];
  const sortedIds = uniqueIds.sort(); // Ordenar para consistencia en cache

  return useQuery({
    queryKey: ['clientNames', sortedIds],
    queryFn: () => getClientNamesBatch(uniqueIds),
    enabled: uniqueIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
    cacheTime: 30 * 60 * 1000, // 30 minutos en cache
  });
}

/**
 * Hook para obtener el nombre de un solo cliente
 * @param {string|null} clientId - ID del cliente
 * @returns {Object} { clientName: string|null, isLoading: boolean }
 */
export function useClientName(clientId) {
  const { data, isLoading } = useClientNamesMap(clientId ? [clientId] : []);
  
  return {
    clientName: clientId && data ? data[clientId] || null : null,
    isLoading
  };
}

