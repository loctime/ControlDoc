import React from 'react';
import {
  Box,
  Typography,
  Button
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';

export default function BatchApprovalPanel({
  selectedDateForPage,
  numPages,
  isProcessingBatch,
  processingProgress,
  onBatchApprove
}) {
  if (Object.keys(selectedDateForPage).length === 0) return null;

  return (
    <Box sx={{ 
      mt: 3, 
      p: 2, 
      backgroundColor: '#f8f9fa', 
      borderRadius: 2,
      border: '1px solid #e0e0e0'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" color="primary">
          📋 Aprobación Masiva
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {Object.keys(selectedDateForPage).length} de {numPages} páginas con fecha seleccionada
        </Typography>
      </Box>
      
      {isProcessingBatch && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="primary">
            Procesando {processingProgress.current} de {processingProgress.total} páginas...
          </Typography>
        </Box>
      )}
      
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="success"
          startIcon={<CheckCircle />}
          onClick={onBatchApprove}
          disabled={Object.keys(selectedDateForPage).length === 0 || isProcessingBatch}
          size="large"
          sx={{ 
            px: 3,
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          {isProcessingBatch ? 'Procesando...' : 'Aprobar Todo'}
        </Button>
      </Box>
    </Box>
  );
}
