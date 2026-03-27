import React, { useState, useEffect } from "react";
import { Box, Tabs, Tab, Typography } from "@mui/material";
import { useAuth } from "../../../context/AuthContext";
import AdminDel from "./adminDel";
import CompanyDel from "./companyDel";
import CompanyAssignments from "./CompanyAssignments";
import { useCompanyList } from "../../../context/CompaniesContext";

const AdminCompaniesPage = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const { companies } = useCompanyList();

  // Log para ver el rol del usuario
  useEffect(() => {
    console.log('🔍 [AdminCompaniesPage] Información del usuario:', {
      role: user?.role,
      email: user?.email,
      uid: user?.uid,
      displayName: user?.displayName
    });
  }, [user]);

  // Estados para conteos
  const [adminCount, setAdminCount] = useState(0);
  const [pendingCompanyCount, setPendingCompanyCount] = useState(0);
  const [pendingAdminCount, setPendingAdminCount] = useState(0);
  const [companyCount, setCompanyCount] = useState(companies?.length ?? 0);

  // Redirige a pestaña 0 si no es admin ni max y está en pestaña 1 o 2
  useEffect(() => {
    const canAccessTabs1and2 = user?.role === "admin" || user?.role === "max";
    if (!canAccessTabs1and2 && (tabValue === 1 || tabValue === 2)) {
      setTabValue(0);
    }
  }, [user]);

  return (
    <Box p={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" sx={{ color: "var(--page-background-text)" }}>Gestión de Empresas</Typography>
      </Box>
      <Box sx={{ borderBottom: 1, borderColor: "var(--divider-color)", mb: 2 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          textColor="primary"
          indicatorColor="primary"
          sx={{
            "& .MuiTab-root": {
              color: "var(--page-background-text)"
            },
            "& .MuiTab-root.Mui-selected": {
              color: "var(--tab-active-text) !important"
            },
            "& .MuiTabs-indicator": {
              backgroundColor: "var(--tab-active-text) !important"
            }
          }}
        >
          <Tab 
            label={`Empresas Activas (${companyCount})`} 
              sx={{
                "&.Mui-selected": {
                  color: "var(--tab-active-text) !important"
                }
              }}
          />
          {(user?.role === "admin" || user?.role === "max") && (
          <Tab 
            label="Gestión de Asignaciones"
            sx={{
              "&.Mui-selected": {
                color: "var(--tab-active-text) !important"
              }
            }}
          />
          )}
          {(user?.role === "admin" || user?.role === "max") && (
            <Tab 
              label={`Administradores Activos (${adminCount})`} 
              sx={{
                "&.Mui-selected": {
                  color: "var(--primary-main) !important"
                }
              }}
            />
          )}
        </Tabs>
      </Box>
      {tabValue === 0 && (
        <CompanyDel
          tabValue={tabValue}
          setCompanyCount={setCompanyCount}
          setPendingCompanyCount={setPendingCompanyCount}
        />
      )}
      {(user?.role === "admin" || user?.role === "max") && tabValue === 1 && (
        <CompanyAssignments />
      )}
      {(user?.role === "admin" || user?.role === "max") && tabValue === 2 && (
        <AdminDel
          tabValue={tabValue}
          setAdminCount={setAdminCount}
          setPendingAdminCount={setPendingAdminCount}
        />
      )}
    </Box>
  );
}

export default AdminCompaniesPage;
