//adm/Library/DocumentViewer.jsx
// React import removed - using JSX runtime
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, IconButton, CircularProgress,
  Tooltip, Divider, Chip
} from '@mui/material';
import DownloadButton from '../../../components/common/DownloadButton';
import VistaPrevia from '../../../components/common/VistaPrevia';
import {
  Close, Download, PictureAsPdf, Image, Description, 
  CheckCircle, Cancel, Pending
} from '@mui/icons-material';
import { useClientName } from '../../../utils/getClientName';


export default function DocumentViewer({
  open,
  handleClose,
  currentDocument,
  handleDownload,
  formatFileSize,
  formatDate,
  loadingDocument
}) {
  const { clientName, isLoading: isLoadingClientName } = useClientName(currentDocument?.clientId);
  const getFileIcon = (type) => {
    switch(type?.toLowerCase()) {
      case 'pdf': return <PictureAsPdf color="error" fontSize="large" />;
      case 'jpg':
      case 'jpeg':
      case 'png': return <Image color="primary" fontSize="large" />;
      default: return <Description color="action" fontSize="large" />;
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Aprobado': return <CheckCircle color="success" />;
      case 'Rechazado': return <Cancel color="error" />;
      default: return <Pending color="warning" />;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: '60vh'
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          flexDirection: { xs: 'column', sm: 'row' },
          bgcolor: '#f9f9f9',
          borderBottom: '1px solid #ddd',
          px: 2,
          py: 1
        }}
      >
        {/* Columna izquierda: Nombre e ícono */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentDocument && getFileIcon(currentDocument.fileType)}
          <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
            {currentDocument?.name || 'Documento sin nombre'}
          </Typography>
        </Box>

        {/* Columna central: Información de empleado */}
        {currentDocument?.entityType !== 'company' && currentDocument && (
          <Box sx={{ 
            textAlign: { xs: 'left', sm: 'center' },
            flex: 1,
            px: { sm: 1 },
            fontSize: '0.9rem'
          }}>
            <Typography variant="body2" color="text.secondary">
              {currentDocument.entityType === 'employee' ? 'Empleado' :
               currentDocument.entityType === 'vehicle' ? 'Vehículo' : 'Entidad'}: {currentDocument.entityName}
            </Typography>
          </Box>
        )}

        {/* Columna derecha: Fechas */}
        <Box sx={{ 
          textAlign: { xs: 'left', sm: 'right' },
          fontSize: '0.8rem'
        }}>
          <Typography variant="caption" color="text.secondary">
            Subido: {formatDate(currentDocument?.uploadedAt)}
          </Typography>
          <br />
          <Typography variant="caption" color="text.secondary">
            Vence: {currentDocument?.expirationDate ? formatDate(currentDocument.expirationDate) : 'N/A'}
          </Typography>
        </Box>
        <IconButton onClick={handleClose}>
          <Close />
        </IconButton>
      </DialogTitle>
      
      <Divider />

      <DialogContent>
        {loadingDocument ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '50vh' 
          }}>
            <CircularProgress size={60} />
          </Box>
        ) : currentDocument ? (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            {/* Metadatos - siempre visible */}
            <Box sx={{ 
              width: '100%',
              maxWidth: '420px',
              order: { xs: 2, md: 1 },
              flexShrink: 0
            }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: '1fr 1fr'
                  },
                  columnGap: 1,
                  rowGap: 0.5,
                  mt: 0.5,
                  '& > div': {
                    p: 0
                  }
                }}
              >

                {[
                  { label: 'Empresa', value: currentDocument.companyName },
                  { label: 'Cliente', value: isLoadingClientName ? '...' : (clientName || '-') },
                  { label: 'Nombre', value: currentDocument.name },
                  { label: 'Tipo archivo', value: currentDocument.fileType },
                  { label: 'Tamaño', value: formatFileSize(currentDocument.size) },
                  { label: 'Bytes', value: `${currentDocument.size || 0} bytes` },
                  { label: 'Subida', value: formatDate(currentDocument.uploadedAt) },
                  { label: 'Aprobado', value: formatDate(currentDocument.reviewedAt) },
                  { label: 'Vencimiento', value: currentDocument.expirationDate ? formatDate(currentDocument.expirationDate) : 'N/A' },
                  { label: 'Estado', value: (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getStatusIcon(currentDocument.status)}
                      <Typography>{currentDocument.status}</Typography>
                    </Box>
                  )},
                  { label: 'Entidad', value: 
                    currentDocument.entityType === 'employee' ? 'Empleado' :
                    currentDocument.entityType === 'vehicle' ? 'Vehículo' : 'Empresa' 
                  },
                  { label: 'Nombre entidad', value: currentDocument.entityName },
                  { label: 'Aprobado por', value: currentDocument.reviewedBy },
                  { label: 'Versión', value: `v${currentDocument.version}` },
                  { label: 'Comentario', value: currentDocument.companyComment },
                  { label: 'Comentario de revisión', value: currentDocument.adminComment },
                  { label: 'Comentario de ejemplo', value: currentDocument.exampleComment },
                ]
                .filter(Boolean)
                .map(({ label, value }) => (
                  <Box key={label} sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" color="text.secondary" fontSize="small">{label}</Typography>
                    {typeof value === 'string' || typeof value === 'number'
                      ? <Typography fontSize="small" sx={{ wordBreak: 'break-word' }}>{value}</Typography>
                      : value}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Vista previa - se ajusta según tipo de archivo */}
            <Box sx={{ 
              flex: 1,
              order: { xs: 1, md: 2 },
              bgcolor: '#f5f5f5',
              borderRadius: 2,
              p: 2,
              minHeight: '40vh',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              {currentDocument?.fileURL ? (
                <VistaPrevia 
                  url={currentDocument.fileURL}
                  width="100%"
                  height="100%"
                  sx={{ 
                    maxHeight: '30vh',
                    bgcolor: 'white',
                    p: 1,
                    borderRadius: 1,
                    boxShadow: 1
                  }}
                />
              ) : (
                <Typography variant="body1" color="text.secondary">
                  No hay URL disponible para mostrar vista previa
                </Typography>
              )}
            </Box>
          </Box>
        ) : (
          <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No se ha seleccionado ningún documento para visualizar
          </Typography>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={handleClose}
          variant="outlined"
          sx={{ borderRadius: 2 }}
        >
          Cerrar
        </Button>
        
        {currentDocument && (
          <DownloadButton
            url={currentDocument.fileURL}
            currentDocument={currentDocument}
            label="Descargar"
            disabled={!currentDocument.fileURL}
            sx={{ borderRadius: 2 }}
          />
        )}
      </DialogActions>
    </Dialog>
  );
}