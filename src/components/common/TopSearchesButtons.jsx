import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { useSearchHistory } from '../../hooks/useSearchHistory';

/**
 * Componente que muestra las palabras más buscadas como botones clickeables
 */
export default function TopSearchesButtons({ onSearchSelect, maxButtons = 6 }) {
  const { topSearches, loading } = useSearchHistory();

  if (loading) {
    return null; // No mostrar nada mientras carga
  }

  if (!topSearches || topSearches.length === 0) {
    return null; // No mostrar nada si no hay búsquedas
  }

  const handleSearchClick = (word) => {
    if (onSearchSelect && typeof onSearchSelect === 'function') {
      onSearchSelect(word);
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: 1, 
      alignItems: 'center',
      mt: 1,
      mb: 1
    }}>
      <Typography 
        variant="caption" 
        color="text.secondary" 
        sx={{ mr: 1, fontWeight: 500 }}
      >
        Más buscadas:
      </Typography>
      
      {topSearches.slice(0, maxButtons).map((search, index) => (
        <Tooltip 
          key={search.word} 
          title={`Buscado ${search.count} vez${search.count !== 1 ? 'es' : ''}`}
          arrow
        >
          <Chip
            label={search.word}
            size="small"
            variant="outlined"
            onClick={() => handleSearchClick(search.word)}
            sx={{
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'primary.light',
                color: 'primary.contrastText',
                borderColor: 'primary.main'
              },
              transition: 'all 0.2s ease-in-out',
              fontSize: '0.75rem',
              height: '24px'
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
}
