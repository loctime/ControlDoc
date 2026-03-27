import React, { Suspense, lazy } from 'react';
import { Box, CircularProgress, Alert, Button } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

// Visor alternativo simple usando iframe
function SimplePDFViewer({ fileURL }) {
  return (
    <Box sx={{ width: '100%', height: '75vh', border: '1px solid var(--info-main)', borderRadius: 1 }}>
      <iframe
        src={fileURL}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '4px'
        }}
        title="Visor PDF"
        onError={(e) => {
          console.error('Error cargando PDF en iframe:', e);
        }}
      />
    </Box>
  );
}

export default function LazyPDFViewer(props) {
  const [useAdvancedViewer, setUseAdvancedViewer] = React.useState(false);
  const [pdfjsEnabled, setPdfjsEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Verificar si PDF.js está habilitado
    import('../../config/pdfConfig.js').then(module => {
      setPdfjsEnabled(module.PDFJS_ENABLED);
      setLoading(false);
    }).catch(err => {
      console.error('Error cargando pdfConfig:', err);
      setPdfjsEnabled(false);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!pdfjsEnabled || !useAdvancedViewer) {
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>
          PDF.js está temporalmente desactivado. Puede ver el documento usando el visor simple.
        </Alert>
        <SimplePDFViewer fileURL={props.fileURL} />
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() => window.open(props.fileURL, '_blank')}
            sx={{ mr: 1 }}
          >
            Abrir en nueva pestaña
          </Button>
          <Button
            variant="outlined"
            onClick={props.onDownload}
          >
            Descargar PDF
          </Button>
          {pdfjsEnabled && (
            <Button
              variant="contained"
              onClick={() => setUseAdvancedViewer(true)}
              sx={{ ml: 1 }}
            >
              Usar visor avanzado
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  // Cargar el visor avanzado dinámicamente
  const AdvancedPDFViewer = lazy(() => import('../pdfViewer/PDFViewer'));

  return (
    <Suspense fallback={<Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>}>
      <AdvancedPDFViewer {...props} />
    </Suspense>
  );
}
