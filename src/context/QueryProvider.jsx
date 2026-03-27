import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { useSmartPolling } from '../hooks/useSmartPolling';

export function QueryProvider({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutos
        gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
        retry: (failureCount, error) => {
          // No reintentar en errores 4xx
          if (error?.response?.status >= 400 && error?.response?.status < 500) {
            return false;
          }
          return failureCount < 3;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

// Componente interno para inicializar polling después del provider
function SmartPollingWrapper({ children }) {
  useSmartPolling();
  return <>{children}</>;
}

// Exportar wrapper combinado
export function QueryProviderWithPolling({ children }) {
  return (
    <QueryProvider>
      <SmartPollingWrapper>
        {children}
      </SmartPollingWrapper>
    </QueryProvider>
  );
}
