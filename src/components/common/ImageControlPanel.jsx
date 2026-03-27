import React from 'react';
import { Box, Button, Typography, Tooltip } from '@mui/material';
import { CalendarToday, CheckCircle, Cancel, Download, PlayArrow } from '@mui/icons-material';

export default function ImageControlPanel({
  selectedDate,
  onApprove,
  onReject,
  onSetInProcess,
  onDownload,
  documentId,
  fileURL
}) {
  return (
    <>
      {/* Panel de control para imágenes - todo en una fila */}
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
        {/* Información del documento */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {selectedDate && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Fecha seleccionada: {selectedDate}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Botones de acción */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Aprobar documento">
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<CheckCircle />}
              onClick={() => onApprove(documentId, selectedDate)}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              Aprobar
            </Button>
          </Tooltip>

          <Tooltip title="Rechazar documento">
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<Cancel />}
              onClick={() => onReject(documentId)}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              Rechazar
            </Button>
          </Tooltip>

          {onSetInProcess && (
            <Tooltip title="Marcar como en proceso">
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<PlayArrow />}
                onClick={() => onSetInProcess(documentId)}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                En Proceso
              </Button>
            </Tooltip>
          )}

          <Tooltip title="Descargar archivo">
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              onClick={() => onDownload(fileURL)}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              Descargar
            </Button>
          </Tooltip>
        </Box>
      </Box>
    </>
  );
}
