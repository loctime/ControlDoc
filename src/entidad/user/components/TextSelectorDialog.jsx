// src/entidad/user/components/TextSelectorDialog.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  Alert
} from '@mui/material';

export default function TextSelectorDialog({
  open,
  onClose,
  fileData,
  onSelect
}) {
  const [selectedField, setSelectedField] = useState(null);
  const [selectedText, setSelectedText] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);

  const words = fileData.words || [];
  const detectedFields = fileData.suggestion?.detectedFields || {};

  // Agrupar palabras similares por posición vertical
  const groupedWords = words.reduce((acc, word) => {
    const y = Math.floor(word.bbox.y0 / 50); // Agrupar por línea aproximada
    if (!acc[y]) acc[y] = [];
    acc[y].push(word);
    return acc;
  }, {});

  const handleWordSelect = (word) => {
    if (selectedField) {
      setSelectedText(word.text);
      setSelectedWord(word);
    }
  };

  const handleConfirm = () => {
    if (selectedField && selectedText && selectedWord) {
      // Encontrar índice de la palabra en el array words
      const wordIndex = words.findIndex(w => 
        w.text === selectedWord.text && 
        w.bbox.x0 === selectedWord.bbox.x0 && 
        w.bbox.y0 === selectedWord.bbox.y0
      );

      // Preparar metadata completa de la selección
      const selectionMetadata = {
        wordIndex: wordIndex >= 0 ? wordIndex : null,
        bbox: selectedWord.bbox || null
      };

      // Pasar field, value y metadata completa
      onSelect(selectedField, selectedText, selectionMetadata);
      setSelectedField(null);
      setSelectedText(null);
      setSelectedWord(null);
    }
  };

  const fieldLabels = {
    dni: 'DNI',
    nombre: 'Nombre',
    telefono: 'Teléfono',
    patente: 'Patente',
    fecha: 'Fecha'
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Seleccionar texto del documento
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Selecciona un campo y luego el texto correspondiente del documento
        </Alert>

        <Grid container spacing={2}>
          {/* Columna 1: Campos disponibles */}
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>
              Seleccionar campo:
            </Typography>
            <Paper variant="outlined" sx={{ p: 1 }}>
              {Object.entries(fieldLabels).map(([key, label]) => (
                <Chip
                  key={key}
                  label={`${label}${detectedFields[key] ? `: ${detectedFields[key]}` : ''}`}
                  onClick={() => {
                    setSelectedField(key);
                    setSelectedText(null);
                  }}
                  color={selectedField === key ? 'primary' : 'default'}
                  variant={selectedField === key ? 'filled' : 'outlined'}
                  sx={{ m: 0.5, display: 'block' }}
                />
              ))}
            </Paper>
          </Grid>

          {/* Columna 2: Palabras detectadas */}
          <Grid item xs={12} md={8}>
            <Typography variant="subtitle2" gutterBottom>
              {selectedField 
                ? `Palabras detectadas - Selecciona el ${fieldLabels[selectedField]}:`
                : 'Palabras detectadas por OCR:'}
            </Typography>
            <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
              <List dense>
                {Object.entries(groupedWords).map(([line, lineWords]) => (
                  <Box key={line}>
                    <ListItem disablePadding>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 1, width: '100%' }}>
                        {lineWords.map((word, idx) => (
                          <Chip
                            key={idx}
                            label={word.text}
                  onClick={() => handleWordSelect(word)}
                  color={selectedField && selectedWord && selectedWord.text === word.text && 
                         selectedWord.bbox?.x0 === word.bbox?.x0 && 
                         selectedWord.bbox?.y0 === word.bbox?.y0 ? 'primary' : 'default'}
                  variant={selectedField && selectedWord && selectedWord.text === word.text && 
                           selectedWord.bbox?.x0 === word.bbox?.x0 && 
                           selectedWord.bbox?.y0 === word.bbox?.y0 ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ cursor: selectedField ? 'pointer' : 'default' }}
                          />
                        ))}
                      </Box>
                    </ListItem>
                    <Divider />
                  </Box>
                ))}
                {words.length === 0 && (
                  <ListItem>
                    <ListItemText 
                      primary="No se detectaron palabras en este documento"
                      secondary="El OCR no pudo extraer texto"
                    />
                  </ListItem>
                )}
              </List>
            </Paper>

            {selectedField && selectedText && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {fieldLabels[selectedField]}: <strong>{selectedText}</strong>
              </Alert>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedField || !selectedText}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

