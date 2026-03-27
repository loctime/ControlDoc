import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';

/**
 * Hook personalizado para manejar el estado de autenticación de manera más robusta
 * Evita problemas de race conditions y estados inconsistentes
 */
export function useAuthState() {
  const { user, loading: authLoading, userTenantId } = useAuth();
  const { isValid: tenantValid, loading: tenantLoading } = useTenant();
  const [isReady, setIsReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  const checkAuthState = useCallback(() => {
    // Solo considerar listo cuando ambos contextos estén cargados
    if (authLoading || tenantLoading) {
      setIsReady(false);
      return;
    }

    // Si no hay tenant válido, hay un error
    if (!tenantValid) {
      setAuthError('Tenant no válido');
      setIsReady(true);
      return;
    }

    // Si hay usuario pero no tiene tenant asignado, hay inconsistencia
    if (user && !userTenantId) {
      console.warn('[useAuthState] Usuario sin tenant asignado, puede indicar inconsistencia');
      setAuthError('Inconsistencia en datos de usuario');
      setIsReady(true);
      return;
    }

    // Todo está bien
    setAuthError(null);
    setIsReady(true);
  }, [authLoading, tenantLoading, tenantValid, user, userTenantId]);

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  const isAuthenticated = isReady && user && !authError;
  const isLoading = !isReady;
  const hasError = isReady && authError;

  return {
    user,
    isAuthenticated,
    isLoading,
    hasError,
    authError,
    userTenantId,
    tenantValid,
    retry: checkAuthState
  };
}

/**
 * Hook para verificar si el usuario puede acceder a una ruta específica
 */
export function useRouteAccess(allowedRoles = []) {
  const { user, isAuthenticated, hasError } = useAuthState();
  
  if (!isAuthenticated || hasError) {
    return {
      canAccess: false,
      reason: hasError ? 'error' : 'not_authenticated'
    };
  }

  const privilegedRoles = ["admin", "max", "dhhkvja"];
  const userRole = typeof user.role === "string" ? user.role.trim().toLowerCase() : "user";
  
  const isPrivileged = privilegedRoles.includes(userRole);
  const isAllowed = isPrivileged || allowedRoles.includes(userRole);
  
  if (!isAllowed) {
    return {
      canAccess: false,
      reason: 'insufficient_permissions'
    };
  }

  // Verificar estado de aprobación para usuarios no privilegiados
  if (!isPrivileged) {
    const isApproved = user.status === "approved" || user.companyStatus === "approved";
    if (!isApproved) {
      return {
        canAccess: false,
        reason: 'pending_approval'
      };
    }
  }

  return {
    canAccess: true,
    reason: null,
    userRole,
    isPrivileged
  };
}
