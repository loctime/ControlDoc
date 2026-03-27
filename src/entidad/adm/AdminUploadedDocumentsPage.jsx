import React, { useState, Suspense, lazy } from 'react';
import { Tabs, Tab, Box, CircularProgress, Alert } from '@mui/material';

/**
 * ⚠️ IMPORTANTE
 * Cada página se carga de forma lazy.
 * Si alguna tiene imports server-only, NO rompe el bundle inicial.
 */
const PendientesPage = lazy(() =>
  import('./Pendientes/PendientesPage')
);

const EnProcesoPage = lazy(() =>
  import('./Pendientes/EnProcesoPage')
);

const HistorialPage = lazy(() =>
  import('./Pendientes/HistorialPage')
);

/**
 * Fallback visual mientras se carga cada tab
 */
function LoadingFallback({ label }) {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <CircularProgress size={32} />
      <Box sx={{ mt: 2, color: 'text.secondary' }}>
        Cargando {label}…
      </Box>
    </Box>
  );
}

/**
 * Error Boundary LOCAL (solo para esta página)
 * Si una tab rompe, NO rompe toda la app
 */
class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error(
      `❌ Error en tab "${this.props.label}"`,
      error
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          Error cargando la sección <b>{this.props.label}</b>.
          <br />
          Revisá imports server-only o dependencias incompatibles con browser.
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default function AdminUploadedDocumentsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, newValue) => setTab(newValue)}
        >
          <Tab label="Pendientes" />
          <Tab label="En Proceso" />
          <Tab label="Historial" />
        </Tabs>
      </Box>

      {/* Contenido */}
      <Suspense
        fallback={<LoadingFallback label="sección" />}
      >
        {tab === 0 && (
          <TabErrorBoundary label="Pendientes">
            <PendientesPage />
          </TabErrorBoundary>
        )}

        {tab === 1 && (
          <TabErrorBoundary label="En Proceso">
            <EnProcesoPage />
          </TabErrorBoundary>
        )}

        {tab === 2 && (
          <TabErrorBoundary label="Historial">
            <HistorialPage />
          </TabErrorBoundary>
        )}
      </Suspense>
    </Box>
  );
}
