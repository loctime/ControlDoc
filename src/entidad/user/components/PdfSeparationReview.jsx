// src/entidad/user/components/PdfSeparationReview.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Chip,
  Checkbox,
  FormControlLabel,
  Alert,
  LinearProgress,
  Tooltip,
  IconButton,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';
import VistaPrevia from '../../../components/common/VistaPrevia';
import { useAuth } from '../../../context/AuthContext';

export default function PdfSeparationReview({
  open,
  onClose,
  pdfUrl,
  fileName,
  totalPages,
  separations,
  pageAnalyses,
  onConfirm,
  onCancel
}) {
  const { token } = useAuth();
  const [selectedSeparations, setSelectedSeparations] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  // Inicializar separaciones seleccionadas con todas las sugeridas
  useEffect(() => {
    if (separations && separations.length > 0) {
      setSelectedSeparations(separations.map(s => s.pageNumber));
    }
  }, [separations]);
  
  const handleToggleSeparation = (pageNumber) => {
    setSelectedSeparations(prev => {
      if (prev.includes(pageNumber)) {
        return prev.filter(p => p !== pageNumber);
      } else {
        return [...prev, pageNumber].sort((a, b) => a - b);
      }
    });
  };
  
  const handleAddSeparation = () => {
    // Agregar separación en la mitad del último rango
    if (selectedSeparations.length === 0) {
      const midPage = Math.floor(totalPages / 2);
      setSelectedSeparations([midPage]);
    } else {
      // Encontrar el rango más grande y agregar separación en el medio
      const sorted = [...selectedSeparations].sort((a, b) => a - b);
      let maxRange = 0;
      let maxRangeStart = 1;
      let maxRangeEnd = sorted[0] - 1;
      
      for (let i = 0; i <= sorted.length; i++) {
        const start = i === 0 ? 1 : sorted[i - 1];
        const end = i === sorted.length ? totalPages : sorted[i] - 1;
        const range = end - start + 1;
        
        if (range > maxRange) {
          maxRange = range;
          maxRangeStart = start;
          maxRangeEnd = end;
        }
      }
      
      const newSeparation = Math.floor((maxRangeStart + maxRangeEnd) / 2);
      setSelectedSeparations([...selectedSeparations, newSeparation].sort((a, b) => a - b));
    }
  };
  
  const getDocumentRanges = () => {
    const sorted = [...selectedSeparations].sort((a, b) => a - b);
    const ranges = [];
    let startPage = 1;
    
    for (const sepPage of sorted) {
      if (sepPage > startPage && sepPage <= totalPages) {
        ranges.push({
          start: startPage,
          end: sepPage - 1,
          pageCount: sepPage - startPage
        });
        startPage = sepPage;
      }
    }
    
    // Agregar último documento
    if (startPage <= totalPages) {
      ranges.push({
        start: startPage,
        end: totalPages,
        pageCount: totalPages - startPage + 1
      });
    }
    
    return ranges;
  };
  
  const handleConfirm = async () => {
    if (selectedSeparations.length === 0) {
      setError('Debe seleccionar al menos una separación');
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    try {
      await onConfirm(selectedSeparations.sort((a, b) => a - b));
    } catch (err) {
      setError(err.message || 'Error al separar PDF');
      setProcessing(false);
    }
  };
  
  const documentRanges = getDocumentRanges();
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'var(--paper-background)',
          color: 'var(--paper-background-text)'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h6">
            Revisar Separaciones de PDF
          </Typography>
          <Tooltip title="El sistema ha detectado posibles separaciones de documentos. Revisa y ajusta antes de confirmar.">
            <InfoIcon fontSize="small" sx={{ color: 'var(--primary-main)' }} />
          </Tooltip>
        </Box>
        <Typography variant="subtitle2" sx={{ mt: 1, color: 'var(--paper-background-text-secondary)' }}>
          {fileName} ({totalPages} páginas)
        </Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Separaciones Detectadas ({selectedSeparations.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Marca o desmarca las páginas donde quieres separar el PDF en múltiples documentos.
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {separations && separations.map((sep) => (
              <Paper
                key={sep.pageNumber}
                variant="outlined"
                sx={{
                  p: 1.5,
                  flex: '1 1 200px',
                  minWidth: '200px',
                  backgroundColor: selectedSeparations.includes(sep.pageNumber)
                    ? 'var(--primary-main)'
                    : 'transparent',
                  borderColor: selectedSeparations.includes(sep.pageNumber)
                    ? 'var(--primary-main)'
                    : 'var(--divider-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'var(--primary-main)',
                    backgroundColor: selectedSeparations.includes(sep.pageNumber)
                      ? 'var(--primary-main)'
                      : 'var(--primary-main-opacity)'
                  }
                }}
                onClick={() => handleToggleSeparation(sep.pageNumber)}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedSeparations.includes(sep.pageNumber)}
                      onChange={() => handleToggleSeparation(sep.pageNumber)}
                      sx={{
                        color: selectedSeparations.includes(sep.pageNumber)
                          ? 'var(--primary-text)'
                          : 'var(--paper-background-text)',
                        '&.Mui-checked': {
                          color: 'var(--primary-text)'
                        }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        Página {sep.pageNumber}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Confianza: {Math.round(sep.confidence * 100)}%
                      </Typography>
                      {sep.reasons && sep.reasons.length > 0 && (
                        <Tooltip title={sep.reasons.join(', ')}>
                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                            {sep.reasons[0]}
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>
                  }
                />
              </Paper>
            ))}
          </Box>
          
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddSeparation}
            variant="outlined"
            size="small"
            sx={{ mb: 2 }}
          >
            Agregar Separación Manual
          </Button>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Documentos que se Crearán ({documentRanges.length})
          </Typography>
          {documentRanges.map((range, index) => (
            <Paper
              key={index}
              variant="outlined"
              sx={{
                p: 1.5,
                mb: 1,
                backgroundColor: 'var(--paper-background-secondary)'
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    Documento {index + 1}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Páginas {range.start}-{range.end} ({range.pageCount} página{range.pageCount !== 1 ? 's' : ''})
                  </Typography>
                </Box>
                <Chip
                  label={`${range.pageCount} pág.`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </Paper>
          ))}
        </Box>
        
        {processing && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
              Separando PDF en {documentRanges.length} documentos...
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={onCancel || onClose}
          disabled={processing}
          startIcon={<CancelIcon />}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={processing || selectedSeparations.length === 0}
          variant="contained"
          startIcon={<CheckCircleIcon />}
          sx={{
            backgroundColor: 'var(--primary-main)',
            color: 'var(--primary-text)',
            '&:hover': {
              backgroundColor: 'var(--primary-main-dark)'
            }
          }}
        >
          Confirmar Separación
        </Button>
      </DialogActions>
    </Dialog>
  );
}

