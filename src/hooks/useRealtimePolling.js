// src/hooks/useRealtimePolling.js
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { POLLING_INTERVALS } from '../config/queryConfig';

/**
 * Hook para simular listeners Firebase con polling inteligente
 * @param {string} queryKey - Query key a invalidar
 * @param {number} interval - Intervalo en ms (usar POLLING_INTERVALS)
 * @param {boolean} enabled - Si el polling está habilitado
 */
export function useRealtimePolling(queryKey, interval, enabled = true) {
  const queryClient = useQueryClient();
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled || !queryKey || !interval) return;

    // Limpiar intervalo anterior
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Configurar nuevo intervalo
    intervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({ queryKey });
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [queryKey, interval, enabled, queryClient]);

  return {
    startPolling: () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey });
      }, interval);
    },
    stopPolling: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    },
    isPolling: !!intervalRef.current
  };
}

/**
 * Hook para polling condicional basado en visibilidad de página
 * @param {string} queryKey - Query key a invalidar
 * @param {number} interval - Intervalo en ms
 */
export function useVisibilityPolling(queryKey, interval) {
  const queryClient = useQueryClient();
  const intervalRef = useRef(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pausar polling cuando la página no es visible
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Reanudar polling cuando la página es visible
        if (!intervalRef.current && queryKey && interval) {
          intervalRef.current = setInterval(() => {
            queryClient.invalidateQueries({ queryKey });
          }, interval);
        }
      }
    };

    // Configurar listener de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Iniciar polling si la página es visible
    if (!document.hidden && queryKey && interval) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey });
      }, interval);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [queryKey, interval, queryClient]);
}

