import { useState } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

const presets = [
  {
    label: 'Hoy',
    range: () => {
      const today = new Date();
      return { startDate: today, endDate: today };
    }
  },
  {
    label: 'Ayer',
    range: () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return { startDate: yesterday, endDate: yesterday };
    }
  },
  {
    label: 'Últimos 7 días',
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Últimos 30 días',
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 29);
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Últimos 90 días',
    range: () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999); // Fin del día actual
  
      const start = new Date();
      start.setDate(end.getDate() - 89); // Incluye hoy como día 90
      start.setHours(0, 0, 0, 0); // Inicio del primer día
  
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Todos',
    range: () => ({ startDate: null, endDate: null })
  }
];

export default function DateRangeWithPresets({ onApply }) {
  const [selectedRange, setSelectedRange] = useState({
    startDate: new Date(),
    endDate: new Date(),
    key: 'selection'
  });

  const [selectedPreset, setSelectedPreset] = useState(null);

  const handlePresetClick = (preset) => {
    const range = preset.range();
    setSelectedRange({
      ...range,
      key: 'selection'
    });
    setSelectedPreset(preset.label);
  };

  return (
    <Paper sx={{ p: 2, display: 'flex', gap: 2 }}>
      {/* Calendario - más compacto */}
      <Box sx={{ flex: 1 }}>
        <DateRange
          editableDateInputs={true}
          onChange={item => setSelectedRange(item.selection)}
          moveRangeOnFirstSelection={false}
          ranges={[selectedRange]}
          months={1}  // Solo un mes visible
          direction="horizontal"
          showMonthAndYearPickers={false}
        />
      </Box>

      {/* Presets - columna derecha */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: 180,
        gap: 1 
      }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Presets
        </Typography>
        
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={selectedPreset === preset.label ? 'contained' : 'outlined'}
            onClick={() => handlePresetClick(preset)}
            size="small"
            sx={{ 
              textTransform: 'none',
              justifyContent: 'flex-start',
              py: 0.5
            }}
          >
            {preset.label}
          </Button>
        ))}

        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setSelectedRange({ startDate: null, endDate: null, key: 'selection' })}
            sx={{ flex: 1 }}
          >
            Limpiar
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => {
              onApply({
                start: selectedRange.startDate,
                end: selectedRange.endDate
              });
            }}
            sx={{ flex: 1 }}
          >
            Aplicar
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
