import { useState } from 'react';
import { Box, Button, Typography, Alert, Divider } from '@mui/material';
import { getFreshToken } from '../../../utils/getFreshToken';
import { useAuth } from '../../../context/AuthContext';
import { useTenant } from '../../../context/TenantContext';

const DebugUserRole = () => {
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { tenantId, tenantName } = useTenant();

  const testUserRole = async () => {
    setLoading(true);
    try {
      const token = await getFreshToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/debug-user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      setDebugInfo(data);
    } catch (error) {
      setDebugInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Debug de Rol de Usuario
      </Typography>
      
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          <strong>Información del Frontend:</strong>
        </Typography>
        <Typography variant="body2">
          <strong>Rol desde AuthContext:</strong> {user?.role || 'No definido'}
        </Typography>
        <Typography variant="body2">
          <strong>Email:</strong> {user?.email || 'No definido'}
        </Typography>
        <Typography variant="body2">
          <strong>UID:</strong> {user?.uid || 'No definido'}
        </Typography>
        <Typography variant="body2">
          <strong>Tenant ID:</strong> {tenantId || 'No definido'}
        </Typography>
        <Typography variant="body2">
          <strong>Tenant Name:</strong> {tenantName || 'No definido'}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          <strong>Rutas de Búsqueda Esperadas:</strong>
        </Typography>
        <Typography variant="body2" fontFamily="monospace">
          Usuarios: tenants/{tenantId}/users/{user?.uid}
        </Typography>
        <Typography variant="body2" fontFamily="monospace">
          Administradores: tenants/{tenantId}/admins/{user?.uid}
        </Typography>
      </Box>

      <Button 
        variant="contained" 
        onClick={testUserRole}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? 'Verificando...' : 'Verificar Rol en Backend'}
      </Button>

      {debugInfo && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Respuesta del Backend:
          </Typography>
          <pre style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '300px',
            fontSize: '12px'
          }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
};

export default DebugUserRole;
