import { useState } from 'react';
import {
  Button, TextField, Box, CircularProgress, Alert,
  Typography, Paper, Container, Avatar
} from "@mui/material";
import { LockOutlined } from "@mui/icons-material";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../config/firebaseconfig";
import { Link as RouterLink } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err) {
      setError('No se pudo enviar el correo de recuperación. Verifica el email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Box display="flex" flexDirection="column" alignItems="center">
          <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
            <LockOutlined />
          </Avatar>
          <Typography component="h1" variant="h5">
            Recuperar contraseña
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Correo electrónico"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
            />
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {success && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Si el correo existe, se ha enviado un email para restablecer la contraseña.<br />
                <b>Revisa también tu carpeta de spam.</b><br />
                Si tienes dudas, contacta a <b>controldoc</b>.
              </Alert>
            )}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Enviar correo de recuperación'}
            </Button>
            <Button
              component={RouterLink}
              to="/login"
              fullWidth
              variant="text"
            >
              Volver al inicio de sesión
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ForgotPassword;
