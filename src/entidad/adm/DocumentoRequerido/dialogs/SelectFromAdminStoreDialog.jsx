import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, CircularProgress, Box, Typography,
  TextField, Select, MenuItem, FormControl, InputLabel,
  List, ListItem, ListItemText, Checkbox, ListItemIcon
} from '@mui/material';
import { db } from '../../../../firebaseconfig';
import { collection, getDocs } from 'firebase/firestore';
import { getTenantCollectionPath } from '../../../../utils/tenantUtils';
import { useQuery } from '@tanstack/react-query';

// Query keys
const adminStoreKeys = {
  all: ['adminStore'],
  folders: () => ['adminStore', 'folders'],
  files: (folder) => ['adminStore', 'files', folder],
};

// Fetch folders
const fetchFolders = async () => {
  const adminFoldersPath = getTenantCollectionPath('adminFolders');
  const foldersSnap = await getDocs(collection(db, adminFoldersPath));
  return foldersSnap.docs.map(doc => doc.id);
};

// Fetch files by folder
const fetchFilesByFolder = async (folder) => {
  const adminFoldersPath = getTenantCollectionPath('adminFolders');
  const filesSnap = await getDocs(collection(db, `${adminFoldersPath}/${folder}/files`));
  return filesSnap.docs.map(d => ({
    id: d.id,
    folder,
    ...d.data()
  }));
};

export default function SelectFromAdminStoreDialog({ open, onClose, onConfirm }) {
  const [currentFolder, setCurrentFolder] = useState('');
  const [selected, setSelected] = useState([]);
  const [expirationDates, setExpirationDates] = useState({});
  const [exampleComments, setExampleComments] = useState({});

  // Usar Query para folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: adminStoreKeys.folders(),
    queryFn: fetchFolders,
    enabled: open,
  });

  // Usar Query para archivos del folder actual
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: adminStoreKeys.files(currentFolder),
    queryFn: () => fetchFilesByFolder(currentFolder),
    enabled: open && !!currentFolder,
  });

  // Agrupar archivos por folder
  const filesByFolder = React.useMemo(() => {
    const grouped = {};
    folders.forEach(folder => {
      grouped[folder] = files.filter(f => f.folder === folder);
    });
    return grouped;
  }, [folders, files]);

  // Setear folder inicial
  React.useEffect(() => {
    if (folders.length > 0 && !currentFolder) {
      setCurrentFolder(folders[0]);
    }
  }, [folders, currentFolder]);

  const loading = foldersLoading || filesLoading;

  const toggleSelect = (fileId) => {
    setSelected(prev => 
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const handleConfirm = () => {
    const selectedDocs = (filesByFolder[currentFolder] || []).filter(f => selected.includes(f.id)).map(f => ({
      ...f,
      expirationDate: expirationDates[f.id] !== undefined && expirationDates[f.id] !== ''
        ? expirationDates[f.id]
        : f.expirationDate,
      exampleComment: exampleComments[f.id] !== undefined && exampleComments[f.id] !== ''
        ? exampleComments[f.id]
        : f.exampleComment
    }))
    
    onConfirm(selectedDocs);
    setSelected([]);
    setExpirationDates({});
    setExampleComments({});
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: "var(--paper-background)",
          color: "var(--paper-background-text)"
        }
      }}
    >
      <DialogTitle sx={{ color: "var(--paper-background-text)" }}>Seleccionar archivos del almacenamiento</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
        ) : (
          <>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: "var(--paper-background-text)" }}>Carpeta</InputLabel>
              <Select
                value={currentFolder}
                label="Carpeta"
                onChange={(e) => setCurrentFolder(e.target.value)}
                sx={{
                  color: "var(--paper-background-text)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--divider-color)"
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--primary-main)"
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--primary-main)"
                  }
                }}
              >
                {folders.map(folder => (
                  <MenuItem key={folder} value={folder}>{folder}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <List>
              {(filesByFolder[currentFolder] || []).map(file => {
                const isSelected = selected.includes(file.id);
                return (
                  <Box key={file.id}>
                    <ListItem
                      onClick={() => toggleSelect(file.id)}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--primary-main)' : 'inherit',
                        color: isSelected ? 'var(--primary-text)' : 'var(--paper-background-text)',
                        '&:hover': { 
                          backgroundColor: isSelected ? 'var(--primary-dark)' : 'var(--primary-main)',
                          color: 'var(--primary-text)'
                        }
                      }}
                    >
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={isSelected}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name || file.id}
                        secondary={file.description || file.url}
                        primaryTypographyProps={{
                          sx: {
                            color: isSelected ? 'var(--primary-text)' : 'var(--paper-background-text)'
                          }
                        }}
                        secondaryTypographyProps={{
                          sx: {
                            color: isSelected ? 'var(--primary-text)' : 'var(--paper-background-text)',
                            opacity: 0.7
                          }
                        }}
                      />
                    </ListItem>
                  </Box>
                );
              })}
            </List>
          </>
        )}
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
          variant="contained" 
          onClick={handleConfirm} 
          disabled={selected.length === 0}
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
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
