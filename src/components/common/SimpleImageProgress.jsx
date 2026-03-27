import React, { useState, useEffect } from 'react';
import { 
  Box, 
  LinearProgress, 
  Typography, 
  Stack 
} from '@mui/material';
import { Image } from '@mui/icons-material';

export default function SimpleImageProgress({ 
  fileURL, 
  onComplete 
}) {
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!fileURL) return;

    // Progreso simulado simple y confiable
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setCompleted(true);
          onComplete?.();
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    // Timeout de seguridad
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      setCompleted(true);
      onComplete?.();
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [fileURL, onComplete]);

  if (completed) {
    return null; // No mostrar nada cuando está completado
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Image color="primary" fontSize="small" />
        <Typography variant="body2">
          Preparando imagen...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {progress}%
        </Typography>
      </Stack>
      
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ mb: 1 }}
      />
    </Box>
  );
}
