import { useState } from 'react';
import { Button, CircularProgress, Typography, Box, TextField } from "@mui/material";
import { uploadFile } from "../../utils/FileUploadService";

export default function FileUploader({ 
  onUploadComplete, 
  folder,
  allowedTypes = ["*/*"],
  isAdmin = false,
  metadata = null
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [fileMetadata, setFileMetadata] = useState({ name: '', description: '' });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    
    if (!file) {
      setError("Seleccione un archivo válido");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      
      const result = await uploadFile(file, folder, { 
        metadata: { 
          ...fileMetadata,
          fileType: file.type,
          ...metadata 
        } 
      });
      
      onUploadComplete({
        ...result,
        fileName: fileMetadata.name || file.name,
        fileDescription: fileMetadata.description,
        fileType: file.type
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleMetadataChange = (e) => {
    const { name, value } = e.target;
    setFileMetadata(prev => ({ ...prev, [name]: value }));
  };

  const validateFile = async (file) => {
    try {
      if (!file || !(file instanceof File)) {
        console.error('[DEBUG] Archivo inválido:', file);
        throw new Error('Archivo no válido');
      }

      console.log('[DEBUG] FileUploader - Archivo a subir:', file.name, 'size:', file.size);
    } catch (error) {
      console.error('[DEBUG] FileUploader - Error en validación:', error);
      throw error;
    }
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        label="Nombre del archivo"
        name="name"
        value={fileMetadata.name}
        onChange={handleMetadataChange}
        fullWidth
        size="small"
      />
      <TextField
        label="Descripción"
        name="description"
        value={fileMetadata.description}
        onChange={handleMetadataChange}
        fullWidth
        size="small"
        multiline
        rows={2}
      />
      <Button 
        variant="contained" 
        component="label"
        disabled={isUploading}
      >
        {isUploading ? 'Subiendo...' : 'Seleccionar Archivo'}
        <input 
          type="file" 
          hidden 
          accept={allowedTypes.join(',')}
          onChange={handleUpload} 
        />
      </Button>
      
      {error && (
        <Typography color="error" variant="body2" mt={1}>
          {error}
        </Typography>
      )}
      
      {isUploading && <CircularProgress size={24} sx={{ ml: 2 }} />}
    </Box>
  );
}