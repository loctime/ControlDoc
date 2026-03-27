import React, { useState, useRef } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import { ZoomIn, ZoomOut, Fullscreen, FullscreenExit } from '@mui/icons-material';

export default function FastImageViewer({ 
  fileURL, 
  fileName,
  sx = {},
  showControls = true,
  maxHeight = '75vh'
}) {
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageError, setImageError] = useState(false);
  
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

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  if (imageError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        No se pudo cargar la imagen
      </Alert>
    );
  }

  return (
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
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          position: 'relative'
        }}
      >
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
            transition: 'transform 0.2s ease-in-out'
          }}
        />
        
        {/* Loading indicator mientras la imagen carga */}
        {!imgRef.current?.complete && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              zIndex: 1
            }}
          >
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              Cargando imagen...
            </Typography>
          </Box>
        )}
      </Box>

      {showControls && imgRef.current?.complete && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: 1,
            padding: 0.5
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

      {imgRef.current?.complete && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 1,
            fontSize: '0.75rem'
          }}
        >
          Zoom: {Math.round(scale * 100)}%
        </Box>
      )}
    </Box>
  );
}
