// src/component/administrador/AdminDashboardQuery.jsx
import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@mui/material";
import { db } from "../../config/firebaseconfig";
import CompactStatusRow from "./dashboard/CompactStatusRow";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "firebase/firestore";
import { useCompanies } from "../../context/CompaniesContext";
import { parseFirestoreDate } from "../../utils/dateHelpers";
import { useAdminDashboardQuery } from "../../hooks/queries/useAdminQueries";
import { useDocumentAlertsQuery } from "../../hooks/useDocumentAlertsQuery";
import {
  Box,
  Typography,
  Grid,
  Tooltip,
  Paper,
  Button
} from "@mui/material";
import {
  Cancel as CancelIcon,
  Pending as PendingIcon,
  Error as ErrorIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from "@mui/icons-material";

// Subcomponentes
import { lazy, Suspense } from "react";
const EmpresasTable = lazy(() => import("./dashboard/EmpresasTable"));
import AdminEmpresas from "./dashboard/AdminEmpresas";
import PreviewDocumentTable from "./dashboard/PreviewDocumentTable";

import { AuthContext } from "../../context/AuthContext";
import { getTenantCollectionPath } from '../../utils/tenantUtils';

// --- FUNCIÓN PARA MAPEAR LOS DATOS DE ESTADO ---
function getStatusData(previewDocs, companies) {
  // Validar que sean arrays
  const safePreviewDocs = Array.isArray(previewDocs) ? previewDocs : [];
  
  // --- POR VENCER ---
  const porVencer = safePreviewDocs.filter(doc => {
    const exp = parseFirestoreDate(doc.expirationDate);
    if (!exp) return false;
    const hoy = new Date();
    const diasRestantes = Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24));
    return diasRestantes > 0 && diasRestantes <= 10;
  });

  // --- VENCIDOS ---
  const vencidos = safePreviewDocs.filter(doc => {
    const exp = parseFirestoreDate(doc.expirationDate);
    if (!exp) return false;
    const hoy = new Date();
    const diasRestantes = Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24));
    return diasRestantes <= 0;
  });

  // --- SIN FECHA ---
  const sinFecha = safePreviewDocs.filter(doc => !doc.expirationDate);

  // --- PENDIENTES DE APROBACIÓN ---
  const pendientes = safePreviewDocs.filter(doc => doc.status === 'Pendiente de revisión');

  // --- RECHAZADOS ---
  const rechazados = safePreviewDocs.filter(doc => doc.status === 'Rechazado');

  return {
    porVencer: {
      count: porVencer.length,
      docs: porVencer,
      icon: <WarningIcon />,
      color: 'warning',
      label: 'Por vencer (≤10 días)'
    },
    vencidos: {
      count: vencidos.length,
      docs: vencidos,
      icon: <ErrorIcon />,
      color: 'error',
      label: 'Vencidos'
    },
    sinFecha: {
      count: sinFecha.length,
      docs: sinFecha,
      icon: <PendingIcon />,
      color: 'info',
      label: 'Sin fecha de vencimiento'
    },
    pendientes: {
      count: pendientes.length,
      docs: pendientes,
      icon: <PendingIcon />,
      color: 'warning',
      label: 'Pendientes de aprobación'
    },
    rechazados: {
      count: rechazados.length,
      docs: rechazados,
      icon: <CancelIcon />,
      color: 'error',
      label: 'Rechazados'
    }
  };
}

