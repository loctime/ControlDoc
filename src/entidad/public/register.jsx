import { useState } from 'react';
import {
  Button, TextField, Box, CircularProgress, Alert,
  Typography, Paper, Container, Avatar, Grid, Link
} from "@mui/material";
import { Business as BusinessIcon } from "@mui/icons-material";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../config/firebaseconfig";
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { getTenantCollectionPath } from "../../utils/tenantUtils";

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    cuit: '',
    companyName: '',
    telefono: '',
    direccion: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 🔥 USAR RUTAS DE TENANT PARA CONSULTAR Y CREAR USUARIOS Y EMPRESAS
      const tenantUsersPath = getTenantCollectionPath("users");
      const tenantCompaniesPath = getTenantCollectionPath("companies");
      
      // 1. Validaciones paralelas usando rutas de tenant
      const [cuitSnap, emailSnap] = await Promise.all([
        getDocs(query(collection(db, tenantUsersPath), where("companyId", "==", formData.cuit))),
        getDocs(query(collection(db, tenantUsersPath), where("realemail", "==", formData.email)))
      ]);

      // Validar que no exista empresa con ese CUIT
      if (!cuitSnap.empty) {
        throw new Error('Ya existe una empresa registrada con ese CUIT en este tenant');
      }

      if (!emailSnap.empty) {
        throw new Error('El email ya está registrado en este tenant');
      }

      // 2. Crear usuario o reutilizar existente
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
            console.error('Error en login con usuario existente:', loginError);
            if (loginError.code === 'auth/wrong-password') {
              throw new Error('El email ya está registrado con una contraseña diferente');
            } else if (loginError.code === 'auth/user-not-found') {
              throw new Error('Usuario no encontrado en Firebase Auth');
            } else if (loginError.code === 'auth/invalid-email') {
              throw new Error('Email inválido');
            } else if (loginError.code === 'auth/too-many-requests') {
              throw new Error('Demasiados intentos fallidos. Intenta más tarde');
            } else {
              throw new Error(`Error al verificar credenciales: ${loginError.message}`);
            }
          }
        } else {
          throw authError;
        }
      }
      
      // 3. Crear documentos usando rutas de tenant
      await Promise.all([
        setDoc(doc(db, tenantUsersPath, userCredential.user.uid), {
          realemail: formData.email,
          role: "user", // Todos los usuarios de empresas son 'user'
          companyId: formData.cuit,
          companyName: formData.companyName,
          telefono: formData.telefono,
          direccion: formData.direccion,
          firebaseUid: userCredential.user.uid,
          status: "pending",
          createdAt: serverTimestamp()
        }),
        setDoc(doc(db, tenantCompaniesPath, formData.cuit), {
          cuit: formData.cuit,
          telefono: formData.telefono,
          direccion: formData.direccion,
          realemail: formData.email,
          companyName: formData.companyName,
          ownerId: userCredential.user.uid,
          status: "pending",
          parentCompanyId: null,
          type: "main",
          active: true,
          createdAt: serverTimestamp()
        })
      ]);

      // 4. Cerrar sesión automáticamente después del registro
      await signOut(auth);
      
      // 5. Esperar un momento para asegurar que el signOut se complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 6. Feedback
      enqueueSnackbar('Registro exitoso. Tu empresa está pendiente de aprobación.', {
        variant: 'info',
        autoHideDuration: 4000
      });
      
      // 7. Redirigir inmediatamente sin delay adicional
      navigate('/login', { state: { registrationSuccess: true } });
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{
        p: 4,
        mt: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <BusinessIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Registro de Empresa
        </Typography>

        {error && <Alert severity="error" sx={{ mt: 2, width: '100%' }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            label="Email"
            margin="normal"
            fullWidth
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
          
          <TextField
            label="CUIT"
            margin="normal"
            fullWidth
            value={formData.cuit}
            onChange={(e) => setFormData({...formData, cuit: e.target.value})}
            required
            inputProps={{
              pattern: "[0-9]{11}",
              title: "11 dígitos sin guiones"
            }}
          />

          <TextField
            label="Nombre de la Empresa"
            margin="normal"
            fullWidth
            value={formData.companyName}
            onChange={(e) => setFormData({...formData, companyName: e.target.value})}
            required
          />

          <TextField
            label="Teléfono"
            margin="normal"
            fullWidth
            value={formData.telefono}
            onChange={(e) => setFormData({...formData, telefono: e.target.value})}
            required
          />

          <TextField
            label="Dirección"
            margin="normal"
            fullWidth
            value={formData.direccion}
            onChange={(e) => setFormData({...formData, direccion: e.target.value})}
            required
          />

          <TextField
            label="Contraseña"
            margin="normal"
            fullWidth
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
            inputProps={{
              minLength: 6
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Registrar Empresa'}
          </Button>
          
          <Grid container justifyContent="flex-end">
            <Grid item>
              <Link component={RouterLink} to="/login" variant="body2">
                ¿Ya tienes cuenta? Inicia sesión
              </Link>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
};

export default Register;