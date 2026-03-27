import { useState } from 'react';
import { 
  Grid, 
  Checkbox, 
  Button, 
  Box, 
  Typography,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogActions
} from "@mui/material";
import { Delete, Save } from "@mui/icons-material";
import { useSnackbar } from "notistack";
import VistaDocumentoCard from "./VistaDocumentoCard.jsx";
// import SaveToControlFileDialog from "./SaveToControlFileDialog.jsx"; // SDK deshabilitado temporalmente para debug

export default function FileGrid({ 
  visibleFiles = [],
  handleOpenMenu = () => {},
  onDeleteFiles = () => console.warn("onDeleteFiles no implementado"),
  onDeleteFile = () => console.warn("onDeleteFile no implementado"),
  onSaveToControlFile = () => console.warn("onSaveToControlFile no implementado"),
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const toggleFileSelection = (fileId) => {
    if (!fileId) {
      console.warn("Archivo sin ID:", fileId);
      return;
    }
    setSelectedFiles((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]));
  };

  const handleDeleteSelected = async () => {
    setConfirmOpen(false);
    if (selectedFiles.length === 0) return;
    setLoading(true);
    try {
      const filesToDelete = visibleFiles.filter((f) => f.fileId && selectedFiles.includes(f.fileId));
      console.debug("[FileGrid] Eliminando archivos:", filesToDelete);
      if (typeof onDeleteFiles === "function") {
        await onDeleteFiles(filesToDelete);
      } else {
        for (const file of filesToDelete) {
          await onDeleteFile(file);
        }
      }
      setSelectedFiles([]);
      enqueueSnackbar(`${filesToDelete.length} archivo(s) eliminado(s) correctamente`, { variant: "success" });
    } catch (error) {
      console.error("[FileGrid] Error al eliminar archivos:", error);
      enqueueSnackbar("Error al eliminar archivos: " + (error.message || error), { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSingleDelete = async (file) => {
    try {
      await onDeleteFile(file);
      enqueueSnackbar("Archivo eliminado correctamente", { variant: "success" });
    } catch (error) {
      console.error("[FileGrid] Error al eliminar archivo:", error);
      enqueueSnackbar("Error al eliminar archivo: " + (error.message || error), { variant: "error" });
    }
  };

  const handleSaveToControlFile = () => {
    // SDK deshabilitado temporalmente para debug
    alert("SDK deshabilitado temporalmente para debug");
    return;
    
    if (selectedFiles.length === 0) return;
    setSaveDialogOpen(true);
  };

  const handleSaveComplete = (results) => {
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    if (successCount > 0) {
      enqueueSnackbar(
        `${successCount} archivo(s) guardado(s) en ControlFile`, 
        { variant: "success" }
      );
    }
    
    if (errorCount > 0) {
      enqueueSnackbar(
        `Error al guardar ${errorCount} archivo(s)`, 
        { variant: "error" }
      );
    }
    
    setSelectedFiles([]);
    setSaveDialogOpen(false);
  };

  if (!Array.isArray(visibleFiles)) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography color="error">Error: visibleFiles debe ser un array</Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="subtitle1">
          {selectedFiles.length > 0
            ? `${selectedFiles.length} archivos seleccionados`
            : `${visibleFiles.length} archivos`}
        </Typography>

        {selectedFiles.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Guardar en ControlFile">
              <Button
                variant="contained"
                color="primary"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Save />}
                onClick={handleSaveToControlFile}
                disabled={loading || selectedFiles.length === 0}
                aria-label="Guardar archivos en ControlFile"
              >
                {loading ? "Guardando..." : `Guardar en ControlFile (${selectedFiles.length})`}
              </Button>
            </Tooltip>
            <Tooltip title="Eliminar archivos seleccionados">
              <Button
                variant="contained"
                color="error"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Delete />}
                onClick={() => setConfirmOpen(true)}
                disabled={loading || selectedFiles.length === 0}
                aria-label="Eliminar archivos seleccionados"
              >
                {loading ? "Eliminando..." : `Eliminar (${selectedFiles.length})`}
              </Button>
            </Tooltip>
          </Box>
        )}
      </Box>

      {visibleFiles.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            No hay archivos para mostrar
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {visibleFiles.map((file, index) => {
            const fileId = file.fileId || file.id || `file-${index}`;
            if (!file.fileId && !file.id) {
              console.warn("[FileGrid] Archivo sin ID único:", file);
            }
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={fileId}>
                <Box sx={{ position: "relative" }}>
                  <Checkbox
                    checked={selectedFiles.includes(fileId)}
                    onChange={() => toggleFileSelection(fileId)}
                    sx={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      zIndex: 1,
                      backgroundColor: "rgba(255, 255, 255, 0.8)",
                      borderRadius: "4px",
                    }}
                    aria-label={selectedFiles.includes(fileId) ? `Deseleccionar archivo ${fileId}` : `Seleccionar archivo ${fileId}`}
                  />
                  <VistaDocumentoCard
                    file={file}
                    onDeleteFile={handleSingleDelete}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleOpenMenu(e, file);
                    }}
                  />
                </Box>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>
          ¿Estás seguro de eliminar {selectedFiles.length} archivo(s)?
        </DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleDeleteSelected} color="error" variant="contained" disabled={loading}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* SaveToControlFileDialog deshabilitado temporalmente para debug */}
      {/* <SaveToControlFileDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        files={visibleFiles.filter((f) => f.fileId && selectedFiles.includes(f.fileId))}
        onSaveComplete={handleSaveComplete}
      /> */}
    </>
  );
}
// Refactor: confirmación moderna, feedback global, logs y accesibilidad mejorados.