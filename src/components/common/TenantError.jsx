// React import removed - using JSX runtime
import {
  Box,
  Typography,
  Paper,
  Alert,
  Button,
  Container,
  LinearProgress
} from '@mui/material';
import { Error as ErrorIcon, Home as HomeIcon } from '@mui/icons-material';
import blancopro3 from '../../assets/blancopro3.png';
import controldacrka from '../../assets/controldacrka.png';

function isConnectivityErrorMessage(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  return (
    t.includes('conexión') ||
    t.includes('conexion') ||
    t.includes('red') ||
    t.includes('vpn') ||
    t.includes('firewall') ||
    t.includes('offline') ||
    t.includes('servicio de datos')
  );
}

export const TenantError = ({ error }) => {
  const connectivity = isConnectivityErrorMessage(error);

  const handleGoHome = () => {
    // Redirigir al dominio principal
    window.location.href = 'https://controldoc.app';
  };

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        textAlign="center"
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: 2,
            maxWidth: 500,
            width: '100%'
          }}
        >
          <ErrorIcon
            sx={{
              fontSize: 64,
              color: 'error.main',
              mb: 2
            }}
          />

          <Typography variant="h4" component="h1" gutterBottom>
            {connectivity ? 'Sin conexión a los servicios' : 'Tenant No Encontrado'}
          </Typography>

          <Typography variant="body1" color="text.secondary" paragraph>
            {connectivity
              ? 'No pudimos contactar a Firestore ni, en algunos casos, al servidor API. Suele deberse a red, bloqueo de dominios de Google, variables de entorno del build o CORS en el backend.'
              : 'El subdominio que estás intentando acceder no existe o no está activo.'}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Typography variant="body2" color="text.secondary" paragraph>
            Verifica que la URL sea correcta o contacta al administrador del sistema.
          </Typography>

          <Box display="flex" gap={2} justifyContent="center" mt={3}>
            <Button
              variant="contained"
              startIcon={<HomeIcon />}
              onClick={handleGoHome}
            >
              Ir al Sitio Principal
            </Button>

            <Button
              variant="outlined"
              onClick={() => window.history.back()}
            >
              Volver
            </Button>
          </Box>

          <Box mt={3}>
            <Typography variant="caption" color="text.secondary">
              Si crees que esto es un error, contacta al soporte técnico.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export const TenantLoading = () => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundImage: `url(${blancopro3})`,
        backgroundSize: 'cover',
        backgroundPosition: 'left top',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4
        }}
      >
        <img 
          src={controldacrka} 
          alt="ControlDoc" 
          style={{
            maxWidth: '300px',
            height: 'auto',
            marginBottom: '20px'
          }}
        />
        
        <Typography 
          variant="h5" 
          sx={{
            color: '#333',
            fontWeight: 'bold',
            mb: 2
          }}
        >
          Cargando ControlDoc...
        </Typography>

        <Box sx={{ width: '100%', maxWidth: '300px', mb: 2 }}>
          <LinearProgress 
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(0,0,0,0.1)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'var(--primary-main)',
                borderRadius: 3
              }
            }}
          />
        </Box>

        <Typography 
          variant="body1" 
          sx={{
            color: '#666',
            fontSize: '14px'
          }}
        >
          Verificando configuración del sistema
        </Typography>
      </Box>
    </Box>
  );
};
