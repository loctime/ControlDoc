// React import removed - using JSX runtime
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Typography
} from '@mui/material';

/**
 * Diálogo para guardar una plantilla de documentos
 */
const SaveTemplateDialog = ({ 
  open, 
  onClose, 
  onSave, 
  templateName, 
  setTemplateName, 
  loading 
}) => {
  // Si no está abierto, no renderizamos nada
  if (!open) return null;

  return (
    <Dialog 
      open={true} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      disablePortal
      PaperProps={{
        sx: {
          backgroundColor: "var(--paper-background)",
          color: "var(--paper-background-text)"
        }
      }}
    >
      <DialogTitle sx={{ color: "var(--paper-background-text)" }}>Guardar como plantilla</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: "var(--paper-background-text)" }}>
          Guarde la lista actual de documentos requeridos como una plantilla para reutilizarla con otras empresas.
        </Typography>
        <TextField
          autoFocus
          margin="dense"
          label="Nombre de la plantilla"
          fullWidth
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          variant="outlined"
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
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={onClose}
          sx={{
            color: "var(--paper-background-text)"
          }}
        >
          Cancelar
        </Button>
        <Button 
          onClick={onSave} 
          variant="contained" 
          disabled={loading || !templateName.trim()}
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
          {loading ? <CircularProgress size={24} /> : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveTemplateDialog;
