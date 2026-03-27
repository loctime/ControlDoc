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
  Chip,
  Alert
} from '@mui/material';
import { CalendarToday, Warning } from '@mui/icons-material';
import { isValidDateFormat, formatDateToDDMMAA } from '../utils/dateDetectionUtils.js';

export default function GroupDateModal({
  open,
  onClose,
  onConfirm,
  groupName,
  availableDates,
  groupPages
}) {
  const [selectedDate, setSelectedDate] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [useManualDate, setUseManualDate] = useState(false);

  const handleConfirm = () => {
    const finalDate = useManualDate ? manualDate : selectedDate;
    if (finalDate) {
      onConfirm(finalDate);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedDate('');
    setManualDate('');
    setUseManualDate(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        📅 Seleccionar Fecha para {groupName}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Las páginas {groupPages.join(', ')} tienen fechas diferentes. Selecciona una fecha para el grupo:
        </Typography>
        
        {/* Fechas disponibles */}
        {availableDates.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Fechas disponibles en las páginas:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {availableDates.map((date, index) => (
                <Chip
                  key={index}
                  label={date}
                  onClick={() => {
                    setSelectedDate(date);
                    setUseManualDate(false);
                  }}
                  color={selectedDate === date ? "primary" : "default"}
                  variant={selectedDate === date ? "filled" : "outlined"}
                  icon={<CalendarToday />}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Fecha manual */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            O ingresa una fecha manual:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              placeholder="16/07/25"
              value={manualDate}
              onChange={(e) => {
                setManualDate(e.target.value);
                setUseManualDate(true);
                setSelectedDate('');
              }}
              error={manualDate.trim() !== '' && !isValidDateFormat(manualDate)}
              helperText={manualDate.trim() !== '' && !isValidDateFormat(manualDate) ? 'Formato: DD/MM/YY' : ''}
              sx={{ flexGrow: 1 }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setUseManualDate(true);
                setSelectedDate('');
              }}
              disabled={!manualDate.trim() || !isValidDateFormat(manualDate)}
            >
              Usar
            </Button>
          </Box>
        </Box>

        {/* Resumen de selección */}
        {(selectedDate || (useManualDate && manualDate)) && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarToday sx={{ fontSize: '1rem' }} />
              <Typography variant="body2">
                Fecha seleccionada: <strong>{selectedDate || manualDate}</strong>
              </Typography>
            </Box>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          Cancelar
        </Button>
        <Button 
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedDate && !(useManualDate && manualDate)}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
