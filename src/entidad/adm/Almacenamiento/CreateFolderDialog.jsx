import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography,
} from "@mui/material"
import { useSnackbar } from "notistack"
import { cleanFileName } from "../../../utils/cleanFileName"

export default function CreateFolderDialog({ open, onClose, onCreate }) {
  const [folderName, setFolderName] = useState("")
  const [visibility, setVisibility] = useState("private")
  const [loading, setLoading] = useState(false)
  const { enqueueSnackbar } = useSnackbar()

  const handleCreate = async () => {
    if (!folderName.trim()) {
      enqueueSnackbar("Por favor ingresa un nombre para la carpeta", { variant: "warning" })
      return
    }
    setLoading(true)
    const urlName = cleanFileName(folderName)
    console.debug("[CreateFolderDialog] Creando carpeta:", urlName, visibility)
    try {
      await onCreate(urlName, visibility)
      setFolderName("")
      setVisibility("private")
      onClose()
      enqueueSnackbar("Carpeta creada correctamente", { variant: "success" })
    } catch (error) {
      console.error("[CreateFolderDialog] Error creando carpeta:", error)
      enqueueSnackbar("Error al crear la carpeta: " + (error.message || error), { variant: "error" })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFolderName("")
      setVisibility("private")
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Crear Nueva Carpeta</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label="Nombre de la carpeta"
            fullWidth
            variant="outlined"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            disabled={loading}
            helperText={`El nombre será: ${cleanFileName(folderName)}`}
            sx={{ mb: 3 }}
          />
          <FormControl component="fieldset" disabled={loading}>
            <FormLabel component="legend">Visibilidad</FormLabel>
            <RadioGroup value={visibility} onChange={(e) => setVisibility(e.target.value)} sx={{ mt: 1 }}>
              <FormControlLabel
                value="private"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      Privada
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Solo tú puedes ver y editar esta carpeta
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="public"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      Pública
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Todos los usuarios pueden ver esta carpeta
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleCreate} variant="contained" disabled={loading || !folderName.trim()}>
          {loading ? "Creando..." : "Crear Carpeta"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
