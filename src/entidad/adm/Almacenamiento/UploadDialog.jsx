"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  LinearProgress,
  Alert,
  Snackbar
} from "@mui/material"
import { Close, CloudUpload } from "@mui/icons-material"
import VistaPrevia from "../../../components/common/VistaPrevia"
import { uploadFile } from "../../../utils/FileUploadService"

/**
 * Cambios clave:
 * - Corrige el uso de selectedFile.fileName por selectedFile.name.
 * - Mejora la reactividad del selector de carpeta.
 * - Añade visualización del archivo subido tras upload.
 */

export default function UploadDialog({
  open,
  onClose,
  onUploadComplete,
  folders = [],
  currentFolder,
  onFolderChange = null,
  onCreateFolder = () => {},
  multiple = false,
}) {
  // Resetear estado cuando se abre el modal
  useEffect(() => {
    if (open) {
      setFileName("");
      setFileDescription("");
      setSelectedFiles([]);
      setLastUploadedFiles([]);
      setSuccessMsg("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, folders]);

  const [fileName, setFileName] = useState("")
  const [fileDescription, setFileDescription] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false)
  // Estado para mostrar la última subida
  const [lastUploadedFiles, setLastUploadedFiles] = useState([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Mantener referencia de la carpeta seleccionada al momento del upload
  const folderRef = useRef(currentFolder);
  useEffect(() => { folderRef.current = currentFolder }, [currentFolder]);

  const BLOCKED_EXTENSIONS = ['.exe', '.sh', '.bat', '.cmd', '.scr', '.js', '.msi', '.vbs', '.php', '.py'];
  const MAX_SIZE_MB = 400;
  const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    
    // Filtrar archivos no permitidos
    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return !BLOCKED_EXTENSIONS.includes(ext) && file.size <= MAX_SIZE_BYTES;
    });

    // Mostrar alertas para archivos rechazados
    files.forEach(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        setSnackbar({
          open: true,
          message: `Archivo ${file.name} rechazado: extensión ${ext} no permitida`,
          severity: 'error'
        });
      } else if (file.size > MAX_SIZE_BYTES) {
        setSnackbar({
          open: true,
          message: `Archivo ${file.name} rechazado: supera el límite de ${MAX_SIZE_MB}MB`,
          severity: 'error'
        });
      }
    });

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      if (!fileName && validFiles.length === 1) setFileName(validFiles[0].name);
    }
  }

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    if (currentFolder === 'logos') {
      const invalidFiles = selectedFiles.filter(file => !file.type.startsWith('image/'));
      if (invalidFiles.length > 0) {
        setSnackbar({
          open: true,
          message: `La carpeta Logos solo acepta imágenes. ${invalidFiles.length} archivo(s) no son imágenes`,
          severity: 'error'
        });
        return;
      }
    }

    setUploading(true);
    setSuccessMsg("");
    
    try {
      const uploadResults = [];
      
      for (const file of selectedFiles) {
        const metadata = {
          fileName: fileName || file.name,
          fileDescription,
          folder: folderRef.current,
        };
        
        // Usar ruta que incluya información del tenant
        const response = await uploadFile(file, `admin/folders/${folderRef.current}`, metadata);
        
        const uploadedData = {
          fileName: fileName || file.name,
          fileDescription,
          fileType: file.type,
          fileId: response.fileId || Date.now().toString(),
          fileURL: response.fileURL || response.url,
          size: file.size,
        };
        
        uploadResults.push({
          ...uploadedData,
          folder: folderRef.current,
        });
      }
      
      onUploadComplete?.(uploadResults);
      setLastUploadedFiles(uploadResults);
      setSuccessMsg(`${selectedFiles.length} archivo${selectedFiles.length !== 1 ? 's' : ''} subido${selectedFiles.length !== 1 ? 's' : ''} exitosamente`);
      setFileName("");
      setFileDescription("");
      setSelectedFiles([]);
    } catch (error) {
      console.error("Error al subir:", error);
      alert(error.message);
    } finally {
      setUploading(false);
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setFileName("")
      setFileDescription("")
      setSelectedFiles([])
      setLastUploadedFiles([])
      setSuccessMsg("")
      onClose()
    }
  }

  // Siempre incluir 'Mis archivos' y 'Logos'
  const baseFolders = [
    { id: "general", folderTitle: "Mis archivos" },
    { id: "logos", folderTitle: "Logos" }
  ];
  const mergedFolders = [
    ...baseFolders,
    ...folders.filter(f => !["general", "logos"].includes(f.id))
  ];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Subir archivo{multiple ? 's' : ''} a: {mergedFolders.find(f => f.id === currentFolder)?.folderTitle || currentFolder}
      </DialogTitle>
      {uploading && <LinearProgress />}
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <TextField
            label="Nombre del archivo"
            fullWidth
            margin="normal"
            variant="outlined"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            disabled={uploading}
            error={!fileName?.trim()}
            helperText={!fileName?.trim() ? "El nombre es requerido" : ""}
          />

          <TextField
            label="Descripción"
            fullWidth
            margin="normal"
            variant="outlined"
            multiline
            rows={3}
            value={fileDescription}
            onChange={(e) => setFileDescription(e.target.value)}
            disabled={uploading}
          />

          <Box sx={{ display: "flex", alignItems: "center", mt: 2 }}>
            <FormControl fullWidth sx={{ mr: 1 }}>
              <InputLabel>Carpeta</InputLabel>
              <Select
                value={currentFolder}
                onChange={(e) => onFolderChange?.(e.target.value)}
                disabled={!onFolderChange}
                sx={{ 
                  backgroundColor: 'action.selected',
                  '& .MuiSelect-select': { fontWeight: 'bold' }
                }}
              >
                {mergedFolders.map((folder) => (
                  <MenuItem key={folder.id} value={folder.id}>
                    {folder.folderTitle || folder.folderName || folder.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ mt: 2, mb: 2 }}>
            <Button
              variant="contained"
              component="label"
              fullWidth
              startIcon={<CloudUpload />}
              sx={{ py: 1.5 }}
              disabled={uploading}
            >
              {selectedFiles.length > 0 ? `SELECCIONAR ${selectedFiles.length} ARCHIVOS` : "SELECCIONAR ARCHIVO"}
              <input type="file" hidden multiple={multiple} onChange={handleFileChange} disabled={uploading} />
            </Button>
          </Box>

          {selectedFiles.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Archivos seleccionados:</Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
                {selectedFiles.map((file, index) => (
                  <Box key={index} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 1,
                    '&:hover': { backgroundColor: 'action.hover' } 
                  }}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleRemoveFile(index)}
                      sx={{ mr: 1 }}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                    <VistaPrevia
                      url={URL.createObjectURL(file)}
                      fileType={file.type}
                      titulo={file.name}
                      width={80}
                      height={60}
                    />
                    <Typography variant="body2" sx={{ ml: 1, flex: 1 }}>{file.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(file.size / 1024).toFixed(1)} KB
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Total: {selectedFiles.length} archivo(s) - 
                {(selectedFiles.reduce((acc, file) => acc + file.size, 0) / (1024 * 1024)).toFixed(2)} MB
              </Typography>
            </Box>
          )}

          {lastUploadedFiles.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success" sx={{ mb: 1 }}>{successMsg || "Archivo subido exitosamente"}</Alert>
              <Box sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
                {lastUploadedFiles.map((file, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <VistaPrevia
                      url={file.fileURL}
                      fileType={file.fileType}
                      titulo={file.fileName}
                      width={80}
                      height={60}
                    />
                    <Typography variant="body2" sx={{ ml: 1 }}>{file.fileName}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Destino de subida:</Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 0.5 }}>
              {mergedFolders.find(f => f.id === currentFolder)?.folderTitle || 
               mergedFolders.find(f => f.id === currentFolder)?.folderName || 
               currentFolder}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleUpload} disabled={selectedFiles.length === 0 || uploading}>
          {uploading ? "Subiendo..." : "Subir"}
        </Button>
      </DialogActions>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Dialog>
  )
}
