// src/config/queryConfig.js
// Configuración centralizada de polling intervals para TanStack Query

export const POLLING_INTERVALS = {
  // Críticos - actualización frecuente
  DASHBOARD: 10 * 1000,        // 10s - Dashboard principal
  NOTIFICATIONS: 15 * 1000,    // 15s - Notificaciones admin
  DOCUMENT_ALERTS: 20 * 1000,  // 20s - Alertas de documentos
  
  // Moderados - actualización regular
  COMPANY_STATS: 30 * 1000,    // 30s - Estadísticas de empresa
  DOCUMENT_LIST: 30 * 1000,    // 30s - Lista de documentos
  PENDING_DOCS: 30 * 1000,     // 30s - Documentos pendientes
  
  // Bajos - actualización ocasional
  SEARCH_HISTORY: 60 * 1000,   // 60s - Historial de búsquedas
  BACKUPS: 120 * 1000,         // 2min - Lista de backups
  LIBRARY: 60 * 1000,          // 60s - Biblioteca de documentos
  
  // Estáticos - sin polling
  STATIC: false,               // Sin refetch automático
};

export const QUERY_DEFAULTS = {
  // Configuración por defecto para queries
  staleTime: 5 * 60 * 1000,    // 5 minutos
  gcTime: 10 * 60 * 1000,      // 10 minutos (antes cacheTime)
  retry: (failureCount, error) => {
    // No reintentar errores 4xx (client errors)
    if (error?.response?.status >= 400 && error?.response?.status < 500) {
      return false;
    }
    // Reintentar hasta 3 veces para otros errores
    return failureCount < 3;
  },
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
};

export const MUTATION_DEFAULTS = {
  // Configuración por defecto para mutations
  retry: 1,
  onError: (error) => {
    console.error('Mutation error:', error);
  },
};

