import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  Checkbox,
  Button
} from '@mui/material';
import { CalendarToday, Close, Warning } from '@mui/icons-material';

export default function PageThumbnail({
  page,
  isGroupingMode,
  selectedPages,
  selectedDateForPage,
  manualDates,
  getPageGroupNumber,
  getSimilarPageNumbers,
  onPageClick,
  onToggleSelection,
  onRemoveDate
}) {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 1,
        cursor: isGroupingMode ? 'default' : 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        border: selectedPages.includes(page.pageNum) ? '2px solid var(--primary-main)' : '1px solid transparent',
        '&:hover': {
          elevation: 4,
          transform: 'scale(1.02)'
        }
      }}
      onClick={() => {
        if (isGroupingMode) {
          onToggleSelection(page.pageNum);
        } else {
          onPageClick(page.pageNum);
        }
      }}
    >
      {/* Checkbox para modo agrupación */}
      {isGroupingMode && (
        <Checkbox
          checked={selectedPages.includes(page.pageNum)}
          onChange={() => onToggleSelection(page.pageNum)}
          sx={{ 
            position: 'absolute', 
            top: 8, 
            left: 8, 
            zIndex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '50%'
          }}
        />
      )}
      
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Página {page.pageNum}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {getPageGroupNumber(page.pageNum) && (
              <Chip
                label={`Grupo ${getPageGroupNumber(page.pageNum)}`}
                size="small"
                color="primary"
                variant="filled"
                sx={{ fontSize: '0.6rem', height: '20px' }}
              />
            )}
            {getSimilarPageNumbers(page.pageNum).length > 0 && (
              <Chip
                label={`${getSimilarPageNumbers(page.pageNum).length} similares`}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ fontSize: '0.6rem', height: '20px' }}
              />
            )}
          </Box>
        </Box>
        
        {page.error ? (
          <Box sx={{ 
            height: 200, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            borderRadius: 1
          }}>
            <Typography variant="caption" color="error">
              Error cargando página
            </Typography>
          </Box>
        ) : (
          <Box
            component="img"
            src={page.dataURL}
            alt={`Página ${page.pageNum}`}
            sx={{
              maxWidth: '100%',
              height: 'auto',
              maxHeight: 200,
              objectFit: 'contain',
              borderRadius: 1,
              border: '1px solid #e0e0e0'
            }}
          />
        )}

        {/* Fecha seleccionada para esta página */}
        {selectedDateForPage[page.pageNum] ? (
          <Box sx={{ 
            mt: 1, 
            p: 1, 
            backgroundColor: manualDates[page.pageNum] ? '#fff3e0' : '#e8f5e8', 
            borderRadius: 1, 
            border: manualDates[page.pageNum] ? '2px solid #ff9800' : '1px solid #4caf50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 0.5
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarToday sx={{ fontSize: '0.8rem', color: manualDates[page.pageNum] ? '#ff9800' : '#4caf50' }} />
              <Typography variant="caption" color={manualDates[page.pageNum] ? "warning.dark" : "success.dark"} sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                {manualDates[page.pageNum] ? '🔒 Manual' : 'vencimiento'}: {selectedDateForPage[page.pageNum]}
              </Typography>
            </Box>
            <Button
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveDate(page.pageNum);
              }}
              sx={{ minWidth: 'auto', p: 0.2 }}
            >
              <Close sx={{ fontSize: '0.7rem' }} />
            </Button>
          </Box>
        ) : (
          <Box sx={{ 
            mt: 1, 
            p: 1, 
            backgroundColor: '#fff3e0', 
            borderRadius: 1, 
            border: '1px solid #ff9800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 0.5
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Warning sx={{ fontSize: '0.8rem', color: '#ff9800' }} />
              <Typography variant="caption" color="warning.dark" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
                Sin fecha asignada
              </Typography>
            </Box>
            <Button
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                onPageClick(page.pageNum);
              }}
              sx={{ minWidth: 'auto', p: 0.2, fontSize: '0.6rem' }}
            >
              Asignar
            </Button>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
