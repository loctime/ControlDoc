import { useState } from 'react';
import {
  Button, TextField, Box, CircularProgress, Alert,
  Typography, Paper, Container, Avatar, Grid, Card, CardContent
} from "@mui/material";
import { AdminPanelSettings as AdminIcon, Security as SecurityIcon } from "@mui/icons-material";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebaseconfig";
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { getTenantCollectionPath, getCurrentTenantId } from "../../utils/tenantUtils";

const CreateSuperMaxAdmin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Validar que las contraseñas coincidan
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      // Validar longitud de contraseña
      if (formData.password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Email no válido');
      }

      // Obtener tenant actual desde dominio canónico
      const tenantId = getCurrentTenantId();
      if (!tenantId) {
        throw new Error('Dominio no permitido o tenant no resoluble');
      }

      console.log('🔍 [CreateSuperMaxAdmin] Creando superadmin para tenant:', tenantId);

      // Nota: Se permite crear múltiples superadministradores
      const tenantUsersPath = getTenantCollectionPath("users");

      let userCredential;
      
      try {
        // Intentar crear usuario en Firebase Auth
        userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      } catch (authError) {
        // Si el email ya existe en Firebase Auth, intentar hacer login
        if (authError.code === 'auth/email-already-in-use') {
          try {
            // Hacer login con las credenciales proporcionadas
            const { signInWithEmailAndPassword } = await import("firebase/auth");
            userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
            
            // Verificar que no exista ya en este tenant
            const existingUserSnap = await getDoc(doc(db, tenantUsersPath, userCredential.user.uid));
            if (existingUserSnap.exists()) {
              throw new Error('Este usuario ya existe en este tenant');
            }
          } catch (loginError) {
            if (loginError.code === 'auth/wrong-password') {
              throw new Error('El email ya está registrado con una contraseña diferente');
            }
            throw new Error('Error al verificar credenciales existentes');
          }
        } else {
          throw authError;
        }
      }
      
      // Crear documento de usuario con rol "max"
      await setDoc(doc(db, tenantUsersPath, userCredential.user.uid), {
        realemail: formData.email,
        role: "max", // Rol superadmin
        displayName: formData.displayName,
        status: "approved",
        firebaseUid: userCredential.user.uid,
        createdAt: serverTimestamp(),
        isSuperAdmin: true,
        createdBy: 'supermaxadmin-tool'
      });

      // Cerrar sesión automáticamente después del registro
      await signOut(auth);
      
      // Esperar un momento para asegurar que el signOut se complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Feedback
      setSuccess(`Superadmin creado exitosamente para tenant: ${tenantId}`);
      enqueueSnackbar('Superadmin creado exitosamente', {
        variant: 'success',
        autoHideDuration: 4000
      });
      
      // Limpiar formulario
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        displayName: ''
      });
      
      // Redirigir automáticamente al login después de 2 segundos
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            superAdminCreated: true,
            message: 'Superadmin creado exitosamente. Ahora puedes iniciar sesión.'
          } 
        });
      }, 2000);
      
    } catch (error) {
      console.error('Error creando superadmin:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Obtener información del tenant actual
  const tenantInfo = {
    id: getCurrentTenantId() || 'unknown',
    name: getCurrentTenantId() || 'unknown'
  };

  return (
    <Container maxWidth="md" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
      <Paper elevation={3} sx={{
        p: 4,
        width: '100%',
        maxWidth: 600,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: 3
      }}>
        <Avatar sx={{ m: 1, bgcolor: 'error.main', width: 64, height: 64 }}>
          <SecurityIcon sx={{ fontSize: 32 }} />
        </Avatar>
        
        <Typography component="h1" variant="h4" sx={{ mb: 1, fontWeight: 'bold' }}>
          Create Super Max Admin
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Herramienta especial para crear superadministradores
        </Typography>

        {/* Información del Tenant */}
        <Card sx={{ mb: 3, width: '100%', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <AdminIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Tenant Actual
            </Typography>
            <Typography variant="body1">
              <strong>ID:</strong> {tenantInfo.id}
            </Typography>
            <Typography variant="body1">
              <strong>Nombre:</strong> {tenantInfo.name}
            </Typography>
            <Typography variant="body1">
              <strong>Hostname:</strong> {window.location.hostname}
            </Typography>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mt: 2, width: '100%' }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2, width: '100%' }}>{success}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            name="displayName"
            label="Nombre completo"
            fullWidth
            margin="normal"
            value={formData.displayName}
            onChange={handleInputChange}
            required
            autoFocus
          />
          <TextField
            name="email"
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
          <TextField
            name="password"
            label="Contraseña"
            type="password"
            fullWidth
            margin="normal"
            value={formData.password}
            onChange={handleInputChange}
            required
            helperText="Mínimo 6 caracteres"
          />
          <TextField
            name="confirmPassword"
            label="Confirmar contraseña"
            type="password"
            fullWidth
            margin="normal"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Crear Super Max Admin'}
          </Button>
          
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate('/login')}
              >
                Ir al Login
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate('/')}
              >
                Ir al Inicio
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
};

export default CreateSuperMaxAdmin;
