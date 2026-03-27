import React from 'react';
import { useTenant } from '../context/TenantContext';

/**
 * Hook para verificar si el tenant está listo y válido
 * @returns {Object} { isReady, loading, error }
 */
export function useTenantReady() {
  const { tenantId, tenantInfo, isValid, loading, error } = useTenant();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // El tenant está listo cuando:
    // 1. No está cargando
    // 2. Es válido
    // 3. No hay errores
    // 4. Tenemos información del tenant
    if (!loading && isValid && !error && tenantInfo) {
      setIsReady(true);
    } else if (!loading && (error || !isValid)) {
      setIsReady(false);
    }
  }, [loading, isValid, error, tenantInfo]);

  return {
    isReady,
    loading,
    error,
    tenantId,
    tenantInfo
  };
}



