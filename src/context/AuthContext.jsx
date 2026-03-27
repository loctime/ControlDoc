import { createContext, useState, useEffect, useContext } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../config/firebaseconfig";
import { v4 as uuidv4 } from "uuid";
import { getTenantCollectionPath, getCurrentTenantId } from "../utils/tenantUtils";

export const AuthContext = createContext();
//8
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false); // Para evitar doble signOut
  const [userTenantId, setUserTenantId] = useState(null); // Tenant donde está el usuario
  const [mainCompanyId, setMainCompanyId] = useState(null); // Empresa principal del usuario
  const [activeCompanyId, setActiveCompanyIdState] = useState(null); // Empresa/cliente activo
  const [availableCompanies, setAvailableCompanies] = useState([]); // Empresas disponibles (principal + clientes)

  useEffect(() => {
    console.log("[AuthContext] Observando sesión...");
    let userUnsub = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        console.log("[AuthContext] Sesión cerrada");
        setUser(null);
        setToken(null);
        setUserTenantId(null);
        setMainCompanyId(null);
        setActiveCompanyIdState(null);
        localStorage.removeItem('activeCompanyId');
        setLoading(false);
        if (userUnsub) userUnsub();
        return;
      }

      try {
        console.log("[AuthContext] Usuario autenticado:", firebaseUser.uid);

        // Modelo multi-tenant estricto: buscar usuario solo en tenants/{tenantId}/users del dominio actual
        const currentTenantId = getCurrentTenantId();
        const currentTenantUsersPath = getTenantCollectionPath("users");
        const currentUserRef = doc(db, currentTenantUsersPath, firebaseUser.uid);
        const userSnap = await getDoc(currentUserRef);

        if (!userSnap.exists()) {
          console.log("[AuthContext] Usuario no encontrado en tenant actual:", currentTenantId, "| uid:", firebaseUser.uid);
        } else {
          console.log("[AuthContext] Usuario encontrado en tenant actual:", currentTenantId);
        }

        if (!userSnap.exists()) {
          console.warn("[AuthContext] Usuario no encontrado en el tenant del dominio actual.");
          setUser(null);
          setToken(null);
          setLoading(false);
          if (userUnsub) userUnsub();
          return;
        }

        const actualTenantId = currentTenantId;
        console.log('[AuthContext] Estableciendo userTenantId:', actualTenantId);
        setUserTenantId(actualTenantId);

        const userRef = doc(db, `tenants/${actualTenantId}/users`, firebaseUser.uid);

        // --- SESIÓN ÚNICA ---
        let sessionId = localStorage.getItem("sessionId");
        if (!sessionId) {
          sessionId = uuidv4();
          localStorage.setItem("sessionId", sessionId);
        }
        // Guardar sessionId en Firestore usando ruta de tenant
        await setDoc(userRef, { sessionId, lastActive: Date.now() }, { merge: true });

        // Listener para detectar si la sesión fue reemplazada - MEJORADO
        if (userUnsub) userUnsub();
        userUnsub = onSnapshot(userRef, (snap) => {
          const data = snap.data();
          const firestoreSessionId = data?.sessionId;
          const localSessionId = localStorage.getItem("sessionId");
          
          // Solo verificar sesión si tenemos ambos IDs y no hemos verificado ya
          if (firestoreSessionId && localSessionId && firestoreSessionId !== localSessionId && !sessionChecked) {
            setSessionChecked(true);
            console.warn("[AuthContext] Esta cuenta se ha conectado en otro dispositivo. Cerrando sesión local.");
            
            // Usar confirm en lugar de alert para mejor UX
            const confirmLogout = confirm("Esta cuenta se ha conectado en otro dispositivo. ¿Deseas cerrar esta sesión?");
            if (confirmLogout) {
              signOut(auth);
            } else {
              // Si el usuario no quiere cerrar sesión, actualizar el sessionId local
              localStorage.setItem("sessionId", firestoreSessionId);
              setSessionChecked(false);
            }
          }
        }, (error) => {
          console.error("[AuthContext] Error en listener de sesión:", error);
        });
        // --- FIN SESIÓN ÚNICA ---

        const userData = userSnap.data();
        const role = userData.role || "user";

        const idToken = await firebaseUser.getIdToken(true); // fuerza renovación inicial

        const combinedUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role,
          ...userData,
        };

        setUser(combinedUser);
        setToken(idToken);

        // Establecer empresa principal del usuario
        const userMainCompanyId = userData.companyId || null;
        setMainCompanyId(userMainCompanyId);

        // Inicializar activeCompanyId desde localStorage o usar mainCompanyId
        const savedActiveCompanyId = localStorage.getItem('activeCompanyId');
        if (savedActiveCompanyId && userMainCompanyId) {
          // Validar que el savedActiveCompanyId sea válido (empresa principal o cliente)
          setActiveCompanyIdState(savedActiveCompanyId);
        } else if (userMainCompanyId) {
          setActiveCompanyIdState(userMainCompanyId);
          localStorage.setItem('activeCompanyId', userMainCompanyId);
        }

        // Renovar token automáticamente cada vez que cambia
        firebaseUser.getIdTokenResult().then(result => {
          const expiresAt = new Date(result.expirationTime);
          const now = new Date();
          const timeToExpire = expiresAt.getTime() - now.getTime() - 60000; // 1 min antes

          if (timeToExpire > 0) {
            setTimeout(async () => {
              const refreshedToken = await firebaseUser.getIdToken(true);
              setToken(refreshedToken);
              console.log("[AuthContext] Token renovado automáticamente");
            }, timeToExpire);
          }
        });

      } catch (err) {
        console.error("[AuthContext] Error cargando datos:", err);
        setUser(null);
        setToken(null);
        setMainCompanyId(null);
        setActiveCompanyIdState(null);
        localStorage.removeItem('activeCompanyId');
      } finally {
        setLoading(false);
      }
    });

    return () => {
      console.log("[AuthContext] Finalizando observer");
      unsubscribe();
      if (userUnsub) userUnsub();
    };
  }, []);

  // Función helper para obtener la ruta de colección del tenant del usuario
  const getUserTenantCollectionPath = (collectionName) => {
    if (!userTenantId) {
      console.log('[AuthContext] getUserTenantCollectionPath: userTenantId no está definido');
      return null;
    }
    const path = `tenants/${userTenantId}/${collectionName}`;
    console.log('[AuthContext] getUserTenantCollectionPath:', path);
    return path;
  };

  // Función para cambiar la empresa activa
  const setActiveCompanyId = (companyId) => {
    if (companyId) {
      setActiveCompanyIdState(companyId);
      localStorage.setItem('activeCompanyId', companyId);
    } else {
      // Si no se proporciona companyId, usar la empresa principal
      if (mainCompanyId) {
        setActiveCompanyIdState(mainCompanyId);
        localStorage.setItem('activeCompanyId', mainCompanyId);
      }
    }
  };

  // Cargar empresas disponibles cuando cambia mainCompanyId
  useEffect(() => {
    const loadAvailableCompanies = async () => {
      if (!mainCompanyId || !userTenantId) {
        setAvailableCompanies([]);
        return;
      }

      try {
        const companiesPath = `tenants/${userTenantId}/companies`;
        
        // Obtener empresa principal directamente por ID
        const mainCompanyRef = doc(db, companiesPath, mainCompanyId);
        
        // Obtener clientes (empresas con parentCompanyId === mainCompanyId)
        const clientsQuery = query(
          collection(db, companiesPath),
          where('parentCompanyId', '==', mainCompanyId),
          where('active', '==', true)
        );

        const [mainDoc, clientsSnapshot] = await Promise.all([
          getDoc(mainCompanyRef),
          getDocs(clientsQuery)
        ]);

        const companies = [];

        // Agregar empresa principal
        if (mainDoc.exists()) {
          const mainData = mainDoc.data();
          companies.push({
            id: mainDoc.id,
            companyId: mainDoc.id,
            companyName: mainData.companyName || mainData.name || 'Sin nombre',
            type: mainData.type || 'main',
            parentCompanyId: mainData.parentCompanyId || null,
            isMain: true,
            ...mainData
          });
        }

        // Agregar clientes
        clientsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          companies.push({
            id: doc.id,
            companyId: doc.id,
            companyName: data.companyName || data.name || 'Sin nombre',
            type: data.type || 'client',
            parentCompanyId: data.parentCompanyId,
            isMain: false,
            ...data
          });
        });

        setAvailableCompanies(companies);
      } catch (error) {
        console.error('[AuthContext] Error cargando empresas disponibles:', error);
        setAvailableCompanies([]);
      }
    };

    loadAvailableCompanies();
  }, [mainCompanyId, userTenantId]);

  const finalActiveCompanyId = activeCompanyId || mainCompanyId;
  
  // Log cuando cambia activeCompanyId
  useEffect(() => {
    if (import.meta.env.DEV && finalActiveCompanyId) {
      console.log('[AuthContext] activeCompanyId actualizado:', {
        activeCompanyId,
        mainCompanyId,
        finalActiveCompanyId,
        isMain: finalActiveCompanyId === mainCompanyId
      });
    }
  }, [activeCompanyId, mainCompanyId, finalActiveCompanyId]);
  
  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      userTenantId, 
      getUserTenantCollectionPath,
      mainCompanyId,
      activeCompanyId: finalActiveCompanyId,
      availableCompanies,
      setActiveCompanyId
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};

export default AuthProvider;
