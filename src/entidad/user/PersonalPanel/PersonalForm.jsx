import React, { useState, useContext, useEffect } from "react";
import { db } from "../../../config/firebaseconfig";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Alert,
  Snackbar,
  CircularProgress
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { AuthContext } from "../../../context/AuthContext.jsx";

import { doc, updateDoc } from "firebase/firestore";
import { getTenantCollectionPath } from '../../../utils/tenantUtils';

const PersonalForm = ({ onPersonalAdded, companyId: propCompanyId, modoEdicion = false, persona = null, onPersonalEdited }) => {
  const [nombre, setNombre] = useState(persona ? persona.nombre : "");
  const [apellido, setApellido] = useState(persona ? persona.apellido : "");
  const [dni, setDni] = useState(persona ? persona.dni : "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const userCompanyData = JSON.parse(localStorage.getItem('userCompany') || '{}');
  const { user: currentUser, activeCompanyId, mainCompanyId } = useContext(AuthContext);
  // Siempre usar mainCompanyId como companyId
  const finalCompanyId = mainCompanyId || userCompanyData?.companyId;
  // Determinar clientId: si activeCompanyId !== mainCompanyId, entonces es un cliente
  const clientId = (activeCompanyId && activeCompanyId !== mainCompanyId) ? activeCompanyId : null;

  // Actualiza los campos si cambia la persona a editar
  useEffect(() => {
    if (modoEdicion && persona) {
      setNombre(persona.nombre || "");
      setApellido(persona.apellido || "");
      setDni(persona.dni || "");
    }
  }, [modoEdicion, persona]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nombre.trim() || !apellido.trim() || !dni.trim()) {
      setError("Por favor completa los campos obligatorios");
      return;
    }
    // Validación estricta de DNI
    if (!/^[0-9]{7,8}$/.test(dni.trim())) {
      setError("El DNI debe tener 7 u 8 números y solo contener dígitos.");
      return;
    }

    if (!finalCompanyId) {
      setError("Error: No se pudo identificar la empresa. Cierre sesión y vuelva a ingresar.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (modoEdicion && persona && persona.id) {
        // Modo edición: actualizar persona existente
        const personalCollectionPath = getTenantCollectionPath('personal');
        await updateDoc(doc(db, personalCollectionPath, persona.id), {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          dni: dni.trim(),
          activo: typeof persona.activo === 'boolean' ? persona.activo : true,
        });
        setSuccess(true);
        if (typeof onPersonalEdited === 'function') {
          onPersonalEdited({
            id: persona.id,
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            dni: dni.trim(),
          });
        }
      } else {
        // Modo agregar: crear nuevo
        const personalCollectionPath = getTenantCollectionPath('personal');
        
        // Validar DNI duplicado: buscar por mainCompanyId
        const dniQuery = query(
          collection(db, personalCollectionPath),
          where("dni", "==", dni.trim()),
          where("companyId", "==", finalCompanyId)
        );
        const existingDniSnap = await getDocs(dniQuery);
        
        // Filtrar también por clientId si aplica
        const existingDnis = existingDniSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => {
            const pClientId = p.clientId || null;
            return pClientId === clientId;
          });

        if (existingDnis.length > 0) {
          setError("Ya existe un empleado registrado con ese DNI.");
          setLoading(false);
          return;
        }

        const rawData = {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          dni: dni.trim(),
          companyId: finalCompanyId,
          clientId: clientId, // null si es empresa principal, ID del cliente si es subempresa
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.uid || null,
        };
        
        const docData = Object.fromEntries(
          Object.entries(rawData).filter(([_, v]) => v !== undefined)
        );
        
        await addDoc(collection(db, personalCollectionPath), docData);

        setNombre("");
        setApellido("");
        setDni("");
        setSuccess(true);
        if (typeof onPersonalAdded === 'function') {
          onPersonalAdded();
        }
      }
    } catch (err) {
      console.error("Error al guardar personal:", err);
      setError("Error al guardar los datos. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSuccess(false);
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4 }} id="user-personal-form-paper">
      <Typography variant="h6" gutterBottom id="user-personal-form-title">
        {modoEdicion ? 'Editar Persona' : 'Agregar Nuevo Personal'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} id="user-personal-form-error">
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} id="user-personal-form">
        <Grid container spacing={2} id="user-personal-form-grid">
          <Grid item xs={12} sm={6} id="user-personal-form-nombre-grid">
            <TextField
              fullWidth
              label="Nombre *"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={loading}
              id="user-personal-form-nombre"
            />
          </Grid>
          <Grid item xs={12} sm={6} id="user-personal-form-apellido-grid">
            <TextField
              fullWidth
              label="Apellido *"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              disabled={loading}
              id="user-personal-form-apellido"
            />
          </Grid>
          <Grid item xs={12} sm={6} id="user-personal-form-dni-grid">
            <TextField
              fullWidth
              label="DNI *"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              disabled={loading}
              id="user-personal-form-dni"
            />
          </Grid>
          <Grid item xs={12} id="user-personal-form-btn-grid">
            <Button
              type="submit"
              variant="contained"
              startIcon={<PersonAddIcon />}
              disabled={loading}
              sx={{ mt: 2 }}
              fullWidth
              id="user-personal-form-submit"
            >
              {loading ? <CircularProgress size={24} /> : (modoEdicion ? 'Guardar Cambios' : 'Agregar Personal')}
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        id="user-personal-form-snackbar"
      >
        <Alert onClose={handleCloseSnackbar} severity="success" id="user-personal-form-alert-success">
          Personal agregado exitosamente
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default PersonalForm;
