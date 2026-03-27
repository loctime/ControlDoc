// src/context/CompaniesContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { db } from "../config/firebaseconfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getTenantCollectionPath } from "../utils/tenantUtils";
import { useAuth } from "./AuthContext";

export const CompaniesContext = createContext();

export const CompaniesProvider = ({ children }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      // 🔥 USAR RUTA DE TENANT PARA CONSULTAR EMPRESAS
      const tenantCompaniesPath = getTenantCollectionPath("companies");
      
      // 🔥 Filtrar por assignedAdminIds que contenga el usuario actual
      // También buscar empresas con assignedAdminId (formato antiguo) para compatibilidad
      if (!user?.uid) {
        setCompanies([]);
        setLoading(false);
        return;
      }
      
      // Hacer dos consultas: una para assignedAdminIds (nuevo formato) y otra para assignedAdminId (antiguo)
      const [newFormatSnapshot, oldFormatSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, tenantCompaniesPath),
          where("assignedAdminIds", "array-contains", user.uid),
          where("status", "==", "approved")
        )),
        getDocs(query(
          collection(db, tenantCompaniesPath),
          where("assignedAdminId", "==", user.uid),
          where("status", "==", "approved")
        ))
      ]);
      
      // Combinar resultados y eliminar duplicados
      const companiesMap = new Map();
      
      [...newFormatSnapshot.docs, ...oldFormatSnapshot.docs].forEach(doc => {
        if (!companiesMap.has(doc.id)) {
          const data = doc.data();
          companiesMap.set(doc.id, {
            id: doc.id,
            name: data.name || data.companyName || "Sin nombre",
            ...data
          });
        }
      });
      
      const sortedCompanies = Array.from(companiesMap.values())
        .filter(company => 
          (company.type !== 'client' || !company.type) // Solo empresas principales, no clientes
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setCompanies(sortedCompanies);
    } catch (err) {
      setError('Error al cargar empresas del tenant');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  return (
    <CompaniesContext.Provider value={{
      companies,
      selectedCompany,
      selectCompany: setSelectedCompany,
      clearSelection: () => setSelectedCompany(null),
      refresh: fetchCompanies,
      loading,
      error
    }}>
      {children}
    </CompaniesContext.Provider>
  );
};

export function useCompanies() {
  const context = useContext(CompaniesContext);
  if (!context) throw new Error("useCompanies must be used within CompaniesProvider");
  return context;
};

export const useCompanyList = useCompanies; // Alias para compatibilidad
