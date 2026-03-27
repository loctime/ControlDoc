// src/components/common/TextOverlayViewer.jsx
import { useState } from 'react';
import { Box, TextField, Typography } from '@mui/material';

export default function TextOverlayViewer({ imageUrl, extractedText = '' }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);

  const handleSearch = (value) => {
    const regex = new RegExp(value, 'gi');
    const newMatches = [...extractedText.matchAll(regex)];
    setMatches(newMatches.map((m) => m[0]));
    setQuery(value);
  };

  return (
    <Box>
      <TextField
        fullWidth
        label="Buscar palabra..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        sx={{ mb: 2 }}
      />
      <Box
        component="img"
        src={imageUrl}
        alt="Documento"
        sx={{ width: '100%', borderRadius: 2 }}
      />
      {query && (
        <Box mt={2}>
          <Typography variant="subtitle1" fontWeight="bold">Coincidencias encontradas:</Typography>
          {matches.length === 0 ? (
            <Typography color="error">No se encontraron coincidencias</Typography>
          ) : (
            matches.map((m, i) => (
              <Typography key={i} sx={{ backgroundColor: '#ffff0066', display: 'inline-block', p: 0.5, m: 0.5 }}>
                {m}
              </Typography>
            ))
          )}
        </Box>
      )}
    </Box>
  );
}
