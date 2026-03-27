import React from 'react';
import { 
  Box, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Button,
  Typography,
  CircularProgress
} from '@mui/material';
import MultiDownloadZipButton from '../../../components/MultiDownloadZipButton';
import { getLogicalGroupKey, getFileExtension } from '../utils/documentUtils';

/**
 * Componente para filtros y controles de descarga de documentos
 */
export default function DocumentFilters({
  // Filtros
  entityTypeFilter,
  setEntityTypeFilter,
  entityNameFilter,
  setEntityNameFilter,
  entityNames,
  openDateModal,
  setOpenDateModal,
  dateRange,
  setDateRange,
  
  // Documentos y selección
  filteredAndSortedDocs,
  selectedFiles,
  selectedDocs,
  docsSinBackupGeneral,
  docsSinSmartBackupFiltrados,
  
  // Estados de carga
  loadingBackup,
  loadingSmartBackup,
  
  // Pestaña actual
  currentTab,
  
  // Handlers
  handleGenerateSmartBackup
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
      {/* Filtro por tipo */}
      <FormControl sx={{ minWidth: 200 }} size="small">
        <InputLabel id="entity-type-select-label">Filtrar por tipo</InputLabel>
        <Select
          labelId="entity-type-select-label"
          value={entityTypeFilter}
          label="Filtrar por tipo"
          onChange={(e) => {
            setEntityTypeFilter(e.target.value);
            setEntityNameFilter('todos');
          }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="company">Empresa</MenuItem>
          <MenuItem value="employee">Personal</MenuItem>
          <MenuItem value="vehicle">Vehículo</MenuItem>
        </Select>
      </FormControl>

      {/* Filtro por nombre solo si es personal o vehículo */}
      {(entityTypeFilter === 'employee' || entityTypeFilter === 'vehicle') && (
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel id="entity-name-select-label">Filtrar por nombre</InputLabel>
          <Select
            labelId="entity-name-select-label"
            value={entityNameFilter}
            label="Filtrar por nombre"
            onChange={(e) => setEntityNameFilter(e.target.value)}
          >
            <MenuItem value="todos">Todos</MenuItem>
            {entityNames.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* Botón para abrir el modal de fechas */}
      <Button 
        variant="outlined" 
        onClick={() => setOpenDateModal(true)}
        sx={{ height: 40 }}
      >
        Buscar por fecha
      </Button>

      {/* Botón Descargar todo para pestaña Últimos */}
      {currentTab === 0 && filteredAndSortedDocs.length > 0 && (
        <MultiDownloadZipButton
          files={filteredAndSortedDocs.map((doc) => ({
            id: doc.id,
            url: doc.fileURL,
            fileType: doc.fileType,
            filename: (doc.fileName || doc.nombreOriginal || doc.name) || (getLogicalGroupKey(doc) + getFileExtension(doc.fileName || doc.nombreOriginal || doc.name)),
            name: doc.name || doc.documentName || doc.nombreOriginal,
            entityName: doc.entityName,
            entityType: doc.entityType === 'vehicle' ? 'VEHICULO' : doc.entityType === 'employee' ? 'EMPLEADO' : 'EMPRESA',
            companyName: doc.companyName,
            version: doc.version
          }))}
          zipName="ultimos_documentos.zip"
          label={`Descargar todo (${filteredAndSortedDocs.length})`}
          disabled={false}
          createBackup={false}
        />
      )}

      {/* Mostrar rango seleccionado si existe */}
      {(dateRange.start || dateRange.end) && (
        <Button 
          variant="outlined" 
          onClick={() => setDateRange({ start: null, end: null })}
          size="small"
          sx={{ height: 40 }}
        >
          Limpiar fechas
        </Button>
      )}
      
      {/* --- SMART BACKUP: Solo en pestaña Histórico --- */}
      {currentTab === 1 && (
        <>
          {/* Información sobre Smart Backup */}
          {docsSinSmartBackupFiltrados.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography color="info.main" variant="body2">
                {docsSinSmartBackupFiltrados.length === 1
                  ? '1 doc. filtrado'
                  : `${docsSinSmartBackupFiltrados.length} documentos`}
              </Typography>
            </Box>
          )}
          
          {/* Botón Smart Backup */}
          <Button
            variant="contained"
            color="secondary"
            size="small"
            onClick={handleGenerateSmartBackup}
            disabled={docsSinSmartBackupFiltrados.length === 0 || loadingSmartBackup}
            sx={{ minWidth: 120 }}
          >
            {loadingSmartBackup ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              `Smart Backup (${docsSinSmartBackupFiltrados.length})`
            )}
          </Button>
        </>
      )}
    </Box>
  );
}
