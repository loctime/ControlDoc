import React, { useState, useEffect } from 'react';
import { db } from "../../../config/firebaseconfig";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { cleanFirestoreData } from "../../../utils/cleanFirestoreData";
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
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";

import { doc, updateDoc } from "firebase/firestore";
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import { useAuth } from '../../../context/AuthContext';

const VehiculosForm = ({ onVehiculoAdded, companyId: propCompanyId, modoEdicion = false, vehiculo = null, onVehiculoEdited }) => {
  const { activeCompanyId, mainCompanyId } = useAuth();
  const [marca, setMarca] = useState(vehiculo ? vehiculo.marca : "");
  const [modelo, setModelo] = useState(vehiculo ? vehiculo.modelo : "");
  const [patente, setPatente] = useState(vehiculo ? vehiculo.patente : "");
  const [año, setAño] = useState(vehiculo ? vehiculo.año : "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Actualiza los campos si cambia el vehículo a editar
  useEffect(() => {
    if (modoEdicion && vehiculo) {
      setMarca(vehiculo.marca || "");
      setModelo(vehiculo.modelo || "");
      setPatente(vehiculo.patente || "");
      setAño(vehiculo.año || "");
    }
  }, [modoEdicion, vehiculo]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!marca.trim() || !modelo.trim() || !patente.trim()) {
      setError("Por favor completa los campos obligatorios");
      return;
    }

    const userCompanyData = JSON.parse(localStorage.getItem('userCompany') || '{}');
    // Siempre usar mainCompanyId como companyId
    const finalCompanyId = mainCompanyId || userCompanyData?.companyId;
    // Determinar clientId: si activeCompanyId !== mainCompanyId, entonces es un cliente
    const clientId = (activeCompanyId && activeCompanyId !== mainCompanyId) ? activeCompanyId : null;

    if (!finalCompanyId) {
      setError("No tienes empresa asociada. No se puede agregar vehículo.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (modoEdicion && vehiculo && vehiculo.id) {
        // Modo edición: actualizar vehículo existente
        const vehiculosCollectionPath = getTenantCollectionPath('vehiculos');
        await updateDoc(doc(db, vehiculosCollectionPath, vehiculo.id), {
          marca: marca.trim(),
          modelo: modelo.trim(),
          patente: patente.trim(),
          año: año.trim() || null,
        });
        setSuccess(true);
        if (typeof onVehiculoEdited === 'function') {
          onVehiculoEdited({
            id: vehiculo.id,
            marca: marca.trim(),
            modelo: modelo.trim(),
            patente: patente.trim(),
            año: año.trim() || null,
          });
        }
      } else {
        // Modo agregar: crear nuevo
        const vehiculosCollectionPath = getTenantCollectionPath('vehiculos');
        
        // Validar patente duplicada: buscar por mainCompanyId
        const patenteQuery = query(
          collection(db, vehiculosCollectionPath),
          where("patente", "==", patente.trim()),
          where("companyId", "==", finalCompanyId)
        );
        const existingPatenteSnap = await getDocs(patenteQuery);
        
        // Filtrar también por clientId si aplica
        const existingPatentes = existingPatenteSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(v => {
            const vClientId = v.clientId || null;
            return vClientId === clientId;
          });

        if (existingPatentes.length > 0) {
          setError("Ya existe un vehículo registrado con esa patente.");
          setLoading(false);
          return;
        }

        const rawVehiculo = {
          marca: marca.trim(),
          modelo: modelo.trim(),
          patente: patente.trim(),
          año: año.trim() || null,
          companyId: finalCompanyId,
          clientId: clientId, // null si es empresa principal, ID del cliente si es subempresa
          activo: true,
          createdAt: serverTimestamp(),
        };
        
        const cleanVehiculo = cleanFirestoreData(rawVehiculo);
        
        await addDoc(collection(db, vehiculosCollectionPath), cleanVehiculo);
        
        setMarca("");
        setModelo("");
        setPatente("");
        setAño("");

        setSuccess(true);
        if (typeof onVehiculoAdded === 'function') {
          onVehiculoAdded();
        }
      }
    } catch (err) {
      console.error("Error al guardar vehículo:", err);
      setError("Error al guardar los datos. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSuccess(false);
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4 }} id="user-vehicle-form-paper">
      <Typography variant="h6" gutterBottom id="user-vehicle-form-title">
        {modoEdicion ? 'Editar Vehículo' : 'Agregar Nuevo Vehículo'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} id="user-vehicle-form-error">
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} id="user-vehicle-form">
        <Grid container spacing={2} id="user-vehicle-form-grid">
          <Grid columns={12} columnSpacing={2} id="user-vehicle-form-marca-grid">
            <TextField
              fullWidth
              label="Marca *"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              disabled={loading}
              id="user-vehicle-form-marca"
            />
          </Grid>
          <Grid columns={12} columnSpacing={2} id="user-vehicle-form-modelo-grid">
            <TextField
              fullWidth
              label="Modelo *"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              disabled={loading}
              id="user-vehicle-form-modelo"
            />
          </Grid>
          <Grid columns={12} columnSpacing={2} id="user-vehicle-form-patente-grid">
            <TextField
              fullWidth
              label="Patente *"
              value={patente}
              onChange={(e) => setPatente(e.target.value)}
              disabled={loading}
              id="user-vehicle-form-patente"
            />
          </Grid>
          <Grid columns={12} columnSpacing={2} id="user-vehicle-form-anio-grid">
            <TextField
              fullWidth
              label="Año"
              value={año}
              onChange={(e) => setAño(e.target.value)}
              disabled={loading}
              type="number"
              inputProps={{ min: 1900, max: new Date().getFullYear() }}
              id="user-vehicle-form-anio"
            />
          </Grid>

          <Grid item xs={12} id="user-vehicle-form-btn-grid">
            <Button
              type="submit"
              variant="contained"
              startIcon={<DirectionsCarIcon />}
              disabled={loading}
              sx={{ mt: 2 }}
              fullWidth
              id="user-vehicle-form-submit"
            >
              {loading ? <CircularProgress size={24} /> : (modoEdicion ? 'Guardar Cambios' : 'Agregar Vehículo')}
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        id="user-vehicle-form-snackbar"
      >
        <Alert onClose={handleCloseSnackbar} severity="success" id="user-vehicle-form-alert-success">
          Vehículo agregado exitosamente
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default VehiculosForm;
