// src/component/administrador/AdminPage.jsx
import { useState } from 'react';
import { CompaniesProvider, useCompanyList } from '../../context/CompaniesContext'; // ✅ reemplazo correcto
import AdminCompanySelector from './AdminCompanySelector';
import AdminDashboard from './AdminDashboard';
import AdminUploadedDocumentsPage from './AdminUploadedDocumentsPage';
import AdminRequiredDocumentsPage from './DocumentoRequerido/AdmRequiereDoc';
import DocumentLibraryPage from '../DocumentLibraryPage';
import AdminStore from './AdminStore';
import { Box, Tabs, Tab, Typography, Paper } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Description as DescriptionIcon,
  Business as BusinessIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Folder as FolderIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import AdminCompaniesPage from './AdminCompaniesPage';
import DebugUserRole from './AdminPanel/DebugUserRole';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
      style={{ padding: '8px 0', height: '100%' }}
    >
      {value === index && <Box sx={{ height: '100%' }}>{children}</Box>}
    </div>
  );
}

function AdminTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = parseInt(searchParams.get('tab')) || 0;
  const [tabValue, setTabValue] = useState(initialTab);
  const { selectedCompanyName, selectedCompanyId } = useCompanyList(); // ✅ correcto uso

  const tabConfig = [
    { icon: <DashboardIcon sx={{ color: "inherit" }} />, label: 'Dashboard', content: <AdminDashboard /> },
    { icon: <DescriptionIcon sx={{ color: "inherit" }} />, label: 'Administrar Documentos', content: <AdminUploadedDocumentsPage /> },
    { icon: <AssignmentTurnedInIcon sx={{ color: "inherit" }} />, label: 'Documentos Requeridos', content: <AdminRequiredDocumentsPage /> },
    { icon: <FolderIcon sx={{ color: "inherit" }} />, label: 'Biblioteca de Documentos', content: <DocumentLibraryPage /> },
    { icon: <StorageIcon sx={{ color: "inherit" }} />, label: 'Almacenamiento', content: <AdminStore /> },
    { icon: <BusinessIcon sx={{ color: "inherit" }} />, label: 'Debug Rol', content: <DebugUserRole /> }
  ];

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setSearchParams({ tab: newValue });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'var(--divider-color)' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable" 
          scrollButtons="auto"
          textColor="primary"
          indicatorColor="primary"
          sx={{ 
            minHeight: '48px',
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
          {tabConfig.map((tab, index) => (
            <Tab 
              key={index} 
              icon={tab.icon} 
              label={tab.label} 
              iconPosition="start" 
              sx={{ 
                minHeight: '48px', 
                py: 0,
                "&.Mui-selected": {
                  color: "var(--tab-active-text) !important"
                }
              }}
            />
          ))}
        </Tabs>
      </Box>

      {selectedCompanyName && (
        <Typography variant="subtitle2" sx={{ mt: 1, px: 2, color: "var(--page-background-text)" }}>
          Empresa seleccionada: <strong>{selectedCompanyName}</strong>
        </Typography>
      )}

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tabConfig.map((tab, index) => (
          <TabPanel key={index} value={tabValue} index={index}>
            {tab.content}
          </TabPanel>
        ))}
      </Box>
    </Box>
  );
}

export default function AdminPage() {
  return (
    <CompaniesProvider>
      <Box sx={{ 
        p: 1,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Encabezado compacto */}
        <Box sx={{ 
          mb: 0.5,
          p: 1,
          backgroundColor: 'var(--paper-background)',
          borderRadius: 1,
          boxShadow: 1
        }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', color: "var(--paper-background-text)" }}>
            <BusinessIcon sx={{ mr: 1, fontSize: 'inherit', color: "var(--paper-background-text)" }} />
            Panel de Administración
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>
            Gestión de empresas y documentos
          </Typography>
        </Box>

        {/* Layout principal sin padding adicional */}
        <Box sx={{ 
          flex: 1,
          display: 'flex',
          gap: 1,
          overflow: 'hidden'
        }}>
          {/* Panel de empresas (ancho fijo) */}
          <Paper elevation={1} sx={{ 
            width: 300,
            p: 1,
            overflow: 'auto',
            flexShrink: 0
          }}>
            <AdminCompaniesPage />
          </Paper>

          {/* Contenido principal */}
          <Box sx={{ 
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflow: 'hidden'
          }}>
            <AdminTabs />
          </Box>
        </Box>
      </Box>
    </CompaniesProvider>
  );
}
