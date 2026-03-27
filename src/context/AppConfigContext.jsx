// src/context/AppConfigContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebaseconfig';
import { getTenantCollectionPath } from '../utils/tenantUtils';

export const AppConfigContext = createContext();

export function AppConfigProvider({ children }) {
  const [appLogo, setAppLogo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Obtener logo activo al iniciar
  useEffect(() => {
    const fetchActiveLogo = async () => {
      try {
        // Usar la ruta multi-tenant correcta
        const configPath = getTenantCollectionPath('config');
        const docRef = doc(db, `${configPath}/appConfig`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAppLogo(docSnap.data().activeLogoUrl);
        }
      } catch (error) {
        console.error('Error loading logo:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveLogo();
  }, []);

  // Actualizar logo en Firestore
  const updateAppLogo = async (logoUrl) => {
    try {
      console.log('Actualizando logo en contexto:', logoUrl);
      // Usar la ruta multi-tenant correcta
      const configPath = getTenantCollectionPath('config');
      console.log('Ruta de configuración:', configPath);
      await setDoc(doc(db, `${configPath}/appConfig`), {
        activeLogoUrl: logoUrl,
        lastUpdated: new Date()
      }, { merge: true });
      console.log('Logo guardado en Firestore, actualizando estado local');
      setAppLogo(logoUrl);
      console.log('Estado del logo actualizado:', logoUrl);
    } catch (error) {
      console.error('Error updating logo:', error);
      throw error;
    }
  };

  return (
    <AppConfigContext.Provider value={{ 
      appLogo, 
      setAppLogo: updateAppLogo,
      loading 
    }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
