import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  CircularProgress,
  Chip,
  Tooltip,
  Alert,
  Grid,
  FormControlLabel,
  Switch
} from '@mui/material';
import { Close, SelectAll, Clear, GroupWork, ZoomIn, ZoomOut, Warning, CalendarToday } from '@mui/icons-material';
import { isValidDateFormat } from '../utils/dateDetectionUtils.js';
import { usePageManagement } from '../hooks/usePageManagement.js';
import { useGroupManagement } from '../hooks/useGroupManagement.js';
import { useDateManagement } from '../hooks/useDateManagement.js';
import useBatchApproval from '../hooks/useBatchApproval.js';
import { useSimilarityManagement } from '../hooks/useSimilarityManagement.js';
import PageThumbnail from './PageThumbnail.jsx';
import GroupSummary from './GroupSummary.jsx';
import BatchApprovalPanel from './BatchApprovalPanel.jsx';
import GroupDateModal from './GroupDateModal.jsx';

export default function AllPagesModal({ 
  open, 
  onClose, 
  fileURL, 
  numPages,
  onPageSelect,
  onDateSelect,
  // Metadata del documento original
  documentId,
  uploadedAt,
  uploadedByEmail,
  companyComment,
  adminComment,
  companyName,
  entityName,
  status
}) {
  // Hooks personalizados
  const {
    pages,
    loading,
    error,
    selectedPage,
    selectedPageData,
    detectedDates,
    dateRects,
    handlePageClick,
    closePageView
  } = usePageManagement(fileURL, numPages, open);

  const {
    isGroupingMode,
    setIsGroupingMode,
    selectedPages,
    pageGroups,
    togglePageSelection,
    handleSelectAll,
    handleClearSelection,
    handleCreateGroup,
    handleDeleteGroup,
    getPageGroupNumber,
    updateGroupDate,
    createAutoGroup,
    createMultipleAutoGroups,
    showGroupDateModal,
    setShowGroupDateModal,
    pendingGroup,
    handleConfirmGroupDate,
    handleCancelGroupDate
  } = useGroupManagement(numPages);

  const {
    selectedDateForPage,
    setSelectedDateForPage,
    manualDates,
    setManualDates,
    handleDateClick,
    handleApplyManualDate,
    removeDateFromPage
  } = useDateManagement(fileURL, pageGroups, updateGroupDate);

  const {
    isProcessingBatch,
    processingProgress,
    showExpirationModal,
    setShowExpirationModal,
    selectedExpirationDate,
    setSelectedExpirationDate,
    handleBatchApprove,
    handleConfirmBatchApprove,
    calculateItemsToApprove
  } = useBatchApproval();

  const {
    similarPages,
    setSimilarPages,
    pageTemplates,
    setPageTemplates,
    isAnalyzingSimilarity,
    setIsAnalyzingSimilarity,
    analyzePageSimilarity,
    getSimilarPageNumbers,
    createAutoGroups,
    analyzeUserGroupPatterns
  } = useSimilarityManagement(fileURL, pages, open);

  // Estados locales
  const [selectedDate, setSelectedDate] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [manualDateInput, setManualDateInput] = useState('');
  const [itemsToApprove, setItemsToApprove] = useState([]);

  // Función para obtener la fecha más lejana
  const getFurthestDate = () => {
    const allDates = Object.values(selectedDateForPage);
    if (allDates.length === 0) return null;
    
    // Ordenar fechas cronológicamente (formato DD/MM/YY)
    const sortedDates = allDates.sort((a, b) => {
      const [dayA, monthA, yearA] = a.split('/').map(Number);
      const [dayB, monthB, yearB] = b.split('/').map(Number);
      const dateA = new Date(2000 + yearA, monthA - 1, dayA);
      const dateB = new Date(2000 + yearB, monthB - 1, dayB);
      return dateA - dateB;
    });
    
    return sortedDates[sortedDates.length - 1];
  };

  // Función wrapper para eliminar grupos con los parámetros correctos
  const handleDeleteGroupWrapper = (groupId) => {
    handleDeleteGroup(groupId, selectedDateForPage, setSelectedDateForPage);
  };

  // Función wrapper para crear grupos con los parámetros correctos
  const handleCreateGroupWrapper = () => {
    handleCreateGroup(selectedDateForPage, setSelectedDateForPage);
    
    // Después de crear el grupo, analizar patrones y crear grupos automáticos
    setTimeout(() => {
      analyzeUserGroupPatterns(pageGroups, numPages, createMultipleAutoGroups, fileURL);
    }, 100);
  };

  // Función para manejar aprobación masiva
  const handleBatchApproveWrapper = () => {
    const items = handleBatchApprove(selectedDateForPage, pageGroups);
    if (items) {
      setItemsToApprove(items);
    }
  };

  // Función para confirmar aprobación masiva
  const handleConfirmBatchApproveWrapper = async () => {
    await handleConfirmBatchApprove(
      itemsToApprove,
      selectedDateForPage,
      pageGroups,
      documentId,
      fileURL,
      uploadedAt,
      uploadedByEmail,
      companyComment,
      adminComment,
      companyName,
      entityName,
      status,
      onClose,
      onDateSelect
    );
  };

  // Función para manejar click en fecha (wrapper)
  const handleDateClickWrapper = async (date) => {
    await handleDateClick(selectedPage, date, similarPages);
    
    // Automáticamente volver a vista general después de seleccionar
    setTimeout(() => {
      closePageView();
    }, 100);
  };

  // Función para aplicar fecha manual (wrapper)
  const handleApplyManualDateWrapper = () => {
    const success = handleApplyManualDate(selectedPage, manualDateInput);
    if (success) {
      setManualDateInput('');
    }
  };

  // Funciones para manejar zoom
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
  };

  const handleCanvasClick = (e) => {
    if (!selectedPageData?.canvas || dateRects.length === 0) return;

    const img = e.target;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calcular escala entre la imagen mostrada y el canvas original
    const scaleX = selectedPageData.canvas.width / rect.width;
    const scaleY = selectedPageData.canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    for (const dateRect of dateRects) {
      // .Usar las coordenadas extendidas para la detección de clics
      const extendedX1 = Math.max(0, dateRect.x1 - 20);
      const extendedX2 = dateRect.x2 + 20;
      const extendedY1 = dateRect.y1;
      const extendedY2 = dateRect.y2 + Math.max(0, 8 - (dateRect.y2 - dateRect.y1));
      
      if (canvasX >= extendedX1 && canvasX <= extendedX2 && 
          canvasY >= extendedY1 && canvasY <= extendedY2) {
        handleDateClickWrapper(dateRect.date);
        return;
      }
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6" component="div">
          Todas las páginas ({numPages} páginas)
        </Typography>
        <Button
          onClick={onClose}
          startIcon={<Close />}
          size="small"
        >
          Cerrar
        </Button>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Cargando páginas...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && !selectedPage && pages.length > 0 && (
          <>
            {/* Controles de agrupación y similitud */}
            <Box sx={{ mb: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={isGroupingMode} 
                      onChange={() => setIsGroupingMode(prev => !prev)}
                    />
                  }
                  label="Modo agrupación"
                />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    💡 Selecciona la fecha de vencimiento correspondiente por lo menos a una pagina
                  </Typography>
                </Box>
                
                {isGroupingMode && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      onClick={handleSelectAll} 
                      startIcon={<SelectAll />} 
                      size="small" 
                      variant="outlined"
                    >
                      Seleccionar todo
                    </Button>
                    <Button 
                      onClick={handleClearSelection} 
                      startIcon={<Clear />} 
                      size="small" 
                      variant="outlined"
                      disabled={selectedPages.length === 0}
                    >
                      Limpiar
                    </Button>
                    <Button 
                      onClick={handleCreateGroupWrapper} 
                      startIcon={<GroupWork />} 
                      size="small" 
                      variant="contained"
                      disabled={selectedPages.length === 0}
                    >
                      Crear grupo ({selectedPages.length})
                    </Button>
                  </Box>
                )}
              </Box>

              {/* Mostrar grupos existentes */}
              {pageGroups.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Grupos creados ({pageGroups.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {pageGroups.map(group => (
                      <Box
                        key={group.id}
                  sx={{
                    p: 1,
                          border: group.date ? '1px solid var(--success-main)' : '1px solid var(--primary-main)',
                          borderRadius: 1,
                          backgroundColor: group.date ? '#e8f5e8' : 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                          minWidth: '200px'
                        }}
                      >
                        <Typography variant="body2" color={group.date ? "success.dark" : "primary"} sx={{ fontWeight: 'bold' }}>
                          {group.name}: Páginas {group.pages.join(', ')}
                          {group.date && ` (${group.date})`}
                          {group.isPatternBased ? ' 🎯' : group.isAutoGenerated ? ' 🤖' : ''}
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleDeleteGroupWrapper(group.id)}
                        sx={{ minWidth: 'auto', p: 0.5 }}
                      >
                        <Close fontSize="small" />
                      </Button>
                    </Box>
                ))}
                  </Box>
            </Box>
          )}

              {/* Panel de Aprobación Masiva */}
              <BatchApprovalPanel
                selectedDateForPage={selectedDateForPage}
                numPages={numPages}
                isProcessingBatch={isProcessingBatch}
                processingProgress={processingProgress}
                onBatchApprove={handleBatchApproveWrapper}
              />
            </Box>

            <Grid container spacing={2}>
              {pages.map((page) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={page.pageNum}>
                  <PageThumbnail
                    page={page}
                    isGroupingMode={isGroupingMode}
                    selectedPages={selectedPages}
                    selectedDateForPage={selectedDateForPage}
                    manualDates={manualDates}
                    getPageGroupNumber={getPageGroupNumber}
                    getSimilarPageNumbers={getSimilarPageNumbers}
                    onPageClick={handlePageClick}
                    onToggleSelection={togglePageSelection}
                    onRemoveDate={removeDateFromPage}
                  />
                </Grid>
              ))}
            </Grid>

            {/* Resumen de grupos */}
            <GroupSummary 
              pageGroups={pageGroups}
              onDeleteGroup={handleDeleteGroupWrapper}
            />
          </>
        )}

        {/* Vista de página seleccionada con fechas */}
        {selectedPage && selectedPageData && (
          <Box sx={{ textAlign: 'center' }}>
            {/* Controles superiores */}
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Close />}
                onClick={() => {
                  closePageView();
                  setSelectedDate(null);
                  setZoomLevel(1);
                  setManualDateInput('');
                }}
                sx={{ 
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  px: 2,
                  py: 1
                }}
              >
                Volver a vista general
              </Button>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                {/* Campo de fecha manual - siempre visible */}
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1, 
                  alignItems: 'center', 
                  p: 1, 
                  backgroundColor: selectedDateForPage[selectedPage] ? '#e8f5e8' : '#fff3e0', 
                  borderRadius: 1, 
                  border: selectedDateForPage[selectedPage] ? '1px solid #4caf50' : '1px solid #ff9800' 
                }}>
                  {selectedDateForPage[selectedPage] ? (
                    <CalendarToday sx={{ fontSize: '0.8rem', color: '#4caf50' }} />
                  ) : (
                    <Warning sx={{ fontSize: '0.8rem', color: '#ff9800' }} />
                  )}
                  <Typography 
                    variant="caption" 
                    color={selectedDateForPage[selectedPage] ? "success.dark" : "warning.dark"} 
                    sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                  >
                    {selectedDateForPage[selectedPage] ? `Fecha actual: ${selectedDateForPage[selectedPage]}` : 'Sin fecha:'}
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="16/07/25"
                    value={manualDateInput}
                    onChange={(e) => setManualDateInput(e.target.value)}
                    error={manualDateInput.trim() !== '' && !isValidDateFormat(manualDateInput)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleApplyManualDateWrapper();
                      }
                    }}
                    sx={{
                      width: '120px',
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.7rem',
                        height: '28px'
                      }
                    }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={handleApplyManualDateWrapper}
                    disabled={!manualDateInput.trim() || !isValidDateFormat(manualDateInput)}
                    sx={{ 
                      minWidth: 'auto', 
                      p: 0.5, 
                      fontSize: '0.6rem',
                      height: '28px'
                    }}
                  >
                    ✓
                  </Button>
                  {selectedDateForPage[selectedPage] && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        const updatedDates = { ...selectedDateForPage };
                        delete updatedDates[selectedPage];
                        setSelectedDateForPage(updatedDates);
                        setManualDateInput('');
                      }}
                      sx={{ 
                        minWidth: 'auto', 
                        p: 0.5, 
                        fontSize: '0.6rem',
                        height: '28px'
                      }}
                    >
                      ✗
                    </Button>
                  )}
            </Box>

                {/* Controles de Zoom */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                    Zoom: {Math.round(zoomLevel * 100)}%
                  </Typography>
                  <Button
                    size="small"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 0.5}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    <ZoomOut sx={{ fontSize: '1rem' }} />
                  </Button>
                  <Button
                    size="small"
                    onClick={handleZoomReset}
                    sx={{ minWidth: 'auto', p: 0.5, fontSize: '0.7rem' }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="small"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 3}
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    <ZoomIn sx={{ fontSize: '1rem' }} />
                  </Button>
                </Box>
              </Box>
            </Box>
            
            <Box
              component="img"
              src={selectedPageData.dataURL}
              alt={`Página ${selectedPage}`}
              sx={{
                maxWidth: '100%',
                height: 'auto',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 1,
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease-in-out'
              }}
              onClick={handleCanvasClick}
            />
          </Box>
        )}

        {!loading && !error && !selectedPage && pages.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              No se pudieron cargar las páginas
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button
          onClick={onClose}
          variant="outlined"
        >
          Cerrar
        </Button>
      </DialogActions>

      {/* Modal para seleccionar fecha de vencimiento del documento requerido */}
      <Dialog
        open={showExpirationModal}
        onClose={() => setShowExpirationModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          📅 Fecha de Vencimiento del Documento Requerido
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Para completar la aprobación masiva, necesita establecer una fecha de vencimiento 
            para que la empresa vuelva a subir el documento actualizado.
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Opciones disponibles:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Opción 1: Fecha más lejana detectada */}
              {Object.values(selectedDateForPage).length > 0 && (() => {
                const furthestDate = getFurthestDate();
                return (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setSelectedExpirationDate(furthestDate);
                    }}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  >
                    📆 Usar fecha más lejana: {furthestDate}
                  </Button>
                );
              })()}
              
              {/* Opción 2: Fecha manual */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  size="small"
                  label="Fecha manual"
                  placeholder="31/12/2025"
                  value={selectedExpirationDate}
                  onChange={(e) => setSelectedExpirationDate(e.target.value)}
                  error={Boolean(selectedExpirationDate && !isValidDateFormat(selectedExpirationDate))}
                  helperText={selectedExpirationDate && !isValidDateFormat(selectedExpirationDate) ? 'Formato: DD/MM/YYYY' : ''}
                  sx={{ flexGrow: 1 }}
                />
              </Box>
            </Box>
          </Box>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            Esta fecha se establecerá como plazo para que la empresa renueve el documento.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExpirationModal(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmBatchApproveWrapper}
            variant="contained"
            disabled={!selectedExpirationDate || !isValidDateFormat(selectedExpirationDate)}
          >
            Confirmar Aprobación
        </Button>
      </DialogActions>
      </Dialog>

      {/* Modal para seleccionar fecha de grupo */}
      <GroupDateModal
        open={showGroupDateModal}
        onClose={handleCancelGroupDate}
        onConfirm={(selectedDate) => handleConfirmGroupDate(selectedDate, setSelectedDateForPage)}
        groupName={pendingGroup?.name || ''}
        availableDates={pendingGroup?.availableDates || []}
        groupPages={pendingGroup?.pages || []}
      />

    </Dialog>
  );
}