const AdminDashboardQuery = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const empresasTableRef = useRef(null);

  const privilegedRoles = ["admin", "max", "dhhkvja"];
  const userRole = typeof user?.role === "string" ? user.role.trim().toLowerCase() : "user";
  const isPrivileged = privilegedRoles.includes(userRole);

  useEffect(() => {
    if (!user) return;
    if (!isPrivileged) {
      navigate("/usuario/dashboard", { replace: true });
    }
  }, [user, isPrivileged, navigate]);

  if (user && !isPrivileged) {
    return null;
  }

  const { selectedCompany, companies } = useCompanies();
  const selectedCompanyId = selectedCompany?.id || null;
  
  // Usar hooks Query en lugar de useState manual
  const { dashboard, loading: dashboardLoading } = useAdminDashboardQuery();
  const { previewDocs, stats, loading: alertsLoading, empresasConVencidos, empresasPorVencer } = useDocumentAlertsQuery(selectedCompanyId, companies);
  const loading = dashboardLoading || alertsLoading;
  
  // Estados locales que no requieren Query
  const [entityStats, setEntityStats] = useState({
    personal: { habilitados: 0, deshabilitados: 0 },
    vehiculos: { habilitados: 0, deshabilitados: 0 },
    empresas: { habilitadas: 0, deshabilitadas: 0 },
  });
  const [allEntitiesSuspended, setAllEntitiesSuspended] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showDetails, setShowDetails] = useState(null);
  const [checkboxFilters, setCheckboxFilters] = useState({
    vencidos: true,
    sinFecha: true,
    porVencer: true,
    pendientes: true,
    rechazados: true
  });

  // Entity stats y suspended check - mantener lógica local por ahora
  useEffect(() => {
    async function fetchEntityStats() {
      if (!selectedCompanyId) {
        setEntityStats({
          personal: { habilitados: 0, deshabilitados: 0 },
          vehiculos: { habilitados: 0, deshabilitados: 0 },
          empresas: { habilitadas: 0, deshabilitadas: 0 }
        });
        return;
      }

      try {
        // PERSONAS
        const personalPath = getTenantCollectionPath('personal');
        const personalSnap = await getDocs(query(collection(db, personalPath), where('companyId', '==', selectedCompanyId)));
        let habilitadosPersonal = 0, deshabilitadosPersonal = 0;
        personalSnap.docs.forEach(doc => {
          if (doc.data().activo !== false) habilitadosPersonal++;
          else deshabilitadosPersonal++;
        });
        // VEHÍCULOS
        const vehiculosPath = getTenantCollectionPath('vehiculos');
        const vehiculosSnap = await getDocs(query(collection(db, vehiculosPath), where('companyId', '==', selectedCompanyId)));
        let habilitadosVehiculos = 0, deshabilitadosVehiculos = 0;
        vehiculosSnap.docs.forEach(doc => {
          if (doc.data().activo !== false) habilitadosVehiculos++;
          else deshabilitadosVehiculos++;
        });
        // EMPRESAS (en general solo una, pero puede haber lógica multiempresa)
        const companiesPath = getTenantCollectionPath('companies');
        const empresasSnap = await getDocs(query(collection(db, companiesPath), where('id', '==', selectedCompanyId)));
        let habilitadasEmpresas = 0, deshabilitadasEmpresas = 0;
        empresasSnap.docs.forEach(doc => {
          if (doc.data().activo !== false) habilitadasEmpresas++;
          else deshabilitadasEmpresas++;
        });

        setEntityStats({
          personal: { habilitados: habilitadosPersonal, deshabilitados: deshabilitadosPersonal },
          vehiculos: { habilitados: habilitadosVehiculos, deshabilitados: deshabilitadosVehiculos },
          empresas: { habilitadas: habilitadasEmpresas, deshabilitadas: deshabilitadasEmpresas }
        });
      } catch (err) {
        setEntityStats({
          personal: { habilitados: 0, deshabilitados: 0 },
          vehiculos: { habilitados: 0, deshabilitados: 0 },
          empresas: { habilitadas: 0, deshabilitadas: 0 }
        });
      }
    }
    fetchEntityStats();
    
    async function checkAllEntitiesSuspended() {
      if (!selectedCompanyId) {
        setAllEntitiesSuspended(false);
        return;
      }

      try {
        // Verificar personal activo
        const personalPath = getTenantCollectionPath('personal');
        const personalSnap = await getDocs(query(collection(db, personalPath), where('companyId', '==', selectedCompanyId)));
        const anyPersonalActive = personalSnap.docs.some(doc => doc.data().activo !== false);
        // Verificar vehículos activos
        const vehiculosPath = getTenantCollectionPath('vehiculos');
        const vehiculosSnap = await getDocs(query(collection(db, vehiculosPath), where('companyId', '==', selectedCompanyId)));
        const anyVehiculoActive = vehiculosSnap.docs.some(doc => doc.data().activo !== false);
        setAllEntitiesSuspended(!(anyPersonalActive || anyVehiculoActive));
      } catch (err) {
        setAllEntitiesSuspended(false);
      }
    }
    checkAllEntitiesSuspended();
  }, [selectedCompanyId, companies]);

  // Despertar backend Render
  useEffect(() => {
    import('../../utils/wakeRenderBackend').then(({ wakeRenderBackendOnce }) =>
      wakeRenderBackendOnce()
    );
  }, []);

  // Asegurar que previewDocs y companies sean arrays
  const safePreviewDocs = Array.isArray(previewDocs) ? previewDocs : [];
  const safeCompanies = Array.isArray(companies) ? companies : [];

  // Obtener datos de estado usando la función helper
  const statusData = getStatusData(safePreviewDocs, safeCompanies);

  // Filtrar documentos según checkboxes
  const filteredDocs = safePreviewDocs.filter(doc => {
    const exp = parseFirestoreDate(doc.expirationDate);
    const hoy = new Date();
    const diasRestantes = exp ? Math.ceil((exp - hoy) / (1000 * 60 * 60 * 24)) : null;

    if (checkboxFilters.vencidos && diasRestantes !== null && diasRestantes <= 0) return true;
    if (checkboxFilters.porVencer && diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 10) return true;
    if (checkboxFilters.sinFecha && !doc.expirationDate) return true;
    if (checkboxFilters.pendientes && doc.status === 'Pendiente de revisión') return true;
    if (checkboxFilters.rechazados && doc.status === 'Rechazado') return true;
    
    return false;
  });

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" width="100%" height={200} />
        <Skeleton variant="rectangular" width="100%" height={400} sx={{ mt: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header con estadísticas */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <BusinessIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{dashboard?.totalCompanies || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Empresas</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{stats?.totalDocumentos || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Documentos</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <PendingIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{stats?.approvalPending || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Pendientes</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <ErrorIcon color="error" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4">{stats?.rejected || 0}</Typography>
            <Typography variant="body2" color="text.secondary">Rechazados</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Status rows */}
      <Box sx={{ mb: 3 }}>
        {Object.entries(statusData).map(([key, data]) => (
          <CompactStatusRow
            key={key}
            statusKey={key}
            data={data}
            expandedRow={expandedRow}
            setExpandedRow={setExpandedRow}
            showDetails={showDetails}
            setShowDetails={setShowDetails}
            checkboxFilters={checkboxFilters}
            setCheckboxFilters={setCheckboxFilters}
          />
        ))}
      </Box>

      {/* Tabla de empresas */}
      <Suspense fallback={<Skeleton variant="rectangular" width="100%" height={400} />}>
        <EmpresasTable
          ref={empresasTableRef}
          companies={safeCompanies}
          selectedCompanyId={selectedCompanyId}
          entityStats={entityStats}
          allEntitiesSuspended={allEntitiesSuspended}
          empresasConVencidos={empresasConVencidos}
          empresasPorVencer={empresasPorVencer}
        />
      </Suspense>

      {/* Tabla de documentos */}
      <Suspense fallback={<Skeleton variant="rectangular" width="100%" height={400} />}>
        <PreviewDocumentTable
          documents={filteredDocs}
          companies={safeCompanies}
          loading={loading}
        />
      </Suspense>
    </Box>
  );
};

export default AdminDashboardQuery;

