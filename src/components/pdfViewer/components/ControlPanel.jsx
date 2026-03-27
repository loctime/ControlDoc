import React from 'react';
import { Box, Button, Typography, Tooltip } from '@mui/material';
import { CalendarToday, CheckCircle, Cancel, Download, ViewModule, PlayArrow } from '@mui/icons-material';

export default function ControlPanel({
  page,
  numPages,
  onPageChange,
  selectedDate,
  onApprove,
  onReject,
  onSetInProcess,
  onDownload,
  documentId,
  fileURL,
  onShowAllPages
}) {
  return (
    <>
      {/* Panel de control unificado - todo en una fila */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1.5,
        mb: 1.5,
        p: 1.5,
        backgroundColor: '#f8f9fa',
        border: '1px solid #e0e0e0',
        borderRadius: 1
      }}>
        {/* Navegación */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button 
            onClick={() => onPageChange(Math.max(1, page - 1))} 
            disabled={page <= 1}
            size="small"
            sx={{ textTransform: 'none', fontSize: '0.75rem', minWidth: 'auto', px: 1 }}
          >
            Anterior
          </Button>
          <Button 
            onClick={() => onPageChange(Math.min(numPages, page + 1))} 
            disabled={page >= numPages}
            size="small"
            sx={{ textTransform: 'none', fontSize: '0.75rem', minWidth: 'auto', px: 1 }}
          >
            Siguiente
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            Página {page} de {numPages}
          </Typography>
        </Box>

        {/* Fecha de vencimiento */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CalendarToday color="primary" sx={{ fontSize: '1rem' }} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1, fontSize: '0.7rem' }}>
              Fecha de vencimiento:
            </Typography>
            <Typography variant="caption" color={selectedDate ? 'primary.main' : 'text.disabled'} sx={{ fontWeight: 'bold', lineHeight: 1, fontSize: '0.7rem' }}>
              {selectedDate || 'No seleccionada'}
            </Typography>
          </Box>
        </Box>

        {/* Botones de acción */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {onShowAllPages && (
            <Tooltip title="Ver todas las páginas">
              <Button
                variant="outlined"
                startIcon={<ViewModule />}
                onClick={() => onShowAllPages()}
                size="small"
                sx={{ minWidth: 'auto', fontSize: '0.7rem', px: 1 }}
              >
                Aprobar por separado
              </Button>
            </Tooltip>
          )}

          <Tooltip title="Descargar documento">
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => onDownload && onDownload(fileURL)}
              size="small"
              sx={{ minWidth: 'auto', fontSize: '0.7rem', px: 1 }}
            >
              Descargar
            </Button>
          </Tooltip>

          {selectedDate ? (
            <Tooltip title="Aprobar documento">
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={() => onApprove && onApprove(documentId, selectedDate)}
                size="small"
                sx={{ minWidth: 'auto', fontSize: '0.7rem', px: 1 }}
              >
                Aprobar
              </Button>
            </Tooltip>
          ) : (
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              disabled
              size="small"
              sx={{ minWidth: 'auto', fontSize: '0.7rem', px: 1 }}
            >
              Aprobar
            </Button>
          )}

          <Tooltip title="Rechazar documento">
            <Button
              variant="contained"
              color="error"
              startIcon={<Cancel />}
              onClick={() => onReject && onReject(documentId)}
              size="small"
              sx={{ minWidth: 'auto', fontSize: '0.7rem', px: 1 }}
            >
              Rechazar
            </Button>
          </Tooltip>

          {onSetInProcess && (
            <Tooltip title="Poner documento en proceso">
              <Button
                variant="outlined"
                color="info"
                startIcon={<PlayArrow />}
                onClick={() => onSetInProcess && onSetInProcess(documentId)}
                size="small"
                sx={{ minWidth: 'auto', fontSize: '0.7rem', px: 1 }}
              >
                En proceso
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Mensaje informativo */}
      {selectedDate && (
        <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#e8f5e8', borderRadius: 1, border: '1px solid #4caf50' }}>
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold' }}>
            ✅ Documento será aprobado con fecha de vencimiento: {selectedDate}
          </Typography>
        </Box>
      )}

      {!selectedDate && (
        <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#fff3e0', borderRadius: 1, border: '1px solid #ff9800' }}>
          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold' }}>
            ⚠️ Selecciona una fecha haciendo click en el PDF para habilitar la aprobación
          </Typography>
        </Box>
      )}
    </>
  );
}
