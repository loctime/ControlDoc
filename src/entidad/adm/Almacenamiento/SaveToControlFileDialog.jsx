import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  Collapse,
  IconButton
} from '@mui/material';
import { 
  PictureAsPdf, 
  InsertDriveFile, 
  Image, 
  Description,
  ExpandMore,
  ExpandLess,
  AccountCircle,
  CheckCircle,
  Error
} from '@mui/icons-material';
// import useControlFileQuery from '../../../hooks/useControlFileQuery'; // SDK deshabilitado temporalmente para debug

// Mapeo de iconos por tipo de archivo
const getFileIcon = (fileName, fileType) => {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  
  if (fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
    return <Image sx={{ color: "var(--primary-main)" }} />;
  }
  if (fileType === 'application/pdf' || ext === 'pdf') {
    return <PictureAsPdf sx={{ color: "var(--error-main)" }} />;
  }
  if (fileType?.includes('word') || ['doc', 'docx'].includes(ext)) {
    return <Description sx={{ color: '#2b579a' }} />;
  }
  if (fileType?.includes('excel') || ['xls', 'xlsx'].includes(ext)) {
    return <Description sx={{ color: '#217346' }} />;
  }
  return <InsertDriveFile sx={{ color: "var(--paper-background-text)", opacity: 0.5 }} />;
};

export default function SaveToControlFileDialog({ 
  open, 
  onClose, 
  files = [],
  onSaveComplete
}) {
  // SDK deshabilitado temporalmente para debug
  throw new Error("SDK deshabilitado temporalmente para debug");
  
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [saveProgress, setSaveProgress] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState([]);
  
  const { 
    status, 
    error: controlFileError, 
    user, 
    connect, 
    saveFile 
  } = useControlFileQuery();

  const isConnected = status === 'connected' && user;
  const displayFiles = showAllFiles ? files : files.slice(0, 3);
  const hasMoreFiles = files.length > 3;

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Error conectando a ControlFile:', error);
    }
  };

  const handleSave = async () => {
    if (!isConnected) {
      await handleConnect();
      return;
    }

    setIsSaving(true);
    setSaveProgress({});
    setSaveResults([]);
    
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setSaveProgress(prev => ({
          ...prev,
          [file.fileId]: { status: 'saving', progress: 50 }
        }));

        // Crear un objeto File para el saveFile
        const response = await fetch(file.fileURL);
        const blob = await response.blob();
        const fileObj = new File([blob], file.fileName, { type: file.fileType });
        
        const result = await saveFile(fileObj);
        
        setSaveProgress(prev => ({
          ...prev,
          [file.fileId]: { status: 'success', progress: 100 }
        }));
        
        results.push({ file, success: true, result });
        
      } catch (error) {
        console.error(`Error guardando ${file.fileName}:`, error);
        
        setSaveProgress(prev => ({
          ...prev,
          [file.fileId]: { status: 'error', progress: 0, error: error.message }
        }));
        
        results.push({ file, success: false, error: error.message });
      }
    }

    setSaveResults(results);
    setIsSaving(false);

    // Notificar al componente padre
    if (onSaveComplete) {
      onSaveComplete(results);
    }

    // Auto-cerrar si todo fue exitoso
    const allSuccess = results.every(r => r.success);
    if (allSuccess) {
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const getProgressIcon = (fileId) => {
    const progress = saveProgress[fileId];
    if (!progress) return null;
    
    switch (progress.status) {
      case 'saving':
        return <CircularProgress size={20} />;
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Image color="primary" />
          Guardar en ControlFile
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Los siguientes {files.length} archivos se guardarán en ControlFile:
          </Typography>
          
          <List dense>
            {displayFiles.map((file) => (
              <ListItem key={file.fileId} sx={{ px: 0 }}>
                <ListItemIcon>
                  {getFileIcon(file.fileName, file.fileType)}
                </ListItemIcon>
                <ListItemText
                  primary={file.fileName}
                  secondary={file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Tamaño desconocido'}
                />
                {getProgressIcon(file.fileId)}
              </ListItem>
            ))}
          </List>

          {hasMoreFiles && (
            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Button
                startIcon={showAllFiles ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setShowAllFiles(!showAllFiles)}
                size="small"
              >
                {showAllFiles 
                  ? 'Ver menos' 
                  : `Ver ${files.length - 3} más...`
                }
              </Button>
            </Box>
          )}

          <Collapse in={showAllFiles && hasMoreFiles}>
            <List dense>
              {files.slice(3).map((file) => (
                <ListItem key={file.fileId} sx={{ px: 0 }}>
                  <ListItemIcon>
                    {getFileIcon(file.fileName, file.fileType)}
                  </ListItemIcon>
                  <ListItemText
                    primary={file.fileName}
                    secondary={file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Tamaño desconocido'}
                  />
                  {getProgressIcon(file.fileId)}
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>

        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Cuenta conectada:
          </Typography>
          
          {isConnected ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 24, height: 24 }}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%' }} />
                ) : (
                  <AccountCircle />
                )}
              </Avatar>
              <Typography variant="body2">
                {user.displayName || user.email}
              </Typography>
              <Chip label="Conectado" color="success" size="small" />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccountCircle color="disabled" />
              <Typography variant="body2" color="text.secondary">
                No conectado a ControlFile
              </Typography>
              <Chip label="Desconectado" color="default" size="small" />
            </Box>
          )}
        </Box>

        {controlFileError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error: {controlFileError.message}
          </Alert>
        )}

        {saveResults.length > 0 && (
          <Alert 
            severity={saveResults.every(r => r.success) ? "success" : "warning"}
            sx={{ mb: 2 }}
          >
            {saveResults.filter(r => r.success).length} de {saveResults.length} archivos guardados correctamente
            {saveResults.some(r => !r.success) && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Errores: {saveResults.filter(r => !r.success).map(r => r.file.fileName).join(', ')}
                </Typography>
              </Box>
            )}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Cancelar'}
        </Button>
        <Button 
          variant="contained" 
          onClick={isConnected ? handleSave : handleConnect}
          disabled={isSaving || status === 'connecting'}
        >
          {isSaving ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Guardando...
            </>
          ) : isConnected ? (
            `Guardar ${files.length} archivo${files.length !== 1 ? 's' : ''}`
          ) : (
            'Conectar a ControlFile'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
