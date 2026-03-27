import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../config/firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';
import { useAuth } from '../context/AuthContext';

/**
 * Hook para manejar el historial de búsquedas y palabras más buscadas
 */
export function useSearchHistory() {
  const { user } = useAuth();
  const [searchHistory, setSearchHistory] = useState({});
  const [topSearches, setTopSearches] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cargar historial de búsquedas del usuario
  const loadSearchHistory = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const searchHistoryPath = getTenantCollectionPath('searchHistory');
      const userSearchDoc = doc(db, searchHistoryPath, user.uid);
      const docSnap = await getDoc(userSearchDoc);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setSearchHistory(data.searches || {});
        
        // Calcular top 6 búsquedas
        const sortedSearches = Object.entries(data.searches || {})
          .sort(([,a], [,b]) => b.count - a.count)
          .slice(0, 6)
          .map(([word, data]) => ({
            word,
            count: data.count,
            lastSearched: data.lastSearched
          }));
        
        setTopSearches(sortedSearches);
      }
    } catch (error) {
      console.error('Error cargando historial de búsquedas:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Registrar una nueva búsqueda
  const recordSearch = useCallback(async (searchTerm) => {
    if (!user?.uid) return;
    
    if (!searchTerm?.trim()) return;

    const term = searchTerm.trim().toLowerCase();
    
    try {
      const searchHistoryPath = getTenantCollectionPath('searchHistory');
      const userSearchDoc = doc(db, searchHistoryPath, user.uid);
      
      // Actualizar o crear el documento
      await setDoc(userSearchDoc, {
        searches: {
          [term]: {
            count: increment(1),
            lastSearched: new Date().toISOString()
          }
        }
      }, { merge: true });

      // Actualizar estado local
      setSearchHistory(prev => ({
        ...prev,
        [term]: {
          count: (prev[term]?.count || 0) + 1,
          lastSearched: new Date().toISOString()
        }
      }));

      // Recargar top searches
      await loadSearchHistory();
    } catch (error) {
      console.error('Error registrando búsqueda:', error);
    }
  }, [user?.uid, loadSearchHistory]);

  // Limpiar historial de búsquedas
  const clearSearchHistory = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const searchHistoryPath = getTenantCollectionPath('searchHistory');
      const userSearchDoc = doc(db, searchHistoryPath, user.uid);
      await setDoc(userSearchDoc, { searches: {} });
      
      setSearchHistory({});
      setTopSearches([]);
    } catch (error) {
      console.error('Error limpiando historial:', error);
    }
  }, [user?.uid]);

  // Cargar historial al montar el componente
  useEffect(() => {
    loadSearchHistory();
  }, [loadSearchHistory]);

  return {
    searchHistory,
    topSearches,
    loading,
    recordSearch,
    clearSearchHistory,
    refreshHistory: loadSearchHistory
  };
}
