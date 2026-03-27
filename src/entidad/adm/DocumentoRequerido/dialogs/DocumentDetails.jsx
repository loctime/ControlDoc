// React import removed - using JSX runtime
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import VistaPrevia from '../../../../components/common/VistaPrevia';

/**
 * Diálogo para mostrar los detalles de un documento individual, incluyendo su archivo de ejemplo.
 */
const DocumentoDetalleDialog = ({
  open,
  onClose,
  documento,
  onApply,
  disabled = false
}) => {
  if (!open || !documento) return null;

  return (
    <Dialog 
      open={true} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: "var(--paper-background)",
          color: "var(--paper-background-text)"
        }
      }}
    >
      <DialogTitle sx={{ color: "var(--paper-background-text)" }}>Detalles del documento: {documento.name}</DialogTitle>
      <DialogContent>
        <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: "var(--paper-background)" }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: "var(--paper-background-text)" }}>{documento.name}</Typography>
          <Typography variant="body2" sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>
            Tipo: {documento.entityType === 'company' ? 'Empresa' :
                   documento.entityType === 'employee' ? 'Empleado' :
                   documento.entityType === 'vehicle' ? 'Vehículo' : documento.entityType}
          </Typography>
          {documento.comentario && (
            <Typography variant="body2" sx={{ mt: 1, color: "var(--paper-background-text)", opacity: 0.7 }}>
              Comentario: {documento.comentario}
            </Typography>
          )}
          {documento.exampleImage && (
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <VistaPrevia 
                url={documento.exampleImage}
                width="100%"
                height={400}
                tipo="ejemplo"
                sx={{ 
                  border: `1px dashed var(--divider-color)`,
                  backgroundColor: "var(--page-background)",
                  borderRadius: 1
                }}
              />
            </Box>
          )}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={onClose}
          sx={{
            color: "var(--paper-background-text)"
          }}
        >
          Cerrar
        </Button>
        <Button
          onClick={() => {
            onApply?.(documento);
            onClose();
          }}
          disabled={disabled}
          startIcon={<AddIcon />}
          variant="contained"
          color="primary"
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
          Copiar a mi empresa
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentoDetalleDialog;
