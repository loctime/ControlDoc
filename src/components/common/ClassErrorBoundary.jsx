import React from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';  

/**
 * ErrorBoundary de clase para casos específicos donde se necesite
 * Solo se usa cuando es absolutamente necesario
 */
class ClassErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    console.error('ClassErrorBoundary: Error capturado:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error capturado por ClassErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
    
    if (error.message && error.message.includes('130')) {
      console.error('Error React #130 detectado - Posible problema con undefined/null en render');
      console.error('Stack trace:', errorInfo.componentStack);
    }
  }

  handleReset = () => {
    console.log('ClassErrorBoundary: Reiniciando aplicación...');
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch (e) {
      console.warn('Error al limpiar storage:', e);
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
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
            Error Crítico
          </Typography>
          
          <Alert severity="error" sx={{ mb: 2 }}>
            Se ha producido un error crítico en la aplicación.
          </Alert>
          
          <Typography variant="body1" sx={{ mb: 2 }}>
            Ha ocurrido un error en este componente. 
            {this.state.error && this.state.error.message && this.state.error.message.includes('130') && (
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
                {this.state.error && this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" component="div" sx={{ fontWeight: 'bold' }}>
                      Stack trace:
                    </Typography>
                    <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                      {this.state.errorInfo.componentStack}
                    </Typography>
                  </Box>
                )}
              </Typography>
            </Box>
          )}
          
          <Button 
            variant="contained" 
            color="primary" 
            onClick={this.handleReset}
            startIcon={<RefreshIcon />}
          >
            Reiniciar aplicación
          </Button>
        </Paper>
      );
    }

    return this.props.children;
  }
}

export default ClassErrorBoundary;
