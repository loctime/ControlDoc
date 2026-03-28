import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentTenantId, getTenantInfo, isTenantValid } from '../utils/tenantUtils';

const TenantContext = createContext();

export function TenantProvider({ children }) {
  const [tenantId, setTenantId] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeTenant = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtener el tenant ID del dominio canónico
        const currentTenantId = getCurrentTenantId();
        setTenantId(currentTenantId);

        if (!currentTenantId) {
          setIsValid(false);
          setError('Dominio no permitido o tenant no resoluble');
          return;
        }

        // Verificar si el tenant es válido (los fallos de red se propagan)
        const valid = await isTenantValid();
        setIsValid(valid);

        if (valid) {
          // Obtener información del tenant
          const info = await getTenantInfo();
          setTenantInfo(info);
        } else {
          setError('Tenant no válido o no encontrado');
        }
      } catch (err) {
        console.error('Error inicializando tenant:', err);
        setIsValid(false);
        const msg = String(err?.message || '');
        const offline =
          err?.code === 'unavailable' ||
          msg.includes('offline') ||
          msg.includes('CLIENT_OFFLINE');
        if (offline) {
          setError(
            'No hay conexión con el servicio de datos. Comprueba tu red, VPN o firewall y recarga la página.'
          );
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeTenant();
  }, []);

  const value = {
    tenantId,
    tenantInfo,
    isValid,
    loading,
    error,
    // Función para refrescar el tenant (útil para cambios dinámicos)
    refreshTenant: async () => {
      setLoading(true);
      try {
        setError(null);
        const currentTenantId = getCurrentTenantId();
        setTenantId(currentTenantId);

        if (!currentTenantId) {
          setIsValid(false);
          setError('Dominio no permitido o tenant no resoluble');
          return;
        }

        const valid = await isTenantValid();
        setIsValid(valid);
        
        if (valid) {
          const info = await getTenantInfo();
          setTenantInfo(info);
        } else {
          setError('Tenant no válido o no encontrado');
        }
      } catch (err) {
        setIsValid(false);
        const msg = String(err?.message || '');
        const offline =
          err?.code === 'unavailable' ||
          msg.includes('offline') ||
          msg.includes('CLIENT_OFFLINE');
        setError(
          offline
            ? 'No hay conexión con el servicio de datos. Comprueba tu red, VPN o firewall y recarga la página.'
            : err.message
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant debe ser usado dentro de un TenantProvider');
  }
  return context;
}

// Hook para verificar si el tenant está listo
export function useTenantReady() {
  const { loading, error, isValid } = useTenant();
  
  return {
    isReady: !loading && !error && isValid,
    loading,
    error,
    isValid
  };
}
