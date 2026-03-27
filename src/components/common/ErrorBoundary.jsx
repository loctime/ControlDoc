import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';  

/**
 * Componente funcional que maneja errores de manera más simple
 * Evita problemas de herencia de clases con React.Component
 */
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    // Función para manejar errores no capturados
    const handleError = (errorEvent) => {
      console.error('Error capturado por ErrorBoundary:', errorEvent.error);
      setError(errorEvent.error);
      setErrorInfo({
        componentStack: errorEvent.error?.stack || 'Stack trace no disponible'
      });
      setHasError(true);
      
      // Log adicional para errores de React #130
      if (errorEvent.error?.message && errorEvent.error.message.includes('130')) {
        console.error('Error React #130 detectado - Posible problema con undefined/null en render');
      }
    };

    // Función para manejar promesas rechazadas
    const handleUnhandledRejection = (event) => {
      console.error('Promesa rechazada no manejada:', event.reason);
      setError(new Error(`Promesa rechazada: ${event.reason}`));
      setHasError(true);
    };

    // Agregar listeners globales
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const handleReset = () => {
    console.log('ErrorBoundary: Reiniciando aplicación...');
    setHasError(false);
    setError(null);
    setErrorInfo(null);
    
    // Limpiar localStorage y sessionStorage para un reset completo
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch (e) {
      console.warn('Error al limpiar storage:', e);
      window.location.reload();
    }
  };

  // Si no hay error, renderizar children normalmente
  if (!hasError) {
    return children;
  }

  // UI de error
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 3, 
        m: 2, 
        textAlign: 'center',
        backgroundColor: (theme) => theme.palette.error.light + '20'
      }}
    >
      <Typography variant="h5" gutterBottom color="error">
        Algo salió mal
      </Typography>
      
      <Alert severity="error" sx={{ mb: 2 }}>
        Se ha producido un error en la aplicación. Esto puede ser temporal.
      </Alert>
      
      <Typography variant="body1" sx={{ mb: 2 }}>
        Ha ocurrido un error en este componente. 
        {error && error.message && error.message.includes('130') && (
          <Box sx={{ mt: 1, p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="caption">
              Error React #130: Posible problema con datos undefined/null
            </Typography>
          </Box>
        )}
      </Typography>
      
      {process.env.NODE_ENV !== 'production' && (
        <Box sx={{ textAlign: 'left', mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
            {error && error.toString()}
            {errorInfo && errorInfo.componentStack && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" component="div" sx={{ fontWeight: 'bold' }}>
                  Stack trace:
                </Typography>
                <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                  {errorInfo.componentStack}
                </Typography>
              </Box>
            )}
          </Typography>
        </Box>
      )}
      
      <Button 
        variant="contained" 
        color="primary" 
        onClick={handleReset}
        startIcon={<RefreshIcon />}
      >
        Reiniciar aplicación
      </Button>
    </Paper>
  );
};

export default ErrorBoundary;
