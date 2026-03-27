// src/components/common/DownloadAsPdfButton.jsx
import React, { useState } from 'react';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import { PictureAsPdf } from '@mui/icons-material';

export default function DownloadAsPdfButton({ 
  imageUrl, 
  filename, 
  label = "Convertir a PDF", 
  iconOnly = false,
  fastMode = true // Por defecto usar modo rápido.
}) {
  const [loading, setLoading] = useState(false);

  const isImageUrlValid = async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      return contentType && contentType.startsWith('image/');
    } catch {
      return false;
    }
  };

  const handleDownloadPdf = async () => {
    if (!imageUrl) {
      console.warn('⚠️ No se proporcionó imageUrl para convertir a PDF');
      return;
    }
    setLoading(true);
    try {
      const isValid = await isImageUrlValid(imageUrl);
      if (!isValid) {
        alert('La URL no apunta a una imagen válida.');
        return;
      }
      
      console.log(`🔄 Iniciando conversión a PDF (fastMode: ${fastMode})`);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/convert-image/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl,
          fastMode // Usar modo rápido por defecto
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al convertir la imagen a PDF');
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      console.log('✅ Conversión a PDF completada exitosamente');
    } catch (err) {
      console.error('❌ Error al convertir imagen a PDF:', err);
      alert(`No se pudo convertir la imagen a PDF: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (iconOnly) {
    return (
      <Tooltip title={label}>
        <Button
          onClick={handleDownloadPdf}
          disabled={loading}
          size="small"
          variant="outlined"
          sx={{ minWidth: 40, padding: 1 }}
        >
          {loading ? <CircularProgress size={20} /> : <PictureAsPdf />}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button
      onClick={handleDownloadPdf}
      disabled={loading}
      variant="outlined"
      startIcon={!loading && <PictureAsPdf />}
    >
      {loading ? <CircularProgress size={24} /> : label}
    </Button>
  );
}
