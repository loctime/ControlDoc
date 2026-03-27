// src/hooks/useSmartPolling.js
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { POLLING_INTERVALS } from '../config/queryConfig';

/**
 * Hook para polling inteligente basado en:
 * - Visibilidad de la página
 * - Estado de conexión
 * - Actividad del usuario
 * - Prioridad de los datos
 */
export function useSmartPolling() {
  const queryClient = useQueryClient();
  const intervalsRef = useRef(new Map());
  const lastActivityRef = useRef(Date.now());
  const isVisibleRef = useRef(!document.hidden);
  const isOnlineRef = useRef(navigator.onLine);

  // Función para configurar polling
  const setPolling = useCallback((queryKey, interval, priority = 'normal') => {
    const key = Array.isArray(queryKey) ? queryKey.join('.') : queryKey;
    
    // Limpiar intervalo anterior si existe
    if (intervalsRef.current.has(key)) {
      clearInterval(intervalsRef.current.get(key));
    }

    // Calcular intervalo ajustado según condiciones
    const getAdjustedInterval = () => {
      let adjustedInterval = interval;

      // Reducir frecuencia si la página no es visible
      if (!isVisibleRef.current) {
        adjustedInterval *= 3; // 3x más lento
      }

      // Reducir frecuencia si no hay conexión
      if (!isOnlineRef.current) {
        adjustedInterval *= 5; // 5x más lento
      }

      // Ajustar según prioridad
      switch (priority) {
        case 'high':
          adjustedInterval *= 0.5; // 2x más rápido
          break;
        case 'low':
          adjustedInterval *= 2; // 2x más lento
          break;
        case 'critical':
          adjustedInterval *= 0.25; // 4x más rápido
          break;
      }

      return Math.max(adjustedInterval, 5000); // Mínimo 5 segundos
    };

    // Función de invalidación
    const invalidate = () => {
      if (isVisibleRef.current && isOnlineRef.current) {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    // Configurar intervalo
    const intervalId = setInterval(invalidate, getAdjustedInterval());
    intervalsRef.current.set(key, intervalId);

    return () => {
      if (intervalsRef.current.has(key)) {
        clearInterval(intervalsRef.current.get(key));
        intervalsRef.current.delete(key);
      }
    };
  }, [queryClient]);

  // Función para limpiar todos los intervalos
  const clearAllPolling = useCallback(() => {
    intervalsRef.current.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    intervalsRef.current.clear();
  }, []);

  // Función para pausar/reanudar polling
  const pausePolling = useCallback(() => {
    intervalsRef.current.forEach((intervalId) => {
      clearInterval(intervalId);
    });
  }, []);

  const resumePolling = useCallback(() => {
    // Reconfigurar todos los intervalos
    intervalsRef.current.forEach((intervalId, key) => {
      const queryKey = key.split('.');
      const interval = POLLING_INTERVALS.DASHBOARD; // Default
      setPolling(queryKey, interval);
    });
  }, [setPolling]);

  // Manejar cambios de visibilidad
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      
      if (document.hidden) {
        pausePolling();
      } else {
        resumePolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pausePolling, resumePolling]);

  // Manejar cambios de conexión
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      resumePolling();
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      pausePolling();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pausePolling, resumePolling]);

  // Manejar actividad del usuario
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, []);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      clearAllPolling();
    };
  }, [clearAllPolling]);

  return {
    setPolling,
    clearAllPolling,
    pausePolling,
    resumePolling,
    isVisible: isVisibleRef.current,
    isOnline: isOnlineRef.current,
    lastActivity: lastActivityRef.current,
  };
}

