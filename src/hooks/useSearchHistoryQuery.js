// src/hooks/useSearchHistoryQuery.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';
import { useAuth } from '../context/AuthContext';
import { POLLING_INTERVALS, QUERY_DEFAULTS, MUTATION_DEFAULTS } from '../config/queryConfig';
import { useRealtimePolling } from './useRealtimePolling';

// Query keys
export const searchHistoryKeys = {
  all: ['searchHistory'],
  byUser: (userId) => ['searchHistory', 'byUser', userId],
};

// Fetch function para historial de búsquedas
const fetchSearchHistory = async (userId) => {
  if (!userId) return { searches: {}, topSearches: [] };

  const searchHistoryPath = getTenantCollectionPath('searchHistory');
  const userSearchDoc = doc(db, searchHistoryPath, userId);
  const docSnap = await getDoc(userSearchDoc);

  if (!docSnap.exists()) {
    return { searches: {}, topSearches: [] };
  }

  const data = docSnap.data();
  const searches = data.searches || {};
  
  // Calcular top 6 búsquedas
  const topSearches = Object.entries(searches)
    .sort(([,a], [,b]) => b.count - a.count)
    .slice(0, 6)
    .map(([word, data]) => ({
      word,
      count: data.count,
      lastSearched: data.lastSearched
    }));

  return { searches, topSearches };
};

// Mutation para registrar búsqueda
const recordSearchMutation = async ({ userId, searchTerm }) => {
  if (!userId || !searchTerm?.trim()) return;

  const term = searchTerm.trim().toLowerCase();
  const searchHistoryPath = getTenantCollectionPath('searchHistory');
  const userSearchDoc = doc(db, searchHistoryPath, userId);
  
  // Actualizar o crear el documento
  await setDoc(userSearchDoc, {
    searches: {
      [term]: {
        count: increment(1),
        lastSearched: new Date().toISOString()
      }
    }
  }, { merge: true });

  return { term, count: 1, lastSearched: new Date().toISOString() };
};

// Mutation para limpiar historial
const clearSearchHistoryMutation = async (userId) => {
  if (!userId) return;

  const searchHistoryPath = getTenantCollectionPath('searchHistory');
  const userSearchDoc = doc(db, searchHistoryPath, userId);
  await setDoc(userSearchDoc, { searches: {} });
  
  return true;
};

// Hook principal
export function useSearchHistoryQuery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: searchHistoryKeys.byUser(user?.uid),
    queryFn: () => fetchSearchHistory(user?.uid),
    enabled: !!user?.uid,
    ...QUERY_DEFAULTS,
    refetchInterval: POLLING_INTERVALS.SEARCH_HISTORY,
  });

  const recordSearchMutation = useMutation({
    mutationFn: recordSearchMutation,
    onSuccess: (data, variables) => {
      // Actualizar cache optimísticamente
      queryClient.setQueryData(
        searchHistoryKeys.byUser(variables.userId),
        (oldData) => {
          if (!oldData) return { searches: {}, topSearches: [] };
          
          const newSearches = {
            ...oldData.searches,
            [data.term]: {
              count: (oldData.searches[data.term]?.count || 0) + 1,
              lastSearched: data.lastSearched
            }
          };

          // Recalcular top searches
          const topSearches = Object.entries(newSearches)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 6)
            .map(([word, data]) => ({
              word,
              count: data.count,
              lastSearched: data.lastSearched
            }));

          return { searches: newSearches, topSearches };
        }
      );
    },
    ...MUTATION_DEFAULTS,
  });

  const clearHistoryMutation = useMutation({
    mutationFn: clearSearchHistoryMutation,
    onSuccess: () => {
      // Limpiar cache
      queryClient.setQueryData(
        searchHistoryKeys.byUser(user?.uid),
        { searches: {}, topSearches: [] }
      );
    },
    ...MUTATION_DEFAULTS,
  });

  // Polling inteligente
  useRealtimePolling(
    searchHistoryKeys.byUser(user?.uid),
    POLLING_INTERVALS.SEARCH_HISTORY,
    !!user?.uid
  );

  const recordSearch = (searchTerm) => {
    if (!user?.uid || !searchTerm?.trim()) return;
    recordSearchMutation.mutate({ userId: user.uid, searchTerm });
  };

  const clearSearchHistory = () => {
    if (!user?.uid) return;
    clearHistoryMutation.mutate(user.uid);
  };

  return {
    searchHistory: query.data?.searches || {},
    topSearches: query.data?.topSearches || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    recordSearch,
    clearSearchHistory,
    refreshHistory: () => queryClient.invalidateQueries(searchHistoryKeys.byUser(user?.uid)),
    isRecording: recordSearchMutation.isPending,
    isClearing: clearHistoryMutation.isPending,
  };
}

