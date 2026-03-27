"use client"

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Typography,
  Alert,
  CircularProgress,
  Tooltip,
  FormControlLabel,
  Checkbox,
} from "@mui/material"
import { Send as SendIcon, Close as CloseIcon } from "@mui/icons-material"
import { useMessages } from "../../../context/MessagesContext"
import { useAuth } from "../../../context/AuthContext"

export default function ComposeDialog({ open, onClose }) {
  const { userCompanies, sendMessage, searchCompanies } = useMessages()
  const { user } = useAuth()

  const [formData, setFormData] = useState({
    fromEmail: user?.email ? `${user.email}@controldoc.app` : "",
    toEmail: "",
    subject: "",
    body: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [companyOptions, setCompanyOptions] = useState([])

  const handleClose = () => {
    setFormData({
      fromEmail: user?.email ? `${user.email}@controldoc.app` : "",
      toEmail: "",
      subject: "",
      body: "",
    })
    setError("")
    setCompanyOptions([])
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.fromEmail || !formData.toEmail || !formData.subject.trim()) {
      setError("Por favor completa todos los campos obligatorios")
      return
    }

    // Normalizar emails antes de enviar
    const normFromEmail = formData.fromEmail.includes("@controldoc.app")
      ? formData.fromEmail
      : `${formData.fromEmail.replace(/@.*/, "")}@controldoc.app`
    const normToEmail = formData.toEmail.includes("@controldoc.app")
      ? formData.toEmail
      : `${formData.toEmail.replace(/@.*/, "")}@controldoc.app`

    setLoading(true)
    setError("")

    try {
      await sendMessage({
        fromEmail: normFromEmail,
        toEmail: normToEmail,
        subject: formData.subject,
        body: formData.body,
        alertaEmailReal: !!formData.alertaEmailReal,
      })

      handleClose()
    } catch (err) {
      setError(err.message || "Error al enviar mensaje")
    } finally {
      setLoading(false)
    }
  }

  const handleSearchCompanies = (searchTerm) => {
    if (searchTerm.length >= 2) {
      const results = searchCompanies(searchTerm)
      setCompanyOptions(results)
    } else {
      setCompanyOptions([])
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: "60vh" },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          bgcolor: "primary.main",
          color: "white",
        }}
      >
        <SendIcon />
        Redactar Mensaje
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Seleccionar remitente (solo email personalizado) */}
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Enviar desde</InputLabel>
            <Select
              value={formData.fromEmail || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, fromEmail: e.target.value }))}
              label="Enviar desde"
              disabled={!user?.email}
            >
              {user?.email ? (
                <MenuItem value={`${user.email}@controldoc.app`}>
                  <Box>
                    <Typography variant="body1">{`${user.email}@controldoc.app`}</Typography>
                  </Box>
                </MenuItem>
              ) : (
                <MenuItem disabled value="">
                  <Typography variant="body2" color="text.secondary">
                    Configura tu email en el perfil de administrador
                  </Typography>
                </MenuItem>
              )}
            </Select>
          </FormControl>

          {/* Destinatario con autocompletado */}
          <Autocomplete
            freeSolo
            options={companyOptions}
            getOptionLabel={(option) => (typeof option === "string" ? option : option.virtualEmail)}
            renderOption={(props, option) => {
              const { key, ...rest } = props;
              return (
                <Box component="li" key={key} {...rest}>
                  <Box>
                    <Typography variant="body2">{option.companyName || option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.virtualEmail}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
            onInputChange={(event, value) => {
              let fixedValue = value;
              let showWarning = false;

              if (fixedValue.includes("@") && !fixedValue.endsWith("@controldoc.app")) {
                // Si tiene un dominio incorrecto, lo reemplazamos
                fixedValue = fixedValue.replace(/@.*/, "@controldoc.app");
                showWarning = true;
              } else if (!fixedValue.includes("@") && fixedValue.length > 0) {
                // Si no tiene dominio, lo agregamos
                fixedValue = fixedValue + "@controldoc.app";
              }

              setFormData((prev) => ({ ...prev, toEmail: fixedValue }));

              if (showWarning) {
                setError("El dominio fue corregido automáticamente a @controldoc.app");
              } else {
                setError("");
              }

              handleSearchCompanies(fixedValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Para (email de empresa)"
                margin="normal"
                required
                fullWidth
                placeholder="empresa@controldoc.app"
                helperText="Escribe el nombre de la empresa o su email virtual"
              />
            )}
          />

          {/* Asunto */}
          <TextField
            label="Asunto"
            value={formData.subject}
            onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
            fullWidth
            margin="normal"
            required
            placeholder="Escribe el asunto del mensaje"
          />

          {/* Mensaje */}
          <TextField
            label="Mensaje"
            value={formData.body}
            onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
            fullWidth
            multiline
            rows={8}
            margin="normal"
            placeholder="Escribe tu mensaje aquí..."
            sx={{ mt: 2 }}
          />

          {/* Checkbox Enviar alerta */}
          <Box sx={{ mt: 2 }}>
            <Tooltip title="Enviar alerta a email real" arrow>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.alertaEmailReal || false}
                    onChange={(e) => setFormData((prev) => ({ ...prev, alertaEmailReal: e.target.checked }))}
                    color="primary"
                  />
                }
                label={<Typography variant="body2" component="span">Enviar alerta</Typography>}
              />
            </Tooltip>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={handleClose} startIcon={<CloseIcon />} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
            disabled={loading}
          >
            {loading ? "Enviando..." : "Enviar Mensaje"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
