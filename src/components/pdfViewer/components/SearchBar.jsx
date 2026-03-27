import React from 'react';
import { Box, TextField, Typography, Chip } from '@mui/material';

export default function SearchBar({
  query,
  onQueryChange,
  onKeyPress,
  onKeyDown,
  matches,
  topSearches,
  onTopSearchSelect
}) {
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 2, 
      mb: 2,
      flexWrap: 'wrap'
    }}>
      {/* Buscador compacto */}
      <TextField
        size="small"
        label="Buscar..."
        value={query}
        onChange={onQueryChange}
        onKeyPress={onKeyPress}
        onKeyDown={onKeyDown}
        sx={{ 
          minWidth: '200px',
          maxWidth: '300px',
          flex: '0 0 auto'
        }}
      />
      
      {/* Contador de coincidencias */}
      {query && query.trim() && (
        <Typography 
          variant="body2" 
          color={matches.length > 0 ? 'success.main' : 'text.secondary'}
          sx={{ 
            minWidth: 'fit-content', 
            fontWeight: 'bold',
            fontSize: '0.8rem'
          }}
        >
          {matches.length} coincidencia{matches.length !== 1 ? 's' : ''}
        </Typography>
      )}
      
      {/* Palabras populares en la misma fila */}
      {topSearches.length > 0 && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          flex: '1 1 auto',
          minWidth: '200px'
        }}>
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ 
              fontWeight: 'bold',
              fontSize: '0.7rem',
              whiteSpace: 'nowrap'
            }}
          >
            🔍 Populares:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {topSearches.slice(0, 4).map((search, index) => (
              <Chip
                key={index}
                label={search.word}
                size="small"
                variant="outlined"
                onClick={() => onTopSearchSelect(search.word)}
                sx={{ 
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  height: '22px',
                  '&:hover': {
                    backgroundColor: 'var(--info-light)',
                    borderColor: 'var(--info-main)'
                  }
                }}
              />
            ))}
            {topSearches.length > 4 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                +{topSearches.length - 4}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
