import { useEffect } from 'react';
import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./router/AppRouter";
import "./App.css";
import { CompaniesProvider } from "./context/CompaniesContext";
import { AppConfigProvider } from './context/AppConfigContext';
import { TenantProvider } from './context/TenantContext';
import { RefreshProvider } from './context/RefreshContext';
import { QueryProviderWithPolling } from './context/QueryProvider';
import ForceLogoutOnMount from "./ForceLogoutOnMount";
import ErrorBoundary from "./components/common/ErrorBoundary";
import DynamicThemeProvider from "./components/DynamicThemeProvider";

function App() {
  useEffect(() => {
    // Ping al servidor cada 5 minutos para mantenerlo activo
    const pingServer = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/ping`, {
          mode: 'no-cors'
        });
        console.log('Ping enviado (modo no-cors)');
      } catch {
        console.warn('Error esperado en modo no-cors');
      }
    };

    pingServer(); // Primer ping al cargar
    const interval = setInterval(pingServer, 5 * 60 * 1000); // Cada 5 minutos

    return () => clearInterval(interval); // Limpiar al desmontar
  }, []);

  return (
    <ErrorBoundary>
      <DynamicThemeProvider>
        <QueryProviderWithPolling>
          <TenantProvider>
            <AppConfigProvider>
              <AuthProvider>
                <CompaniesProvider>
                  <RefreshProvider>
                    <ForceLogoutOnMount />
                    <AppRouter />
                  </RefreshProvider>
                </CompaniesProvider>
              </AuthProvider>
            </AppConfigProvider>
          </TenantProvider>
        </QueryProviderWithPolling>
      </DynamicThemeProvider>
    </ErrorBoundary>
  );
}

export default App;