import React, { useState, useRef } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Stack
} from '@mui/material';
import { ZoomIn, ZoomOut, Fullscreen, FullscreenExit, Search } from '@mui/icons-material';

export default function SimpleImageViewer({ 
  fileURL, 
  fileName,
  sx = {},
  showControls = true,
  maxHeight = '75vh',
  showSearch = true
}) {
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.max(0.25, Math.min(3, prev + delta)));
    }
  };

  const handleImageLoad = () => {
    console.log('✅ Imagen cargada exitosamente');
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    console.log('❌ Error al cargar imagen');
    setImageError(true);
    setImageLoaded(false);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  if (imageError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        No se pudo cargar la imagen
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Campo de búsqueda */}
      {showSearch && imageLoaded && (
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="Buscar en imagen..."
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Buscar texto en la imagen..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            inputProps={{ 'aria-label': 'Buscar texto en imagen' }}
          />
        </Box>
      )}

      {/* Visor de imagen */}
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: maxHeight,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...sx
        }}
        onWheel={handleWheel}
      >
      {/* Loading indicator */}
      {!imageLoaded && (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: 2,
          position: 'absolute',
          zIndex: 2
        }}>
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary">
            Cargando imagen...
          </Typography>
        </Box>
      )}

      {/* Imagen */}
      <img
        ref={imgRef}
        src={fileURL}
        alt={fileName || 'Imagen'}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{
          maxWidth: `${scale * 100}%`,
          maxHeight: `${scale * 100}%`,
          objectFit: 'contain',
          opacity: imageLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}
      />

      {/* Controles */}
      {showControls && imageLoaded && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: 1,
            padding: 0.5,
            zIndex: 3
          }}
        >
          <Tooltip title="Zoom out">
            <IconButton
              size="small"
              onClick={handleZoomOut}
              sx={{ color: 'white' }}
              disabled={scale <= 0.25}
            >
              <ZoomOut fontSize="small" />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Zoom in">
            <IconButton
              size="small"
              onClick={handleZoomIn}
              sx={{ color: 'white' }}
              disabled={scale >= 3}
            >
              <ZoomIn fontSize="small" />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={isFullscreen ? "Salir pantalla completa" : "Pantalla completa"}>
            <IconButton
              size="small"
              onClick={handleFullscreen}
              sx={{ color: 'white' }}
            >
              {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* Indicador de zoom */}
      {imageLoaded && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 1,
            fontSize: '0.75rem',
            zIndex: 3
          }}
        >
          Zoom: {Math.round(scale * 100)}%
                 </Box>
       )}
     </Box>
   </Box>
 );
}
