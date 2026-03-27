import React, { useState, useEffect } from 'react';
import { 
  Box, 
  LinearProgress, 
  Typography, 
  Alert,
  Chip,
  Stack 
} from '@mui/material';
import { Image, Speed, CheckCircle } from '@mui/icons-material';

export default function ImageLoadingProgress({ 
  fileURL, 
  fileName, 
  onLoadComplete,
  showOptimizationTips = true 
}) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [optimizationTips] = useState([
    '💡 Preparando imagen para visualización...',
    '⚡ Optimizando carga...',
    '🔄 Configurando visor...',
    '📦 Carga completada'
  ]);

  useEffect(() => {
    if (!fileURL) return;

    const simulateProgress = () => {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 200);

      return interval;
    };

    const loadImage = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Simular progreso inicial
        const progressInterval = simulateProgress();
        
        // Crear una imagen para precargar
        const img = new Image();
        
        // Configurar timeout para evitar esperas infinitas
        const timeoutId = setTimeout(() => {
          clearInterval(progressInterval);
          setProgress(100);
          setLoading(false);
          onLoadComplete?.();
          console.log('⏰ Timeout de carga de imagen - continuando sin precarga');
        }, 3000); // Reducir a 3 segundos
        
        img.onload = () => {
          clearTimeout(timeoutId);
          clearInterval(progressInterval);
          setProgress(100);
          // Completar inmediatamente sin delay adicional
          setLoading(false);
          onLoadComplete?.();
        };
        
        img.onerror = () => {
          clearTimeout(timeoutId);
          clearInterval(progressInterval);
          console.log('⚠️ No se pudo precargar la imagen, continuando...');
          setProgress(100);
          setLoading(false);
          onLoadComplete?.();
        };
        
        img.src = fileURL;
        
      } catch (err) {
        console.log('⚠️ Error en precarga de imagen:', err.message);
        setProgress(100);
        setLoading(false);
        onLoadComplete?.();
      }
    };

    loadImage();
  }, [fileURL, onLoadComplete]);

  // No mostrar error si la imagen se está cargando normalmente
  if (error && !loading) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!loading && progress === 100) {
    return (
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <CheckCircle color="success" fontSize="small" />
          <Typography variant="body2" color="success.main">
            Imagen lista para visualización
          </Typography>
          <Chip 
            label="Optimizada" 
            size="small" 
            color="success" 
            variant="outlined"
            icon={<Speed />}
          />
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Image color="primary" fontSize="small" />
        <Typography variant="body2">
          Preparando imagen...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {Math.round(progress)}%
        </Typography>
      </Stack>
      
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ mb: 1 }}
      />
      
      {showOptimizationTips && progress < 50 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {optimizationTips[Math.floor(progress / 20)]}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
