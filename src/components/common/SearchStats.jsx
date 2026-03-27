import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Button,
  Tooltip
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  Clear as ClearIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useSearchHistory } from '../../hooks/useSearchHistory';

/**
 * Componente para mostrar estadísticas detalladas de búsqueda
 */
export default function SearchStats() {
  const { topSearches, clearSearchHistory, loading } = useSearchHistory();
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleClearHistory = async () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar todo el historial de búsquedas?')) {
      await clearSearchHistory();
    }
  };

  if (loading || !topSearches || topSearches.length === 0) {
    return null;
  }

  const totalSearches = topSearches.reduce((sum, search) => sum + search.count, 0);

  return (
    <>
      <Tooltip title="Ver estadísticas de búsqueda" arrow>
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{
            color: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.light',
              color: 'primary.contrastText'
            }
          }}
        >
          <BarChartIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon color="primary" />
          Estadísticas de Búsqueda
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Resumen
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total de búsquedas: <strong>{totalSearches}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Palabras únicas: <strong>{topSearches.length}</strong>
            </Typography>
          </Box>

          <Typography variant="h6" color="primary" gutterBottom>
            Palabras Más Buscadas
          </Typography>
          
          <List dense>
            {topSearches.map((search, index) => (
              <ListItem key={search.word} divider>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip 
                        label={`#${index + 1}`} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                      <Typography variant="body1" fontWeight="medium">
                        {search.word}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      Buscado {search.count} vez{search.count !== 1 ? 'es' : ''} • 
                      Última búsqueda: {new Date(search.lastSearched).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </Typography>
                  }
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={`${((search.count / totalSearches) * 100).toFixed(1)}%`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ClearIcon />}
              onClick={handleClearHistory}
              size="small"
            >
              Limpiar Historial
            </Button>
            <Button
              variant="contained"
              onClick={handleClose}
              size="small"
            >
              Cerrar
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
