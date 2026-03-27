import React, { useState, useEffect } from 'react';
import {
  Button, TextField, Box, CircularProgress, Alert,
  Typography, Paper, Container, Avatar, Grid, Link
} from "@mui/material";
import { LockOutlined } from "@mui/icons-material";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "../../firebaseconfig";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTenantCollectionPath, getCurrentTenantId } from "../../utils/tenantUtils";

const Login = () => {
  // Email y contraseña: el usuario debe ingresar su email real (realemail) con el que fue creado
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [canLogin, setCanLogin] = useState(false);
  const [redirecting, setRedirecting] = useState(false); // Prevenir redirecciones múltiples
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Debug: Log de variables de entorno
  console.log('🔍 [Login] Variables de entorno:', {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV
  });

  // 🔄 Redirigir si ya hay sesión activa - MEJORADO
  useEffect(() => {
    // Evitar redirección si venimos de crear superadmin o si no está listo para login
    const preventRedirect = window.location.state?.preventRedirect;
    if (preventRedirect || !canLogin) {
      console.log('[Login] Previniendo redirección automática');
      return;
    }
    
    // Solo redirigir si no estamos en proceso de login manual Y tenemos un usuario válido
    if (!authLoading && user && !loading && user.uid) {
      const role = typeof user.role === 'string' ? user.role.trim().toLowerCase() : '';
      const privilegedRoles = ['admin', 'max', 'dhhkvja'];
      
      console.log('[Login] Usuario autenticado detectado:', { 
        uid: user.uid,
        role, 
        status: user.status, 
        companyStatus: user.companyStatus 
      });
      
      // Verificar que el usuario tenga datos completos antes de redirigir
      if (!user.status && !user.companyStatus && !privilegedRoles.includes(role)) {
        console.log('[Login] Usuario sin datos completos, esperando...');
        return;
      }
      
      // Prevenir redirecciones múltiples
      if (redirecting) {
        console.log('[Login] Ya se está redirigiendo, evitando redirección duplicada');
        return;
      }
      
      setRedirecting(true);
      
      // Los roles privilegiados siempre pueden acceder
      if (privilegedRoles.includes(role)) {
        const dashboard = '/admin/dashboard';
        console.log('[Login] Superadmin autenticado, redirigiendo a', dashboard);
        navigate(dashboard, { replace: true });
      } 
      // Para usuarios normales, verificar si están aprobados
      else if (user.status === "approved" || user.companyStatus === "approved") {
        const dashboard = '/usuario/dashboard';
        console.log('[Login] Usuario aprobado, redirigiendo a', dashboard);
        navigate(dashboard, { replace: true });
      } else {
        // Si el usuario está pendiente, cerrar sesión y mostrar mensaje
        console.log('[Login] Usuario pendiente de aprobación, cerrando sesión');
        setRedirecting(false); // Resetear flag antes de cerrar sesión
        signOut(auth);
        setError("Tu cuenta está pendiente de aprobación.");
      }
    }
  }, [user, authLoading, navigate, loading, canLogin]);

  // ✅ Inicializar estado del login
  useEffect(() => {
    // Limpiar estado del navegador si venimos de crear superadmin
    if (window.location.state?.superAdminCreated) {
      console.log('[Login] Superadmin creado, limpiando estado del navegador');
      
      // Mostrar mensaje de éxito si viene de crear superadmin
      if (window.location.state?.message) {
        setError(''); // Limpiar errores previos
        setSuccessMessage(window.location.state.message);
        // Limpiar mensaje de éxito después de 5 segundos
        setTimeout(() => setSuccessMessage(''), 5000);
      }
      
      // Limpiar el estado del navegador después de procesarlo
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 100);
    }
    
    // Habilitar login inmediatamente
    setCanLogin(true);
    
    // Resetear flag de redirección después de 3 segundos para permitir nuevas redirecciones
    const redirectTimeout = setTimeout(() => {
      setRedirecting(false);
    }, 3000);
    
    return () => clearTimeout(redirectTimeout);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage(''); // Limpiar mensaje de éxito al intentar login

    try {
      // Login siempre con el email real (realemail); el backend crea el usuario en Auth con realemail
      const emailToUse = (email || '').trim().toLowerCase();
      console.log('[Login] signIn con email:', emailToUse, '| tenant actual:', getCurrentTenantId());
      const credential = await signInWithEmailAndPassword(auth, emailToUse, password);
      const firebaseUser = credential.user;

      // Consultar usuario solo en el tenant del dominio actual: tenants/{tenantId}/users
      const tenantUsersPath = getTenantCollectionPath("users");
      const userRef = doc(db, tenantUsersPath, firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.log('[Login] Usuario no encontrado en tenant:', tenantUsersPath);
        setError("Usuario no registrado en este tenant. Verifica que estés accediendo desde el dominio correcto.");
        await signOut(auth);
        return;
      }

      const userData = userSnap.data();

      // Admin/superadmin: incluye "admin", "max" y legacy "dhhkvja" → siempre a /admin/dashboard
      const privilegedRoles = ["admin", "max", "dhhkvja"];
      const userRole = typeof userData.role === "string" ? userData.role.trim().toLowerCase() : "";
      const isAdminOrMax = privilegedRoles.includes(userRole);
      if (isAdminOrMax) {
        const dashboard = "/admin/dashboard";
        navigate(dashboard, { replace: true });
        setLoading(false);
        return;
      }
      if (userData.status === "approved" || userData.companyStatus === "approved") {
        // Buscar la empresa por CUIT y guardar en localStorage usando ruta de tenant
        if (userData.companyId) {
          try {
            const tenantCompaniesPath = getTenantCollectionPath("companies");
            const companyRef = doc(db, tenantCompaniesPath, userData.companyId);
            const companySnap = await getDoc(companyRef);
            if (companySnap.exists()) {
              const companyData = companySnap.data();
              const userCompanyObj = {
                companyId: companyData.cuit,
                companyName: companyData.companyName
              };
              localStorage.setItem('userCompany', JSON.stringify(userCompanyObj));
              console.log('userCompany guardado en localStorage:', userCompanyObj);
            } else {
              // Si no existe la empresa, limpiar localStorage
              localStorage.removeItem('userCompany');
            }
          } catch (e) {
            console.error('Error buscando empresa por CUIT:', e);
            localStorage.removeItem('userCompany');
          }
        } else {
          localStorage.removeItem('userCompany');
        }
        // Redirigir: admin/max/dhhkvja → /admin/dashboard; resto → /usuario/dashboard
        const roleForRedirect = String(userData.role || "").trim().toLowerCase();
        const isAdmin = ["admin", "max", "dhhkvja"].includes(roleForRedirect);
        const dashboard = isAdmin ? "/admin/dashboard" : "/usuario/dashboard";
        navigate(dashboard, { replace: true });
      } else {
        // 🔒 Cuenta pendiente → cerrar sesión
        setError("Tu cuenta está pendiente de aprobación.");
        await signOut(auth);
      }

    } catch (err) {
      console.error("Error en login:", err);
      setError("Credenciales incorrectas o cuenta no autorizada.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Grid container spacing={0} direction="row" alignItems="stretch" justifyContent="center" sx={{ minHeight: '100vh' }}>
        {/* Columna izquierda: Login */}
        <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Paper elevation={3} sx={{
            p: 4,
            width: '100%',
            maxWidth: 420,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: 3
          }}>
            <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
              <LockOutlined />
            </Avatar>
            <Typography component="h1" variant="h5">
              Iniciar Sesión
            </Typography>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {successMessage && <Alert severity="success" sx={{ mt: 2 }}>{successMessage}</Alert>}

            {!canLogin || authLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                <TextField
                label="Email"
                fullWidth
                margin="normal"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <TextField
                label="Contraseña"
                type="password"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading || !canLogin}
              >
                {loading ? <CircularProgress size={24} /> : 'Ingresar'}
              </Button>
              <Grid container>
                <Grid item xs>
                  <Link component={RouterLink} to="/forgot-password" variant="body2">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </Grid>
                <Grid item>
                  <Link component={RouterLink} to="/register" variant="body2">
                    ¿No tienes cuenta? Regístrate
                  </Link>
                </Grid>
              </Grid>
            </Box>
            )}
          </Paper>
        </Grid>

        {/* Columna derecha: Marketing y funciones */}
        <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(90deg,#f5f7fa 0%,#c3cfe2 100%)' }}>
          <Paper elevation={3} sx={{
            p: 4,
            width: '100%',
            maxWidth: 500,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 3,
            background: 'transparent'
          }}>
            <Typography variant="h3" color="primary" fontWeight="bold" gutterBottom>
              ControlDoc
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              La solución más ágil y segura para la gestión documental de tu empresa.
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              ¿Necesitás ayuda o querés conocer nuestros servicios?
            </Typography>
            <Typography variant="h6" color="secondary" sx={{ mt: 1, mb: 1 }}>
              Contacto Marketing: <strong>336 452 4758</strong> / <strong>336 434 5088</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              También podés escribirnos por WhatsApp o email. ¡Estamos para ayudarte!
            </Typography>
            <Box sx={{ textAlign: 'left', maxWidth: 420, mx: 'auto', mt: 2 }}>
              <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 'bold' }}>
                Funciones principales del sistema:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Gestión y carga de documentos requeridos</li>
                <li>Control automático de vencimientos</li>
                <li>Panel de administración para empresas y usuarios</li>
                <li>Notificaciones automáticas y alertas</li>
                <li>Gestión de personal y vehículos</li>
                <li>Comentarios y revisión de documentos</li>
                <li>Reportes y seguimiento de cumplimiento</li>
              </ul>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Login;
