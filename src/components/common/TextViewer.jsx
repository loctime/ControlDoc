import React, { useEffect, useRef, useState } from 'react';
import { Box, TextField, Typography, CircularProgress } from '@mui/material';
import axios from 'axios';

export default function TextViewer({ fileURL }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [words, setWords] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const imgRef = useRef();
  const [loading, setLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const analizarArchivo = async () => {
      if (!fileURL) return;

      setLoading(true);
      setError('');
      try {
        const res = await axios.post('/api/analyze-file', { fileURL });
        setWords(res.data.words || []);
        setImagePreview(res.data.imageURL || fileURL);
      } catch (e) {
        console.error('Error al analizar archivo:', e);
        setError(`Error al procesar el documento: ${e.response?.data?.error || e.message}`);
      } finally {
        setLoading(false);
      }
    };
    analizarArchivo();
  }, [fileURL]);

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImageSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight
      });
    }
  };

  const normalizeText = (text) => {
    return text?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
  };

  const getOverlayStyle = (word) => {
    const { x0, y0, x1, y1, page } = word.bbox || {};
    if (!imgRef.current || !page?.width || !page?.height) return {};
    
    const scaleX = imgRef.current.clientWidth / page.width;
    const scaleY = imgRef.current.clientHeight / page.height;

    return {
      position: 'absolute',
      left: x0 * scaleX,
      top: y0 * scaleY,
      width: Math.max((x1 - x0) * scaleX, 1),
      height: Math.max((y1 - y0) * scaleY, 1),
      backgroundColor: 'rgba(255,255,0,0.5)',
      pointerEvents: 'none',
      borderRadius: 2,
      transition: 'all 0.1s ease-out'
    };
  };

  return (
    <Box position="relative" width="100%">
      <TextField
        fullWidth
        label="Buscar palabra"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ mb: 2 }}
        disabled={!!(loading || error)}
      />

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      ) : (
        <Box position="relative" width="100%">
          <Box
            component="img"
            src={imagePreview}
            ref={imgRef}
            onLoad={handleImageLoad}
            alt="Documento"
            sx={{
              width: '100%',
              height: 'auto',
              display: 'block',
              borderRadius: 2
            }}
          />
          <Box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height="100%"
            zIndex={10}
            sx={{ pointerEvents: 'none' }}
          >
            {words
              .filter((w) => {
                if (!query) return false;
                return normalizeText(w.text) === normalizeText(query);
              })
              .map((word, i) => (
                <Box key={i} sx={getOverlayStyle(word)} />
              ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
