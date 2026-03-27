import React, { Component } from 'react';
import { Alert, Box, Button, Typography, Paper } from '@mui/material';
import { Refresh } from '@mui/icons-material';

class TenantErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el state para mostrar la UI de error
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log del error para debugging
    console.error('TenantErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Recargar la página para reiniciar el estado
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          p: 2
        }}>
          <Paper elevation={3} sx={{ p: 4, maxWidth: 600, width: '100%' }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Error de Tenant
              </Typography>
              <Typography variant="body2">
                Ha ocurrido un error relacionado con el sistema de tenants. Esto puede deberse a:
              </Typography>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>Problemas de conectividad</li>
                <li>Configuración incorrecta del tenant</li>
                <li>Datos de usuario inconsistentes</li>
              </ul>
            </Alert>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
              <Button 
                variant="contained" 
                startIcon={<Refresh />}
                onClick={this.handleRetry}
              >
                Reintentar
              </Button>
              <Button 
                variant="outlined"
                onClick={() => window.location.href = '/login'}
              >
                Volver al Login
              </Button>
            </Box>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Detalles del error (solo en desarrollo):
                </Typography>
                <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default TenantErrorBoundary;
