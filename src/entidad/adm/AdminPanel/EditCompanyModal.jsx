import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff, Close as CloseIcon } from '@mui/icons-material';
import { useTenantCompanies } from '../../../hooks/useTenantFirestore';
import { getFreshToken } from '../../../utils/getFreshToken';

const EditCompanyModal = ({ open, onClose, company, onCompanyUpdated }) => {
  const { updateCompany } = useTenantCompanies();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    companyName: '',
    realemail: '',
    password: '',
    cantidadEmpleados: '',
    cantidadVehiculos: ''
  });

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (open && company) {
      setFormData({
        companyName: company.companyName || company.name || '',
        realemail: company.realemail || company.email || '',
        password: '', // No mostrar contraseña actual por seguridad
        cantidadEmpleados: company.cantidadEmpleados || '',
        cantidadVehiculos: company.cantidadVehiculos || ''
      });
      setError(null);
      setSuccess(null);
    }
  }, [open, company]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.companyName.trim()) {
      setError('El nombre de la empresa es obligatorio');
      return;
    }

    if (!formData.realemail.trim()) {
      setError('El email real es obligatorio');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.realemail)) {
      setError('El formato del email no es válido');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const updateData = {
        companyName: formData.companyName.trim(),
        realemail: formData.realemail.trim().toLowerCase(),
        cantidadEmpleados: formData.cantidadEmpleados ? parseInt(formData.cantidadEmpleados) : null,
        cantidadVehiculos: formData.cantidadVehiculos ? parseInt(formData.cantidadVehiculos) : null
      };

      // Solo incluir contraseña si se proporcionó una nueva
      if (formData.password.trim()) {
        if (formData.password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setLoading(false);
          return;
        }
        updateData.password = formData.password;
      }

      // Actualizar en Firestore
      await updateCompany(company.id, updateData);

      // Si se cambió la contraseña, también actualizar en el backend
      if (formData.password.trim()) {
        const token = await getFreshToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/update-company-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            companyId: company.id,
            newPassword: formData.password
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al actualizar contraseña en el backend');
        }
      }

      setSuccess('Empresa actualizada correctamente');
      
      // Llamar callback para actualizar la lista
      if (onCompanyUpdated) {
        onCompanyUpdated();
      }

      // Cerrar modal después de 1.5 segundos
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      setError(err.message || 'Error al actualizar la empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        bgcolor: 'primary.main',
        color: 'white'
      }}>
        Editar Empresa
        <IconButton 
          onClick={handleClose} 
          disabled={loading}
          sx={{ color: 'white' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Nombre de la Empresa"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              fullWidth
              required
              disabled={loading}
              variant="outlined"
            />

            <TextField
              label="Email Real"
              type="email"
              value={formData.realemail}
              onChange={(e) => handleInputChange('realemail', e.target.value)}
              fullWidth
              required
              disabled={loading}
              variant="outlined"
              helperText="Email de contacto real de la empresa"
            />

            <TextField
              label="Nueva Contraseña (opcional)"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              fullWidth
              disabled={loading}
              variant="outlined"
              helperText="Dejar vacío para mantener la contraseña actual"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Cantidad de Empleados (opcional)"
              type="number"
              value={formData.cantidadEmpleados}
              onChange={(e) => handleInputChange('cantidadEmpleados', e.target.value)}
              fullWidth
              disabled={loading}
              variant="outlined"
              inputProps={{ min: 0 }}
              helperText="Número total de empleados en la empresa"
            />

            <TextField
              label="Cantidad de Vehículos (opcional)"
              type="number"
              value={formData.cantidadVehiculos}
              onChange={(e) => handleInputChange('cantidadVehiculos', e.target.value)}
              fullWidth
              disabled={loading}
              variant="outlined"
              inputProps={{ min: 0 }}
              helperText="Número total de vehículos de la empresa"
            />

            {company && (
              <Box sx={{ 
                p: 2, 
                bgcolor: 'grey.50', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'grey.200'
              }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Información actual:
                </Typography>
                <Typography variant="body2">
                  <strong>Nombre:</strong> {company.companyName || company.name || 'No especificado'}
                </Typography>
                <Typography variant="body2">
                  <strong>Email:</strong> {company.realemail || company.email || 'No especificado'}
                </Typography>
                <Typography variant="body2">
                  <strong>CUIT:</strong> {company.cuit || 'No especificado'}
                </Typography>
                <Typography variant="body2">
                  <strong>Estado:</strong> {company.status || 'No especificado'}
                </Typography>
                <Typography variant="body2">
                  <strong>Empleados:</strong> {company.cantidadEmpleados || 'No especificado'}
                </Typography>
                <Typography variant="body2">
                  <strong>Vehículos:</strong> {company.cantidadVehiculos || 'No especificado'}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={handleClose} 
            disabled={loading}
            variant="outlined"
          >
            Cancelar
          </Button>
          <Button 
            type="submit"
            variant="contained" 
            disabled={loading || !formData.companyName.trim() || !formData.realemail.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Actualizando...' : 'Actualizar Empresa'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EditCompanyModal;
