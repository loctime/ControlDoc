import React, { createContext, useContext, useState, useCallback } from "react";

const RefreshContext = createContext(null);

/**
 * Hook para forzar recarga de datos cuando otro tab (u otra parte de la app) cambia datos.
 * - triggerRefresh(key): dispara un refresh para esa clave; los componentes que usan getRefreshKey(key) reaccionan.
 * - getRefreshKey(key): devuelve un número que cambia cada vez que se llama triggerRefresh(key); usarlo en useEffect o como key prop.
 */
export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error("useRefresh debe usarse dentro de RefreshProvider");
  }
  return context;
}

export function RefreshProvider({ children }) {
  const [keys, setKeys] = useState({});

  const triggerRefresh = useCallback((key) => {
    setKeys((prev) => ({
      ...prev,
      [key]: (prev[key] ?? 0) + 1
    }));
  }, []);

  const getRefreshKey = useCallback(
    (key) => {
      return keys[key] ?? 0;
    },
    [keys]
  );

  const value = {
    triggerRefresh,
    getRefreshKey
  };

  return (
    <RefreshContext.Provider value={value}>
      {children}
    </RefreshContext.Provider>
  );
}

export default RefreshContext;
