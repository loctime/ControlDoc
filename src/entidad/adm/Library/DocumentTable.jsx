import React, { useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Tooltip, Checkbox, Chip, TableSortLabel, Box, Typography, IconButton
} from '@mui/material';
import { Visibility, PictureAsPdf } from '@mui/icons-material';
import { useDocumentEntityTypes } from '../../../utils/useDocumentEntityTypes';
import { useClientNamesMap } from '../../../utils/getClientName';

import DownloadButton from '../../../components/common/DownloadButton';
import { useFileUrl } from '../../../hooks/useFileUrl';

function DocRowActions({ doc, onViewDetails, onIHatePdf }) {
  const resolvedUrl = useFileUrl({ fileId: doc.fileId, fileURL: doc.fileURL });
  return (
    <>
      <Tooltip title="Ver detalles">
        <IconButton onClick={() => onViewDetails(doc.id)} size="small">
          <Visibility fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Descargar">
        <DownloadButton
          url={resolvedUrl}
          currentDocument={doc}
          size="small"
          iconOnly
          disabled={!resolvedUrl}
        />
      </Tooltip>
      <Tooltip title="iHatePDF - Herramientas PDF">
        <IconButton
          onClick={() => onIHatePdf(doc)}
          size="small"
          disabled={!resolvedUrl}
          sx={{ color: 'error.main' }}
        >
          <PictureAsPdf fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  );
}

// Props de selección múltiple: selectedFiles, toggleFileSelection, selectAllFiles
// Permiten integración con MultiDownloadZipButton para descarga masiva
const formatSize = (size) => {
  if (!size && size !== 0) return 'N/A';
  if (size >= 1024 * 1024) {
    return `${Math.floor(size / (1024 * 1024))} mb`;
  }
  return `${Math.floor(size / 1024)} kb`;
};


