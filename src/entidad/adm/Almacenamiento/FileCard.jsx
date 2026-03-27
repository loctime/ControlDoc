"use client"

import React, { useState } from 'react';
import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material"
import {
  MoreVert,
  Visibility,
  Download,
  Delete,
  Share,
  InsertDriveFile,
  PictureAsPdf,
  Image,
  Description,
} from "@mui/icons-material"

// Constantes para los iconos de archivos
const fileTypeIcons = {
  "application/pdf": <PictureAsPdf color="error" />,
  "image/png": <Image color="primary" />,
  "image/jpeg": <Image color="primary" />,
  "image/jpg": <Image color="primary" />,
  "image/gif": <Image color="primary" />,
  "application/msword": <Description style={{ color: "#2b579a" }} />,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": <Description style={{ color: "#2b579a" }} />,
  "application/vnd.ms-excel": <Description style={{ color: "#217346" }} />,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": <Description style={{ color: "#217346" }} />,
  "application/vnd.ms-powerpoint": <Description style={{ color: "#d24726" }} />,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": <Description style={{ color: "#d24726" }} />,
};

// Función para obtener la extensión del archivo
const getFileExtension = (filename) => {
  if (!filename) return "default"
  const parts = String(filename).split(".")
  return parts.length > 1 ? parts.pop().toLowerCase() : "default"
}

// Función para formatear la fecha
const formatDate = (dateString) => {
  if (!dateString) return "-"
  const date = new Date(dateString)
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

const renderFileIcon = (fileType = "", size = 24) => {
  const icon = fileTypeIcons[fileType] || <InsertDriveFile color="disabled" />;
  return React.cloneElement(icon, { style: { fontSize: size } });
};

export default function FileCard({ file, onPreview, onDelete, onDownload, onShare }) {
  const [anchorEl, setAnchorEl] = useState(null)

  const handleOpenMenu = (event) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
  }

  const handleCloseMenu = () => {
    setAnchorEl(null)
  }

  const handleAction = (action) => {
    handleCloseMenu()
    if (action === "preview") onPreview(file)
    if (action === "delete") onDelete(file)
    if (action === "download") onDownload(file)
    if (action === "share") onShare(file)
  }

  // Renderizar la vista previa en miniatura para imágenes
  const renderThumbnail = () => {
    const [imageError, setImageError] = useState(false);
    const isImage = file.fileType?.startsWith("image/");
    const imageUrl = file.fileURL;
  
    if (isImage && !imageError) {
      return (
        <Box sx={{ height: 140, backgroundColor: '#f5f5f5' }}>
          <CardMedia
            component="img"
            height="140"
            image={imageUrl}
            alt={file.fileName || "imagen"}
            sx={{ objectFit: "cover", width: '100%', height: '100%' }}
            onError={() => setImageError(true)}
          />
        </Box>
      );
    }
  
    // Si falló la carga o no es imagen
    return (
      <Box
        sx={{
          height: 140,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f5f5",
        }}
      >
        {renderFileIcon(file.fileType, 64)}
      </Box>
    );
  };
  

  return (
    <Card>
      <CardActionArea onClick={() => handleAction("preview")}>
        {renderThumbnail()}
        <CardContent sx={{ pt: 1, pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
            {renderFileIcon(file.fileType)}
            <Typography variant="subtitle2" sx={{ ml: 1, wordBreak: "break-word" }} noWrap>
              {file.fileName || "Sin nombre"}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" component="div">
            {formatDate(file.uploadedAt)}
          </Typography>
        </CardContent>
      </CardActionArea>
      <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
        <IconButton size="small" onClick={handleOpenMenu}>
          <MoreVert fontSize="small" />
        </IconButton>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
        <MenuItem onClick={() => handleAction("preview")}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          <ListItemText>Ver</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAction("download")}>
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Descargar</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAction("share")}>
          <ListItemIcon>
            <Share fontSize="small" />
          </ListItemIcon>
          <ListItemText>Compartir</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAction("delete")}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Eliminar</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  )
}
