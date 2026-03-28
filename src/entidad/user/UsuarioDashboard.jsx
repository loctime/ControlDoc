import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { auth } from "../../config/firebaseconfig";
import CompanyStatusBadge from "./components/CompanyStatusBadge";
import useDashboardDataQuery from "./components/hooks/useDashboardDataQuery";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Button,
  Stack,
  Badge,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip
} from "@mui/material";
import { firebaseSignOut } from "../../config/firebaseconfig";
import DescriptionIcon from "@mui/icons-material/Description";
import PersonIcon from "@mui/icons-material/Person";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import DashboardCustomizeIcon from "@mui/icons-material/DashboardCustomize";
import BusinessIcon from "@mui/icons-material/Business";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import controldocLogo from "../../assets/logos/controldoc-logo.png";
import DocumentosEmpresaForm from "./EmpresaPanel/EmpresaDocumentsPanel";
import DocumentosCustomForm from "./CustomPanel/CustomDocumentsPanel";
import BulkUploadDialog from "./components/BulkUploadDialog";

import CompanyHeader from './components/CompanyHeader';
import PersonalPanel from './PersonalPanel/index.jsx';
import VehiculosPanel from './VehiculosPanel/index.jsx';
import AdvancedDashboardView from "./AdvancedDashboard/AdvancedDashboardView.jsx";
import { getDeadlineColor } from '../../utils/getDeadlineUtils.jsx';
import TourVirtual from "../../components/common/TourVirtual";
import pasosTour from "./userTour";
import CompanySelector from './components/CompanySelector';
import ClientManagement from './components/ClientManagement';

const UsuarioDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser, activeCompanyId, mainCompanyId } = useContext(AuthContext);
  // IMPORTANTE: companyId siempre debe ser mainCompanyId (empresa principal), nunca cambia
  // Lo que cambia es activeCompanyId cuando seleccionas un cliente
  const companyId = mainCompanyId;
  
  if (!companyId) {
    return <Alert severity="error">No se encontró la empresa asignada. Por favor, vuelve a iniciar sesión o contacta al administrador.</Alert>;
  }  
  const [personalRefresh, setPersonalRefresh] = useState(0);

  const [vehiculosRefresh, setVehiculosRefresh] = useState(0);

  const {
    company,
    requiredDocuments,
    uploadedDocuments,
    personal,
    vehiculos,
    loading,
    error,
    refreshUploadedDocuments
  } = useDashboardDataQuery(companyId, personalRefresh, vehiculosRefresh, activeCompanyId, mainCompanyId);

  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [openDocumentosDialog, setOpenDocumentosDialog] = useState(false);
  const [advancedViewEnabled, setAdvancedViewEnabled] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const hasWarningsForType = (type) => {
    const requiredForType = requiredDocuments.filter(doc => doc.entityType === type);
    return requiredForType.some(doc => {
      const uploaded = uploadedDocuments.find(up => up.requiredDocumentId === doc.id);
      return !uploaded || uploaded.status === "Pendiente de revisión" || uploaded.status === "Rechazado" || uploaded.status === "En proceso";
    });
  };

  useEffect(() => {
    import('../../utils/wakeRenderBackend').then(({ wakeRenderBackendOnce }) =>
      wakeRenderBackendOnce()
    );
  }, []);

  // Refresco automático de la pestaña Personal - Mantener este si es necesario para la pestaña Personal
  useEffect(() => {
    if (tabValue !== 3) return;
    const interval = setInterval(() => {
      refreshUploadedDocuments && refreshUploadedDocuments();
    }, 10000); // 10 segundos
    return () => clearInterval(interval);
  }, [tabValue, refreshUploadedDocuments]);

  if (loading && personal.length === 0 && vehiculos.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }} id="user-dashboard-loading">
        <CircularProgress />
      </Box>
    );
  }

  const hasWarningsForPerson = (personaId) => {
    return requiredDocuments || []
      .filter(doc => doc.entityType === "employee")
      .some(doc => {
        const uploaded = uploadedDocuments.find(
          up => up.entityId === personaId && up.requiredDocumentId === doc.id
        );
        return !uploaded || uploaded.status === "Pendiente de revisión" || uploaded.status === "Rechazado" || uploaded.status === "En proceso";
      });
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }} id="user-dashboard-error">
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, padding: '2px', paddingTop: '6px', position: 'relative', overflowX: 'hidden', maxWidth: '100%' }} id="user-dashboard-root">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2
        }}
        id="user-dashboard-header"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} id="user-dashboard-brand">
          <Box
            component="img"
            src={controldocLogo}
            alt="ControlDoc logo"
            sx={{ height: 90, width: 'auto' }}
          />
          <Box>
            <Typography variant="h4" gutterBottom id="user-dashboard-title">
              Bienvenido a tu panel de ControlDoc
            </Typography>
            
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TourVirtual
            steps={pasosTour}
            buttonLabel="Ver tour"
            driverOptions={{
              showProgress: true,
              onHighlightStarted: (element, step) => {
                switch (step.element) {
                  case "#user-dashboard-panel-documentos":
                    setTabValue(0);
                    break;
                  case "#user-dashboard-tab-empresa":
                    setTabValue(1);
                    break;
                  case "#user-dashboard-tab-vehiculos":
                    setTabValue(2);
                    break;
                  case "#user-vehicle-form-paper":
                    setTabValue(2);
                    break;
                  case "#user-dashboard-tab-personal":
                    setTabValue(3);
                    break;
                  case "#user-personal-form-paper":
                    setTabValue(3);
                    break;
                  case "#user-dashboard-advanced-toggle":
                    setAdvancedViewEnabled(false);
                    break;
                  case "#user-dashboard-advanced-tabs":
                  case "#user-dashboard-panel-advanced":
                    setAdvancedViewEnabled(true);
                    break;
                  default:
                    break;
                }
              }
            }}
          />
          <Button
            variant={advancedViewEnabled ? "contained" : "outlined"}
            color="primary"
            startIcon={<DashboardCustomizeIcon />}
            onClick={() => setAdvancedViewEnabled(prev => !prev)}
            sx={{ ml: 1 }}
            id="user-dashboard-advanced-toggle"
          >
            {advancedViewEnabled ? "Cerrar vista avanzada" : "Vista avanzada"}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<ExitToAppIcon />}
            onClick={async () => {
              try {
                await firebaseSignOut(auth);
                window.location.href = '/login';
              } catch (error) {
                console.error("Error al cerrar sesión:", error);
                alert("Ocurrió un error al cerrar sesión. Por favor intenta nuevamente.");
              }
            }}
            sx={{ ml: 2 }}
            id="user-dashboard-logout"
          >
            Cerrar Sesión
          </Button>
        </Box>
      </Box>

      {/* Estado empresa: semáforo */}
      {company && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 2 }} id="user-dashboard-company-status">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CompanyHeader company={company} realemail={currentUser?.realemail} id="user-dashboard-company-header" />
            <CompanyStatusBadge
              company={company}
              realemail={currentUser?.realemail}
              requiredDocuments={requiredDocuments}
              uploadedDocuments={uploadedDocuments}
              id="user-dashboard-company-badge"
            />
          </Box>
          <ClientManagement />
        </Box>
      )}
      {!advancedViewEnabled && (
        <>
          <Box sx={{ width: '100%', mb: 2 }} id="user-dashboard-tabs">
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
              sx={{ minHeight: 40 }}
            >
              <Tab
                icon={<DescriptionIcon fontSize="small" />}
                label="DOCUMENTOS"
                sx={{ minHeight: 40, py: 0.5 }}
                id="user-dashboard-tab-documentos"
              />
              <Tab
                icon={<BusinessIcon fontSize="small" />}
                label="EMPRESA"
                sx={{ minHeight: 40, py: 0.5 }}
                id="user-dashboard-tab-empresa"
              />
              <Tab
                icon={<DirectionsCarIcon fontSize="small" />}
                label="VEHICULOS"
                sx={{ minHeight: 40, py: 0.5 }}
                id="user-dashboard-tab-vehiculos"
              />
              <Tab
                icon={<PersonIcon fontSize="small" />}
                label="PERSONAL"
                sx={{ minHeight: 40, py: 0.5 }}
                id="user-dashboard-tab-personal"
              />
            </Tabs>
          </Box>

          {tabValue === 0 && (
            <Box id="user-dashboard-panel-documentos">
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<DescriptionIcon />}
                  onClick={() => setBulkUploadOpen(true)}
                  id="user-bulk-upload-custom"
                  sx={{ display: 'none' }} // Oculto temporalmente
                >
                  Carga masiva
                </Button>
              </Box>
              <DocumentosCustomForm 
                onDocumentUploaded={refreshUploadedDocuments}
                requiredDocuments={requiredDocuments}
                uploadedDocuments={uploadedDocuments}
              />
            </Box>
          )}
          {tabValue === 3 && (
            <Box id="user-dashboard-panel-personal" sx={{ overflowX: 'hidden', maxWidth: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PersonIcon />}
                  onClick={() => setBulkUploadOpen(true)}
                  id="user-bulk-upload-personal"
                  sx={{ display: 'none' }} // Oculto temporalmente
                >
                  Carga masiva
                </Button>
              </Box>
              <PersonalPanel
                personal={personal}
                onPersonalAdded={() => setPersonalRefresh(k => k + 1)}
                requiredDocuments={requiredDocuments || []}
                uploadedDocuments={uploadedDocuments || []}
                hasWarningsForPerson={hasWarningsForPerson}
                refreshUploadedDocuments={refreshUploadedDocuments}
                getDeadlineColor={getDeadlineColor}
                companyId={companyId}
              />
            </Box>
          )}
          {tabValue === 2 && (
            <Box id="user-dashboard-panel-vehiculos" sx={{ overflowX: 'hidden', maxWidth: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => navigate('/bulk-upload/vehicles' + (activeCompanyId && activeCompanyId !== mainCompanyId ? `?clientId=${activeCompanyId}` : ''))}
                  id="user-bulk-upload-v2-vehiculos"
                >
                  Subida masiva V2 (vehículos)
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<DirectionsCarIcon />}
                  onClick={() => setBulkUploadOpen(true)}
                  id="user-bulk-upload-vehiculos"
                  sx={{ display: 'none' }} // Oculto temporalmente
                >
                  Carga masiva
                </Button>
              </Box>
              <VehiculosPanel
                vehiculos={vehiculos || []}
                requiredDocuments={requiredDocuments || []}
                uploadedDocuments={uploadedDocuments || []}
                refreshUploadedDocuments={refreshUploadedDocuments}
                getDeadlineColor={getDeadlineColor}
                onVehiculoAdded={() => setVehiculosRefresh(k => k + 1)}
              />
            </Box>
          )}
          {tabValue === 1 && (
            <Box id="user-dashboard-panel-empresa">
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<BusinessIcon />}
                  onClick={() => setBulkUploadOpen(true)}
                  id="user-bulk-upload-empresa"
                  sx={{ display: 'none' }} // Oculto temporalmente
                >
                  Carga masiva
                </Button>
              </Box>
              <DocumentosEmpresaForm 
                onDocumentUploaded={refreshUploadedDocuments}
                requiredDocuments={requiredDocuments}
                uploadedDocuments={uploadedDocuments}
              />
            </Box>
          )}
        </>
      )}

      {advancedViewEnabled && (
        <Box id="user-dashboard-panel-advanced">
          <AdvancedDashboardView
            company={company}
            companyId={companyId}
            activeCompanyId={activeCompanyId}
            mainCompanyId={mainCompanyId}
            requiredDocuments={requiredDocuments || []}
            uploadedDocuments={uploadedDocuments || []}
            personal={personal || []}
            vehiculos={vehiculos || []}
            refreshUploadedDocuments={refreshUploadedDocuments}
            currentUser={currentUser}
          />
        </Box>
      )}

      {/* Dialog de carga masiva */}
      <BulkUploadDialog
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onUploadComplete={(results) => {
          console.log('Carga masiva completada:', results);
          refreshUploadedDocuments && refreshUploadedDocuments();
          setBulkUploadOpen(false);
        }}
        entityType={
          tabValue === 1 ? 'company' :
          tabValue === 2 ? 'vehicle' :
          tabValue === 3 ? 'employee' : 'custom'
        }
        companyId={companyId}
      />

    </Box>
  );
};

export default UsuarioDashboard;
