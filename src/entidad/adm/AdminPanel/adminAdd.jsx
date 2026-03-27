//adm/adminpanel/adminadd.jsx

import React, { useState, useEffect } from "react"
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Alert, FormControlLabel, Checkbox
} from "@mui/material"
import { generateAccessEmail } from "./utils"
import { useAuth } from "../../../context/AuthContext";

const AdminAdd = ({ open, onClose, onSuccess }) => {
  const [adminName, setAdminName] = useState("")
  const [realemail, setRealEmail] = useState("")
  const [adminTel, setAdminTel] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [password, setPassword] = useState("")
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const { user, token } = useAuth();

// Email interno generado automáticamente
    const internalEmail = React.useMemo(() => {
      if (!adminName?.trim()) return "";
      return generateAccessEmail(adminName);
    }, [adminName]);

  // Limpiar formulario al abrir
  useEffect(() => {
    if (open) {
      setAdminName("")
      setRealEmail("")
      setAdminTel("")
      setError(null)
      setSuccess(null)
      setPassword("")
      setIsSuperAdmin(false)
    }
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    // Sanitizar el teléfono para formato E.164
    let sanitizedTel = adminTel.replace(/[\s\-()]/g, "");
    if (!sanitizedTel.startsWith("+")) {
      // Si no empieza con +, asume Argentina
      if (sanitizedTel.startsWith("54")) {
        sanitizedTel = "+" + sanitizedTel;
      } else if (sanitizedTel.startsWith("0")) {
        sanitizedTel = "+54" + sanitizedTel.substring(1);
      } else {
        sanitizedTel = "+54" + sanitizedTel;
      }
    }
    if (sanitizedTel.length < 10) {
      setError("Teléfono inválido (debe ser internacional, ej: +5491123456789)");
      setLoading(false);
      return;
    }
    // Usar el email interno (ficticio) como 'email' para backend
    const accessEmail = internalEmail; // ficticio
    // El email real se envía como 'realemail' (ya está en el state)
    try {
      if (!token) {
        setError("No se pudo validar la sesión del superadmin.");
        setLoading(false);
        return;
      }
      console.log("Enviando solicitud para crear administrador...");
      console.log("URL de la API:", import.meta.env.VITE_API_URL);
      
      // Construir la URL absoluta usando siempre VITE_API_URL
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/admin/add-admin`;
      console.log("URL completa:", apiUrl);
      console.log("Token:", token ? "Token presente" : "Token ausente");
      
      // Preparar los datos que se van a enviar
      const requestData = {
        displayName: adminName,
        realemail, // el real
        adminTel: sanitizedTel,
        email: accessEmail, // el ficticio
        password,
        role: isSuperAdmin ? 'max' : undefined, // Enviar role solo si es superadmin
      };
      
      console.log("📤 Datos que se envían al servidor:", requestData);
      console.log("📤 Token (primeros 20 caracteres):", token ? token.substring(0, 20) + "..." : "No hay token");
      
      // Prueba de conectividad primero
      console.log("🔍 Probando conectividad con el servidor...");
      try {
        const testResponse = await fetch("/api/test", { method: "GET" });
        console.log("Prueba de conectividad - Estado:", testResponse.status);
        const testText = await testResponse.text();
        console.log("Prueba de conectividad - Respuesta:", testText.substring(0, 200));
      } catch (testError) {
        console.log("Prueba de conectividad falló:", testError.message);
      }
      
      // Configurar CORS para la solicitud
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(requestData)
      });

      console.log("Estado de la respuesta:", res.status, res.statusText);
      console.log("Headers de respuesta:", Object.fromEntries(res.headers.entries()));
      
      // Obtener el texto de la respuesta
      const responseText = await res.text();
      console.log("Respuesta completa del servidor:", responseText);
      console.log("Tipo de contenido:", res.headers.get('content-type'));
      
      // Verificar si la respuesta es HTML (página de error)
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error("❌ El servidor devolvió una página HTML en lugar de JSON");
        console.error("Esto indica que la ruta no existe o hay un problema de configuración");
        throw new Error("Error de configuración: El servidor devolvió una página web en lugar de datos JSON. Verifica que la ruta de la API esté correcta.");
      }
      
      // Verificar si la respuesta está vacía
      if (!responseText.trim()) {
        console.error("❌ El servidor devolvió una respuesta vacía");
        throw new Error("Error del servidor: Respuesta vacía");
      }
      
      // Intentar parsear como JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("✅ Respuesta JSON parseada correctamente:", data);
      } catch (jsonError) {
        console.error("❌ Error al parsear JSON:", jsonError);
        console.error("Texto de respuesta:", responseText.substring(0, 500));
        throw new Error(`Error en el formato de respuesta del servidor. El servidor devolvió: ${responseText.substring(0, 100)}...`);
      }
      
      // Verificar el estado de la respuesta
      if (!res.ok) {
        console.error("❌ Error HTTP:", res.status, data);
        throw new Error(data.error || data.message || `Error HTTP ${res.status}: ${res.statusText}`);
      }
      
      console.log("✅ Administrador creado exitosamente");
      const roleText = isSuperAdmin ? "Superadministrador" : "Administrador";
      setSuccess(`${roleText} agregado correctamente. El usuario puede hacer login con sus credenciales.`);
      setAdminName("");
      setRealEmail("");
      setAdminTel("");
      setPassword("");
      setIsSuperAdmin(false);
      if (onSuccess) onSuccess();
      setTimeout(() => { setSuccess(null); onClose(); }, 3000);
    } catch (err) {
      console.error("Error al crear administrador:", err);
      setError(err.message || "Error desconocido al crear administrador")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xs" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: "var(--paper-background)",
          color: "var(--paper-background-text)"
        }
      }}
    >
      <DialogTitle sx={{ color: "var(--paper-background-text)" }}>Agregar administrador</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <TextField
            label="Nombre completo"
            value={adminName}
            onChange={e => setAdminName(e.target.value)}
            fullWidth
            margin="normal"
            required
            autoFocus
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': 'nombre del administrador' }}
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: "var(--divider-color)"
                },
                "&:hover fieldset": {
                  borderColor: "var(--primary-main)"
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--primary-main)"
                }
              },
              "& .MuiInputLabel-root": {
                color: "var(--paper-background-text)"
              }
            }}
          />
          <TextField
            label="Email real"
            type="email"
            value={realemail}
            onChange={e => setRealEmail(e.target.value)}
            fullWidth
            margin="normal"
            required
            InputLabelProps={{ shrink: true }}
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: "var(--divider-color)"
                },
                "&:hover fieldset": {
                  borderColor: "var(--primary-main)"
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--primary-main)"
                }
              },
              "& .MuiInputLabel-root": {
                color: "var(--paper-background-text)"
              }
            }}
          />
          <TextField
            label="Teléfono"
            value={adminTel}
            onChange={e => setAdminTel(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="Teléfono de contacto"
            InputLabelProps={{ shrink: true }}
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: "var(--divider-color)"
                },
                "&:hover fieldset": {
                  borderColor: "var(--primary-main)"
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--primary-main)"
                }
              },
              "& .MuiInputLabel-root": {
                color: "var(--paper-background-text)"
              }
            }}
          />
          <TextField
            label="Email interno"
            value={internalEmail}
            fullWidth
            margin="normal"
            InputProps={{ readOnly: true }}
            InputLabelProps={{ shrink: true }}
            helperText="Este será el email interno del administrador."
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: "var(--divider-color)"
                },
                "&:hover fieldset": {
                  borderColor: "var(--primary-main)"
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--primary-main)"
                }
              },
              "& .MuiInputLabel-root": {
                color: "var(--paper-background-text)"
              }
            }}
          />
          <TextField
            label="Contraseña"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            fullWidth
            margin="normal"
            required
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': 'contraseña del administrador', minLength: 6 }}
            helperText="La contraseña debe tener al menos 6 caracteres."
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": {
                  borderColor: "var(--divider-color)"
                },
                "&:hover fieldset": {
                  borderColor: "var(--primary-main)"
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--primary-main)"
                }
              },
              "& .MuiInputLabel-root": {
                color: "var(--paper-background-text)"
              }
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={isSuperAdmin}
                onChange={e => setIsSuperAdmin(e.target.checked)}
                sx={{
                  color: "var(--primary-main)",
                  "&.Mui-checked": {
                    color: "var(--primary-main)"
                  }
                }}
              />
            }
            label="Crear como superadministrador "
            sx={{
              mt: 2,
              color: "var(--paper-background-text)"
            }}
          />
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 2,
                backgroundColor: "var(--paper-background)",
                color: "var(--paper-background-text)",
                borderColor: "var(--error-main)"
              }}
            >
              {error}
            </Alert>
          )}
          {success && (
            <Alert 
              severity="success" 
              sx={{ 
                mt: 2,
                backgroundColor: "var(--paper-background)",
                color: "var(--paper-background-text)",
                borderColor: "var(--success-main)"
              }}
            >
              {success}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={onClose} 
          disabled={loading}
          sx={{
            color: "var(--paper-background-text)",
            "&:disabled": {
              color: "var(--paper-background-text)",
              opacity: 0.5
            }
          }}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          sx={{
            bgcolor: "var(--primary-main)",
            color: "var(--primary-text)",
            "&:hover": {
              bgcolor: "var(--primary-dark)"
            },
            "&:disabled": {
              bgcolor: "var(--primary-main)",
              color: "var(--primary-text)",
              opacity: 0.5
            }
          }}
        >
          {loading ? "Agregando..." : "Agregar"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AdminAdd