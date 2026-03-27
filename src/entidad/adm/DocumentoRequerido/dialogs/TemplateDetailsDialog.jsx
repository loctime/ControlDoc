// React import removed - using JSX runtime
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Grid
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import VistaPrevia from '../../../../components/common/VistaPrevia';

/**
 * Diálogo para mostrar los detalles de una plantilla
 */
const TemplateDetailsDialog = ({
  open,
  onClose,
  template,
  onApply,
  selectedCompanyId
}) => {
  // Si no está abierto o no hay plantilla seleccionada, no renderizamos nada
  if (!open || !template) return null;

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disablePortal
      PaperProps={{
        sx: {
          backgroundColor: "var(--paper-background)",
          color: "var(--paper-background-text)"
        }
      }}
    >
      <DialogTitle sx={{ color: "var(--paper-background-text)" }}>
        Detalles de la plantilla: {template.name}
      </DialogTitle>
      <DialogContent>
        <Typography variant="subtitle2" sx={{ mb: 1, color: "var(--paper-background-text)" }}>
          Documentos incluidos:
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mb: 2, backgroundColor: "var(--paper-background)" }}>
          <Grid container spacing={2}>
            {template.documents?.map((doc, index) => (
              <Grid xs={12} sm={6} md={4} key={index}>
                <Paper
                  elevation={1}
                  sx={{
                    p: 2,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: "var(--page-background)",
                    gap: 1
                  }}
                >
                  <Typography variant="subtitle2" noWrap sx={{ color: "var(--page-background-text)" }}>
                    {doc.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "var(--page-background-text)", opacity: 0.7 }}>
                    Tipo: {doc.entityType === 'company' ? 'Empresa' :
                          doc.entityType === 'personal' ? 'Personal' :
                          doc.entityType === 'vehicle' ? 'Vehículo' : doc.entityType}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "var(--page-background-text)", opacity: 0.7 }} noWrap>
                    Vencimiento: {doc.deadline?.type === 'monthly' ? 'Mensual' :
                                doc.deadline?.type === 'biannual' ? 'Semestral' :
                                doc.deadline?.type === 'annual' ? 'Anual' :
                                doc.deadline?.type === 'custom' ? 'Personalizado' : 'No especificado'}
                  </Typography>
                  {doc.exampleImage && (
                    <Box sx={{ mt: 1, height: 100 }}>
                      <VistaPrevia 
                        url={doc.exampleImage} 
                        titulo={doc.name}
                        tipo="ejemplo"
                      />
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => {
              onApply(template);
              onClose();
            }}
            disabled={!selectedCompanyId}
            startIcon={<AddIcon />}
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
            Aplicar esta plantilla
          </Button>
        </Box>
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
      </DialogActions>
    </Dialog>
  );
};

export default TemplateDetailsDialog;
