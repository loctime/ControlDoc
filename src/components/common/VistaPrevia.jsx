import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  Paper,
  Button,
  Box,
  Tooltip
} from '@mui/material';

/**
 * Componente reutilizable para mostrar vista previa de archivos
 * Soporta imágenes y PDFs. Admite texto a resaltar (solo PDF).
 */
/**
 * Componente reutilizable para mostrar vista previa de archivos
 * Soporta imágenes y PDFs. Admite texto a resaltar (solo PDF).
 * Ahora soporta blobs PDF usando fileType (tipo MIME).
 */
export default function VistaPrevia({
  url,
  fileType, // tipo MIME del archivo, opcional
  titulo = 'Vista previa',
  tipo = 'documento',
  width = 300,
  height = 180,
  highlight = null
}) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [imgError, setImgError] = useState(false);

  // Reset error cuando cambia la url
  useEffect(() => {
    setImgError(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [url]);

  const pdfUrl = useMemo(() => {
    if (!highlight) return url;
    const viewer = 'https://mozilla.github.io/pdf.js/web/viewer.html';
    return `${viewer}?file=${encodeURIComponent(url)}#search=${encodeURIComponent(highlight)}`;
  }, [url, highlight]);

  if (!url) {
    return <Typography variant="body2" color="text.secondary">Sin archivo disponible</Typography>;
  }

  // Soporte para blobs PDF: si fileType es application/pdf, es PDF aunque la URL no termine en .pdf
  const isPDF = (fileType === 'application/pdf') || (/\.pdf$/i.test(url));
  const isImage = !isPDF && (fileType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url));

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    resetView();
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setScale(prev => Math.max(0.8, Math.min(2, prev + (e.deltaY > 0 ? -0.1 : 0.1))));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleImageLoad = (e) => {
    setImgSize({
      width: e.target.naturalWidth,
      height: e.target.naturalHeight
    });
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <>
      <Paper
        elevation={2}
        onClick={handleOpen}
        sx={{
          cursor: 'pointer',
          p: 1,
          border: tipo === 'ejemplo' ? '1px dashed #999' : '2px solid var(--info-main)',
          backgroundColor: tipo === 'ejemplo' ? '#f4faff' : '#fff',
          width,
          height,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isImage ? (
          imgError ? (
            <Typography variant="body2" color="error" align="center">
              No se pudo mostrar la imagen
            </Typography>
          ) : (
            <img
              src={url}
              alt={titulo}
              width={width}
              height={height}
              loading="lazy"
              decoding="async"
              role="img"
              style={{
                objectFit: 'contain',
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'block',
                aspectRatio: '3/2'
              }}
              onError={() => setImgError(true)}
              onLoad={() => setImgError(false)}
            />
          )
        ) : isPDF ? (
          <iframe
            src={pdfUrl}
            title="Vista previa PDF"
            width={width}
            height={height}
            style={{ border: 'none', display: 'block' }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Tipo de archivo no soportado
          </Typography>
        )}
      </Paper>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{titulo}</DialogTitle>
        <DialogContent dividers sx={{ overflow: 'hidden', position: 'relative' }}>
          {isPDF ? (
            <iframe
              src={pdfUrl}
              width="100%"
              height="600"
              title="Vista ampliada"
              style={{ border: 'none', display: 'block' }}
            />
          ) : isImage ? (
            <>
              {imgError ? (
                <Box sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body1" color="error" align="center">
                    No se pudo mostrar la imagen
                  </Typography>
                </Box>
              ) : (
                <Box
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  sx={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    overflow: 'hidden',
                    height: '80vh',
                    position: 'relative'
                  }}
                >
                  <Tooltip
                    title={`Tamaño original: ${imgSize.width}px × ${imgSize.height}px`}
                    placement="top"
                  >
                    <img
                      src={url}
                      alt={`Vista ampliada - ${titulo}`}
                      loading="lazy"
                      onLoad={handleImageLoad}
                      onError={() => setImgError(true)}
                      style={{
                        transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                        transformOrigin: 'top left',
                        width: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        display: 'block',
                        transition: isDragging ? 'none' : 'transform 0.1s ease',
                        willChange: 'transform'
                      }}
                    />
                  </Tooltip>
                </Box>
              )}
              <Box sx={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                display: 'flex',
                gap: 1,
                backgroundColor: 'rgba(255,255,255,0.7)',
                p: 1,
                borderRadius: 1
              }}>
                <Button variant="contained" onClick={() => setScale(s => Math.min(2, s + 0.1))} size="small">
                  +
                </Button>
                <Button variant="contained" onClick={() => setScale(s => Math.max(0.8, s - 0.1))} size="small">
                  -
                </Button>
                <Button variant="contained" onClick={resetView} size="small">
                  Reset
                </Button>
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
                  {Math.round(scale * 100)}%
                </Typography>
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Tipo de archivo no soportado
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
