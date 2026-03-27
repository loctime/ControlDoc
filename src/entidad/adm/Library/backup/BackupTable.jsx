//adm/library/backup/backuptable.jsx
"use client"

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Checkbox,
  TableSortLabel,
  Box,
  Typography,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material"
import { Visibility, Archive, CloudUpload, MoreVert } from "@mui/icons-material"
import DownloadButton from "../../../../components/common/DownloadButton"

const formatSize = (size) => {
  if (!size && size !== 0) return "N/A"
  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(2)} KB`
  }
  return `${size} bytes`
}

const BackupTable = ({
  backups = [],
  selectedCompany,
  selectedFiles = [],
  toggleFileSelection = () => {},
  selectAllFiles = () => {},
  onViewDetails = () => {},
  formatDate = (date) => {
    if (!date) return 'Sin fecha';
    if (typeof date === 'string') date = new Date(date);
    if (date instanceof Date && !isNaN(date)) {
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
    return 'Sin fecha';
  },
  sortBy = "createdAt",
  sortDirection = "desc",
  setSortBy = () => {},
  setSortDirection = () => {},
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const rows = useMemo(
    () =>
      backups.map((backup) => ({
        ...backup,
        isSelected: (selectedFiles || []).includes(backup.id),
      })),
    [backups, selectedFiles],
  )

  const truncateText = (text) => {
    if (!text) return "N/A"
    return text.length > 20 ? `${text.substring(0, 20)}...` : text
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completado":
        return "success"
      case "procesando":
        return "warning"
      case "error":
        return "error"
      default:
        return "default"
    }
  }

  const handleMenuOpen = (event, backup) => {
    setAnchorEl(event.currentTarget);
    setSelectedBackup(backup);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedBackup(null);
  };

  const handleSaveTo = (destination) => {
    console.log(`Guardando backup ${selectedBackup?.name} en ${destination}`);
    // Aquí implementarías la lógica para guardar en cada destino
    handleMenuClose();
  };

  return (
    <Paper elevation={1} sx={{ borderRadius: 2, overflow: "hidden" }}>
      <TableContainer>
        <Table size="small" sx={{ minWidth: 750 }}>
          <TableHead>
            <TableRow sx={{ height: 32 }}>
              <TableCell>
                Nombre / Tipo
              </TableCell>
              <TableCell>
                Empresas / Documentos
              </TableCell>
              <TableCell>
                Fecha de subida
              </TableCell>
              <TableCell>
                Subido por
              </TableCell>
              <TableCell align="center">
                Acciones
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((backup) => (
              <TableRow key={backup.id} hover sx={{ height: 36 }}>
                <TableCell>
                  <Typography variant="caption" fontWeight="medium" noWrap>
                    {backup.name || backup.fileName || 'Sin nombre'}
                  </Typography>
                  {backup.backupType && (
                    <Chip 
                      label={backup.backupType === 'smart_backup' ? 'Smart' : backup.backupType === 'monthly' ? 'Mensual' : 'Histórico'} 
                      size="small" 
                      sx={{ mt: 0.5, fontSize: '0.7rem', height: '18px' }}
                      color={backup.backupType === 'smart_backup' ? 'primary' : backup.backupType === 'monthly' ? 'secondary' : 'default'}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" noWrap>
                    {backup.companiesCount > 0 ? `${backup.companiesCount} empresa${backup.companiesCount > 1 ? 's' : ''}` : 'N/A'}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {backup.fileCount > 0 ? `${backup.fileCount} doc.` : '0 doc.'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" noWrap>
                    {formatDate(backup.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" noWrap>
                    {backup.createdBy || 'Desconocido'}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Tooltip title="Descargar backup">
                      <span>
                        <IconButton
                          component="a"
                          href={backup.fileURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small"
                          disabled={!backup.fileURL}
                        >
                          <Archive fontSize="small" color="primary" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    
                    <Tooltip title="Guardar en">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, backup)}
                        disabled={!backup.fileURL}
                      >
                        <CloudUpload fontSize="small" color="secondary" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {backups.length === 0 && (
        <Box sx={{ p: 2, textAlign: "center" }}>
          <Typography variant="body2">No se encontraron backups</Typography>
        </Box>
      )}

      {/* Menu de opciones para guardar */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleSaveTo('ControlFile')}>
          <ListItemIcon>
            <Archive fontSize="small" />
          </ListItemIcon>
          <ListItemText>ControlFile</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSaveTo('Google Drive')}>
          <ListItemIcon>
            <CloudUpload fontSize="small" />
          </ListItemIcon>
          <ListItemText>Google Drive</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSaveTo('Dropbox')}>
          <ListItemIcon>
            <CloudUpload fontSize="small" />
          </ListItemIcon>
          <ListItemText>Dropbox</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  )
}

export default BackupTable