const DocumentTable = ({
  documents = [],
  selectedCompany,
  selectedFiles = [], // array de ids seleccionados
  toggleFileSelection = () => {}, // función para alternar selección individual
  selectAllFiles = () => {}, // función para seleccionar/deseleccionar todos
  onViewDetails = () => {},
  onIHatePdf = () => {},
  handleDownload,
  formatFileSize = (size) => size,
  formatDate = (date) => {
    if (!date) return 'Sin fecha';
    if (typeof date === 'string') date = new Date(date);
    if (date instanceof Date && !isNaN(date)) {
      return date.toLocaleDateString('es-ES', {
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
  getFileIcon = () => <></>,
  sortBy = 'date',
  sortDirection = 'desc',
  setSortBy = () => {},
  setSortDirection = () => {},
  viewMode
}) => {
  const { entityTypes } = useDocumentEntityTypes();
  // Mapeo para obtener el label del entityType
  const entityTypeLabels = useMemo(
    () => Object.fromEntries(entityTypes.map(t => [t.value, t.label])),
    [entityTypes]
  );

  // Extraer clientIds únicos de los documentos
  const clientIds = useMemo(() => {
    const ids = documents.map(doc => doc.clientId).filter(Boolean);
    return [...new Set(ids)];
  }, [documents]);

  // Obtener nombres de clientes
  const { data: clientNamesMap = {}, isLoading: isLoadingClientNames } = useClientNamesMap(clientIds);

  const rows = useMemo(() =>
    documents.map((doc) => ({
      ...doc,
      isSelected: (selectedFiles || []).includes(doc.id)
    })), [documents, selectedFiles]
  );

  const truncateText = (text) => {
    if (!text) return 'N/A';
    return text.length > 15 ? `${text.substring(0, 15)}...` : text;
  };

  if (viewMode !== 'list') return null;

  return (
    <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden', maxWidth: '100%' }}>
      <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 750, tableLayout: 'auto' }}>
          <TableHead>
            <TableRow sx={{ height: 32 }}>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={selectedFiles.length > 0 && selectedFiles.length < documents.length}
                  checked={documents.length > 0 && selectedFiles.length === documents.length}
                  onChange={selectAllFiles}
                />
              </TableCell>
              <TableCell width={28}></TableCell>
              {!selectedCompany && (
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'companyName'}
                    direction={sortDirection}
                    onClick={() => {
                      const isAsc = sortBy === 'companyName' && sortDirection === 'asc';
                      setSortDirection(isAsc ? 'desc' : 'asc');
                      setSortBy('companyName');
                    }}
                  >
                    Empresa
                  </TableSortLabel>
                </TableCell>
              )}
              {!selectedCompany && (
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'clientName'}
                    direction={sortDirection}
                    onClick={() => {
                      const isAsc = sortBy === 'clientName' && sortDirection === 'asc';
                      setSortDirection(isAsc ? 'desc' : 'asc');
                      setSortBy('clientName');
                    }}
                  >
                    Cliente
                  </TableSortLabel>
                </TableCell>
              )}
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'name'}
                  direction={sortDirection}
                  onClick={() => {
                    const isAsc = sortBy === 'name' && sortDirection === 'asc';
                    setSortDirection(isAsc ? 'desc' : 'asc');
                    setSortBy('name');
                  }}
                >
                  Documento
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'category'}
                  direction={sortDirection}
                  onClick={() => {
                    const isAsc = sortBy === 'category' && sortDirection === 'asc';
                    setSortDirection(isAsc ? 'desc' : 'asc');
                    setSortBy('category');
                  }}
                >
                  Categoría
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'entityName'}
                  direction={sortDirection}
                  onClick={() => {
                    const isAsc = sortBy === 'entityName' && sortDirection === 'asc';
                    setSortDirection(isAsc ? 'desc' : 'asc');
                    setSortBy('entityName');
                  }}
                >
                  Entidad
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'size'}
                  direction={sortDirection}
                  onClick={() => {
                    const isAsc = sortBy === 'size' && sortDirection === 'asc';
                    setSortDirection(isAsc ? 'desc' : 'asc');
                    setSortBy('size');
                  }}
                >
                  Tipo/Tamaño
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'date'}
                  direction={sortDirection}
                  onClick={() => {
                    const isAsc = sortBy === 'date' && sortDirection === 'asc';
                    setSortDirection(isAsc ? 'desc' : 'asc');
                    setSortBy('date');
                  }}
                >
                  Fecha
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'subversion'}
                  direction={sortDirection}
                  onClick={() => {
                    const isAsc = sortBy === 'subversion' && sortDirection === 'asc';
                    setSortDirection(isAsc ? 'desc' : 'asc');
                    setSortBy('subversion');
                  }}
                >
                  version
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((doc) => (
              <TableRow key={doc.id} hover sx={{ height: 48 }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={doc.isSelected}
                    onChange={() => toggleFileSelection(doc.id)}
                  />
                </TableCell>

                {/* Icono del archivo */}
                <TableCell>
                  {React.cloneElement(getFileIcon(doc.tipo), { fontSize: 'small' })}
                </TableCell>

                {!selectedCompany && (
                  <TableCell sx={{ maxWidth: 160 }}>
                    <Tooltip title={doc.companyName || 'N/A'}>
                  <Typography variant="body2" noWrap>
                    {truncateText(doc.companyName)}
                  </Typography>
                    </Tooltip>
                  </TableCell>
                )}

                {!selectedCompany && (
                  <TableCell sx={{ maxWidth: 160 }}>
                    <Tooltip title={doc.clientId ? (clientNamesMap[doc.clientId] || 'Cargando...') : 'Empresa Principal'}>
                      <Typography variant="body2" noWrap>
                        {doc.clientId 
                          ? (isLoadingClientNames ? '...' : truncateText(clientNamesMap[doc.clientId] || '-'))
                          : '-'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                )}

                {/* Documento */}
                <TableCell sx={{ maxWidth: 220 }}>
                <Tooltip title={doc.name || doc.documentName || doc.nombreOriginal || 'N/A'}>
                  <Typography variant="body2" noWrap>
                    {truncateText(doc.name || doc.documentName || doc.nombreOriginal)}
                  </Typography>
                </Tooltip>

                </TableCell>

                {/* Categoría */}
                <TableCell>
                  <Typography variant="body2">
                    {entityTypeLabels[doc.entityType] || 'Desconocido'}
                  </Typography>
                </TableCell>

                {/* Entidad */}
                <TableCell>
                  <Tooltip title={doc.entityName || 'N/A'}>
                    <Typography variant="body2" noWrap>
                      {truncateText(doc.entityName)}
                    </Typography>
                  </Tooltip>
                </TableCell>

                {/* Tipo/Tamaño */}
                <TableCell>
                  <Typography variant="body2">
                    {doc.fileType ? doc.fileType.split('/')[1].toUpperCase() : 'N/A'}
                  </Typography>
                  <Typography variant="body2" display="block">
                    {doc.size ? formatSize(doc.size) : 'N/A'}
                  </Typography>
                </TableCell>

                {/* Fecha */}
                <TableCell>
                  <Typography variant="body2">
                    {formatDate(doc.reviewedAt)}
                  </Typography>
                </TableCell>

                {/* Subversion */}
                <TableCell>
                  <Typography variant="body2">
                    {doc.version}
                  </Typography>
                </TableCell>

                {/* Acciones */}
                <TableCell align="center">
                  <DocRowActions doc={doc} onViewDetails={onViewDetails} onIHatePdf={onIHatePdf} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {documents.length === 0 && (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2">No se encontraron documentos</Typography>
        </Box>
      )}
    </Paper>
  );
};

export default React.memo(DocumentTable);
