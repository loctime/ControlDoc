import { useState } from 'react';
import {
  Box, Button, Divider, Drawer, List, ListItem, ListItemIcon, ListItemText, Typography, IconButton
} from "@mui/material"
import { Add, Home, Folder, Photo, People, DeleteOutline, CreateNewFolder } from "@mui/icons-material"

export default function Sidebar({
  currentFolder,
  setCurrentFolder,
  folders,
  onUploadClick,
  onCreateFolderClick,
  onDeleteFolder,
  normalizedEmail,
  userRole
}) {
  const [deleteMode, setDeleteMode] = useState(false);

  // Carpetas que se manejan de forma especial (ya aparecen arriba)
  const specialFolders = ["logos", "shared", "trash"];

  return (
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'var(--divider-color)',
        backgroundColor: 'var(--paper-background)',
        overflow: 'auto'
      }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ color: "var(--paper-background-text)" }}>Mi Almacenamiento</Typography>
      </Box>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          fullWidth
          onClick={onUploadClick}
          sx={{ mb: 1 }}
        >
          Crear o cargar
        </Button>
        <Button
          variant="outlined"
          startIcon={<CreateNewFolder />}
          fullWidth
          onClick={onCreateFolderClick}
        >
          Nueva carpeta
        </Button>
      </Box>

      {/* Accesos rápidos */}
      <List>
        <ListItem component="button" onClick={() => setCurrentFolder("*")}>
          <ListItemIcon><Home /></ListItemIcon>
          <ListItemText primary="Inicio" />
        </ListItem>
        <ListItem component="button" onClick={() => setCurrentFolder("general")}>
          <ListItemIcon><Folder /></ListItemIcon>
          <ListItemText primary="Mis archivos" />
        </ListItem>
        <ListItem component="button" onClick={() => setCurrentFolder("logos")}>
          <ListItemIcon><Photo /></ListItemIcon>
          <ListItemText primary="Logos" />
        </ListItem>
        <ListItem component="button">
          <ListItemIcon><People /></ListItemIcon>
          <ListItemText primary="Compartido" />
        </ListItem>
        <ListItem component="button">
          <ListItemIcon><DeleteOutline /></ListItemIcon>
          <ListItemText primary="Papelera de reciclaje" />
        </ListItem>
      </List>

      <Divider />

      {/* Carpetas personalizadas */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>Carpetas</Typography>
          <IconButton
            size="small"
            color={deleteMode ? "error" : "default"}
            onClick={() => setDeleteMode(v => !v)}
            title="Modo eliminación"
          >
            <DeleteOutline />
          </IconButton>
        </Box>

        <List dense>
          {folders.map((folder) =>
            folder.id !== "general" && !specialFolders.includes(folder.id) && (
              <ListItem
                key={folder.id}
                onClick={() => setCurrentFolder(folder.id)}
                selected={currentFolder === folder.id}
                secondaryAction={
                  deleteMode && (
                    (folder.visibility === "private" && folder.ownerEmail === normalizedEmail) ||
                    (folder.visibility === "public" && userRole === 'max')
                  ) ? (
                    <IconButton
                      edge="end"
                      sx={{ color: "var(--error-main)", "&:hover": { bgcolor: "var(--error-dark)", color: "#fff" } }}
                      onClick={e => {
                        e.stopPropagation();
                        onDeleteFolder(folder);
                      }}
                      title="Eliminar carpeta"
                    >
                      <DeleteOutline />
                    </IconButton>
                  ) : null
                }
              >
                <ListItemIcon><Folder fontSize="small" /></ListItemIcon>
                <ListItemText primary={folder.folderTitle || folder.folderName || folder.id} />
              </ListItem>
            )
          )}
        </List>
      </Box>
    </Box>
  );
}
