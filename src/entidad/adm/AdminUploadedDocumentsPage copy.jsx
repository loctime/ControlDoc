// src/entidad/adm/AdminUploadedDocumentsPage.jsx
import { useState, useEffect } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import PendientesPage from './Pendientes/PendientesPage';
import EnProcesoPage from './Pendientes/EnProcesoPage';
import HistorialPage from './Pendientes/HistorialPage';
import { useRefresh } from '../../context/RefreshContext';

export default function AdminUploadedDocumentsPage() {
  const [tab, setTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const { getRefreshKey } = useRefresh();

  // Escuchar cambios en el refresh trigger
  useEffect(() => {
    const newRefreshKey = getRefreshKey('historial');
    if (newRefreshKey > 0) {
      setRefreshKey(newRefreshKey);
    }
  }, [getRefreshKey]);

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: "var(--divider-color)", mb: 2 }}>
        <Tabs 
          value={tab} 
          onChange={(e, newValue) => setTab(newValue)}
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
            label="Pendientes" 
            sx={{
              "&.Mui-selected": {
                color: "var(--tab-active-text) !important"
              }
            }}
          />
          <Tab 
            label="En Proceso"
            sx={{
              "&.Mui-selected": {
                color: "var(--tab-active-text) !important"
              }
            }}
          />
          <Tab 
            label="Historial (Aprobados / Rechazados)"
            sx={{
              "&.Mui-selected": {
                color: "var(--tab-active-text) !important"
              }
            }}
          />
        </Tabs>
      </Box>

      {tab === 0 && <PendientesPage />}
      {tab === 1 && <EnProcesoPage />}
      {tab === 2 && <HistorialPage key={refreshKey} />}
    </Box>
  );
}
