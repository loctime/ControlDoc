import React, { forwardRef, useState } from 'react';
import { Button, IconButton, Tooltip, CircularProgress } from '@mui/material';
import { Download } from '@mui/icons-material';
import { buildDownloadName } from '../../utils/buildDownloadName';

export default forwardRef(function DownloadButton({
  url,
  file, // Nuevo: permite pasar un File o Blob directamente
  filename,
  currentDocument,
  label = 'Descargar',
  iconOnly = false,
  startIcon = true,
  variant = 'contained',
  size = 'medium',
  disabled = false,
  autoTrigger = false,
  onClick
}, ref) {
  const [loading, setLoading] = useState(false);

  const getExtensionFromContentType = (type) => {
    const map = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/zip': 'zip',
      'text/plain': 'txt',
    };
    return map[type] || 'bin';
  };

  const handleDownload = async () => {
    try {
      let blob;
      let finalFilename;

      if (file) {
        // Descarga directa de archivo local
        blob = file instanceof Blob ? file : new Blob([file]);
        finalFilename = filename || file.name || 'archivo.descargado';
      } else if (url) {
        // Descarga desde URL (fetch para evitar CORS en archivos protegidos)
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error al descargar el archivo');
        const contentType = response.headers.get('Content-Type');
        blob = await response.blob();
        const ext = getExtensionFromContentType(contentType);
        finalFilename = filename || buildDownloadName(currentDocument) || `archivo.${ext}`;
      } else {
        console.warn('⚠️ No se proporcionó ni archivo local ni URL');
        return;
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error al descargar archivo:', error);
    }
  };

  const handleClick = async () => {
    setLoading(true);
    await handleDownload();
    setLoading(false);
    if (onClick) onClick();
  };

  return iconOnly ? (
    <Tooltip title={label}>
      <IconButton
        onClick={handleClick}
        disabled={disabled || loading}
        size={size}
        ref={ref}
      >
        {loading ? <CircularProgress size={24} /> : <Download />}
      </IconButton>
    </Tooltip>
  ) : (
    <Button
      onClick={handleClick}
      disabled={disabled || loading}
      variant={variant}
      size={size}
      startIcon={startIcon && !loading ? <Download /> : null}
      ref={ref}
    >
      {loading ? <CircularProgress size={24} /> : label}
    </Button>
  );
});
