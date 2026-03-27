//component/administrador/dialogs/ExampleUploader.jsx
import { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  CircularProgress
} from "@mui/material";
import {
  UploadFile as UploadFileIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon
} from "@mui/icons-material";
import { uploadFile } from "../../../../utils/FileUploadService";

export default function ExampleUploader({
  exampleImage,
  setExampleImage,
  setExampleComment,
  setEntityType,
  exampleComment,
  setExpirationDate,
  setNewDocName,
  setSelectFromAdminStoreOpen
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [fileType, setFileType] = useState(''); // Estado interno
  const [uploading, setUploading] = useState(false); // Nuevo estado para spinner
  const open = Boolean(anchorEl);

  const handleFileUpload = async (file) => {
    setUploading(true);
    try {
      console.log('[ExampleUploader] Iniciando subida de archivo:', file.name);
      
      const type = file.type.startsWith("image/") ? "image" : 
                  file.type === "application/pdf" ? "pdf" : "other";
      setFileType(type);
      
      console.log('[ExampleUploader] Llamando a uploadFile...');
      const result = await uploadFile(file, "admin/document_examples");
      
      console.log('[ExampleUploader] Subida exitosa. URL:', result.fileURL);
      setExampleImage(result.fileURL);
    } catch (error) {
      console.error("[ExampleUploader] Error al subir archivo:", error);
      alert(`Error al subir el archivo de ejemplo: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box id="adm-required-docs-example-uploader">
      <Button
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<UploadFileIcon />}
        disabled={uploading}
        sx={{
          borderColor: "var(--divider-color)",
          color: "var(--paper-background-text)",
          "&:hover": {
            borderColor: "var(--primary-main)",
            backgroundColor: "var(--primary-main)",
            color: "var(--primary-text)"
          },
          "&:disabled": {
            borderColor: "var(--divider-color)",
            color: "var(--paper-background-text)",
            opacity: 0.5
          }
        }}
      >
        {uploading ? <CircularProgress size={20} color="inherit" /> : 'Seleccionar Ejemplo'}
      </Button>
      
      {exampleImage && (
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => window.open(exampleImage, '_blank')}
          startIcon={<DescriptionIcon />}
          sx={{ 
            mt: 2,
            borderColor: "var(--divider-color)",
            color: "var(--paper-background-text)",
            "&:hover": {
              borderColor: "var(--primary-main)",
              backgroundColor: "var(--primary-main)",
              color: "var(--primary-text)"
            },
            "&:disabled": {
              borderColor: "rgba(0, 0, 0, 0.12)",
              color: "rgba(0, 0, 0, 0.26)"
            }
          }}
          disabled={uploading}
        >
          Ver documento de ejemplo
        </Button>
      )}

      <Menu 
        anchorEl={anchorEl} 
        open={open} 
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            backgroundColor: "var(--paper-background)",
            "& .MuiMenuItem-root": {
              color: "var(--paper-background-text)",
              "&:hover": {
                backgroundColor: "var(--primary-main)",
                color: "var(--primary-text)"
              },
              "&.Mui-disabled": {
                color: "rgba(0, 0, 0, 0.26)"
              }
            }
          }
        }}
      >
        <MenuItem
          onClick={() => {
            document.getElementById("fileUploadInput").click();
            setAnchorEl(null);
          }}
          disabled={uploading}
        >
          <ListItemIcon>
            {uploading ? <CircularProgress size={20} /> : <UploadFileIcon fontSize="small" sx={{ color: "inherit" }} />}
          </ListItemIcon>
          <ListItemText>Desde mi computadora</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setSelectFromAdminStoreOpen(true);
            setAnchorEl(null);
          }}
          disabled={uploading}
        >
          <ListItemIcon><FolderIcon fontSize="small" sx={{ color: "inherit" }} /></ListItemIcon>
          <ListItemText>Desde almacenamiento</ListItemText>
        </MenuItem>
      </Menu>

      <input
        id="fileUploadInput"
        type="file"
        hidden
        accept="application/pdf,image/*"
        onChange={(e) => {
          const f = e.target.files[0];
          if (f) handleFileUpload(f);
        }}
      />
    </Box>
  );
}
