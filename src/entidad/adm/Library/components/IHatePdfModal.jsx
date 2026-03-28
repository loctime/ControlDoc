import React, { useState } from 'react';
import { useFileUrl } from '../../../../hooks/useFileUrl';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import { getAuth } from 'firebase/auth';
import DocumentMetadataTable from './DocumentMetadataTable';

const IHatePdfModal = ({ 
  open, 
  onClose, 
  selectedPdfDoc 
}) => {
  const resolvedPdfUrl = useFileUrl({ fileId: selectedPdfDoc?.fileId, fileURL: selectedPdfDoc?.fileURL });

  // Estados del modal
  const [pdfPages, setPdfPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [pdfError, setPdfError] = useState(null);

  // Cargar páginas del PDF
  const loadPdfPages = async (pdfUrl) => {
    try {
      setLoadingPdf(true);
      setPdfError(null);
      
      // Cargar pdfjsLib dinámicamente
      const { pdfjsLib } = await import('../../../../config/pdfConfig.js');
      if (!pdfjsLib) {
        throw new Error('PDF.js no está disponible');
      }
      
      // Cargar el documento PDF
      const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
      const totalPages = pdf.numPages;
      setPdfTotalPages(totalPages);
      
      // Renderizar las primeras 10 páginas como vista previa
      const pagesToLoad = Math.min(totalPages, 10);
      const pagePromises = [];
      
      for (let i = 1; i <= pagesToLoad; i++) {
        pagePromises.push(renderPage(pdf, i));
      }
      
      const renderedPages = await Promise.all(pagePromises);
      setPdfPages(renderedPages);
      
    } catch (error) {
      console.error('Error cargando PDF:', error);
      setPdfError('Error al cargar el PDF. Verifica que el archivo sea válido y accesible.');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Renderizar página individual
  const renderPage = async (pdf, pageNum) => {
    try {
      const page = await pdf.getPage(pageNum);
      const scale = 0.5; // Escala pequeña para vista previa
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      return {
        pageNumber: pageNum,
        canvas: canvas.toDataURL(),
        width: viewport.width,
        height: viewport.height
      };
    } catch (error) {
      console.error(`Error renderizando página ${pageNum}:`, error);
      return null;
    }
  };

  // Funciones de selección de páginas
  const togglePageSelection = (pageNum) => {
    setSelectedPages(prev => {
      if (prev.includes(pageNum)) {
        return prev.filter(p => p !== pageNum);
      } else {
        return [...prev, pageNum].sort((a, b) => a - b);
      }
    });
  };

  const selectPageRange = (start, end) => {
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    setSelectedPages(pages);
  };

  const clearSelection = () => {
    setSelectedPages([]);
  };

  // Funciones de procesamiento PDF
  const handleSplitPdf = async () => {
    if (selectedPages.length === 0 || !selectedPdfDoc) return;

    try {
      setLoadingPdf(true);
      
      const response = await fetch('/api/ihatepdf/split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuth().currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          fileUrl: resolvedPdfUrl,
          selectedPages: selectedPages,
          filename: selectedPdfDoc.name
        })
      });

      if (!response.ok) {
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          console.warn('No se pudo parsear error como JSON:', jsonError);
        }
        
        throw new Error(errorMessage);
      }

      // Verificar que el content-type sea PDF
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/pdf')) {
        console.error('❌ La respuesta no es un PDF. Content-Type:', contentType);
        const textResponse = await response.text();
        console.error('❌ Respuesta del servidor:', textResponse.substring(0, 200));
        throw new Error('El servidor no envió un PDF válido');
      }

      // Obtener el PDF como blob
      const pdfBlob = await response.blob();
      
      if (pdfBlob.size === 0) {
        throw new Error('El archivo PDF generado está vacío');
      }

      console.log(`✅ PDF recibido del backend: ${pdfBlob.size} bytes, tipo: ${pdfBlob.type}`);

      // Crear nombre del archivo
      const baseName = selectedPdfDoc.name.replace(/\.pdf$/i, '');
      const pagesStr = selectedPages.sort((a, b) => a - b).join('-');
      const filename = `${baseName}_pagina_${pagesStr}.pdf`;

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Cerrar el modal
      onClose();
      setSelectedPages([]);

    } catch (error) {
      console.error('Error dividiendo PDF:', error);
      setPdfError(`Error al dividir PDF: ${error.message}`);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDownloadAllSeparate = async () => {
    if (!selectedPdfDoc) return;

    try {
      setLoadingPdf(true);
      
      const response = await fetch('/api/ihatepdf/split-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuth().currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          fileUrl: resolvedPdfUrl,
          filename: selectedPdfDoc.name
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar el PDF');
      }

      // Obtener el ZIP como blob
      const zipBlob = await response.blob();
      
      if (zipBlob.size === 0) {
        throw new Error('El archivo ZIP generado está vacío');
      }

      // Crear nombre del archivo
      const baseName = selectedPdfDoc.name.replace(/\.pdf$/i, '');
      const filename = `${baseName}_todas_las_paginas.zip`;

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Cerrar el modal
      onClose();
      setSelectedPages([]);

    } catch (error) {
      console.error('Error descargando todas las páginas:', error);
      setPdfError(`Error al descargar todas las páginas: ${error.message}`);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDownloadSelectedSeparate = async () => {
    if (selectedPages.length === 0 || !selectedPdfDoc) return;

    try {
      setLoadingPdf(true);
      
      const response = await fetch('/api/ihatepdf/split-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuth().currentUser.getIdToken()}`
        },
        body: JSON.stringify({
          fileUrl: resolvedPdfUrl,
          selectedPages: selectedPages,
          filename: selectedPdfDoc.name
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar el PDF');
      }

      // Obtener el ZIP como blob
      const zipBlob = await response.blob();
      
      if (zipBlob.size === 0) {
        throw new Error('El archivo ZIP generado está vacío');
      }

      // Crear nombre del archivo
      const baseName = selectedPdfDoc.name.replace(/\.pdf$/i, '');
      const pagesStr = selectedPages.sort((a, b) => a - b).join('-');
      const filename = `${baseName}_paginas_${pagesStr}.zip`;

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Cerrar el modal
      onClose();
      setSelectedPages([]);

    } catch (error) {
      console.error('Error descargando páginas seleccionadas:', error);
      setPdfError(`Error al descargar páginas seleccionadas: ${error.message}`);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Efecto para cargar páginas cuando se abre el modal
  React.useEffect(() => {
    if (open && resolvedPdfUrl) {
      loadPdfPages(resolvedPdfUrl);
    } else if (!open) {
      // Limpiar estado cuando se cierra el modal
      setPdfPages([]);
      setSelectedPages([]);
      setPdfTotalPages(0);
      setPdfError(null);
    }
  }, [open, resolvedPdfUrl]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg"
      fullWidth
    >
      <DialogContent>
        {/* Header con layout de columnas - TODO EL ANCHO */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {/* Columna 1: Título y info básica */}
          <Grid item xs={12} lg={3}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: 'error.main', fontWeight: 'bold' }}>
                💥 iHatePDF - Herramientas PDF
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Documento:</strong> {selectedPdfDoc?.name}
              </Typography>
              {pdfTotalPages > 0 && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Total de páginas:</strong> {pdfTotalPages}
                </Typography>
              )}
            </Box>
          </Grid>
          
          {/* Columna 2: Selección de páginas */}
          <Grid item xs={12} lg={5}>
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                Seleccionar páginas
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => selectPageRange(1, Math.min(5, pdfTotalPages))}
                >
                  Páginas 1-{Math.min(5, pdfTotalPages)}
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => selectPageRange(Math.min(6, pdfTotalPages), Math.min(10, pdfTotalPages))}
                  disabled={pdfTotalPages < 6}
                >
                  Páginas 6-{Math.min(10, pdfTotalPages)}
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => selectPageRange(1, pdfTotalPages)}
                >
                  Todas
                </Button>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={clearSelection}
                  color="secondary"
                >
                  Limpiar
                </Button>
              </Box>
              
              {selectedPages.length > 0 && (
                <Box>
                  <Typography variant="caption" display="block" gutterBottom>
                    <strong>Seleccionadas:</strong> {selectedPages.length}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {selectedPages.map(pageNum => (
                      <Chip 
                        key={pageNum} 
                        label={pageNum} 
                        size="small"
                        onDelete={() => togglePageSelection(pageNum)}
                        color="primary"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Grid>
          
          {/* Columna 3: Espacio para futuras funcionalidades */}
          <Grid item xs={12} lg={4}>
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                Próximamente: más herramientas PDF
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Comprimir, Unir, Convertir, Proteger y más...
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        
        {pdfError && (
          <Box sx={{ 
            p: 2, 
            backgroundColor: 'error.light', 
            color: 'error.contrastText',
            borderRadius: 1,
            mb: 2
          }}>
            <Typography variant="body2">
              {pdfError}
            </Typography>
          </Box>
        )}
        
        {loadingPdf ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Cargando páginas...</Typography>
          </Box>
        ) : pdfError ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No se puede mostrar la vista previa debido a un error.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Vista previa de páginas */}
            {pdfPages.length > 0 && (
              <Box>
                
                <DocumentMetadataTable 
                  document={selectedPdfDoc} 
                  title="Vista previa de páginas" 
                  compact={true} 
                />
                <Grid container spacing={2}>
                  {pdfPages.map((page) => (
                    <Grid item xs={12} sm={6} md={4} key={page.pageNumber}>
                      <Card 
                        sx={{ 
                          cursor: 'pointer',
                          border: selectedPages.includes(page.pageNumber) ? 2 : 1,
                          borderColor: selectedPages.includes(page.pageNumber) ? 'primary.main' : 'divider',
                          '&:hover': { borderColor: 'primary.main' }
                        }}
                        onClick={() => togglePageSelection(page.pageNumber)}
                      >
                        <CardContent sx={{ p: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Checkbox 
                              checked={selectedPages.includes(page.pageNumber)}
                              size="small"
                              readOnly
                            />
                            <Typography variant="caption">
                              Página {page.pageNumber}
                            </Typography>
                          </Box>
                          <Box 
                            sx={{ 
                              width: '100%', 
                              height: 200, 
                              overflow: 'hidden',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              backgroundColor: '#f5f5f5',
                              borderRadius: 1
                            }}
                          >
                            <img 
                              src={page.canvas} 
                              alt={`Página ${page.pageNumber}`}
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '100%',
                                objectFit: 'contain'
                              }}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </>
        )}
        
        <DocumentMetadataTable 
          document={selectedPdfDoc} 
          title="Información del documento" 
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancelar
        </Button>
        <Button 
          variant="outlined" 
          color="secondary" 
          disabled={pdfTotalPages === 0 || loadingPdf}
          onClick={handleDownloadAllSeparate}
        >
          {loadingPdf ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Procesando...
            </>
          ) : (
            `🔮 Todos separados 🔮 (${pdfTotalPages})`
          )}
        </Button>
        <Button 
          variant="outlined" 
          color="primary" 
          disabled={selectedPages.length === 0 || loadingPdf}
          onClick={handleDownloadSelectedSeparate}
        >
          {loadingPdf ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Procesando...
            </>
          ) : (
            `🎯 Separados 🎯 (${selectedPages.length})`
          )}
        </Button>
        <Button 
          variant="contained" 
          color="primary" 
          disabled={selectedPages.length === 0 || loadingPdf}
          onClick={handleSplitPdf}
        >
          {loadingPdf ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Procesando...
            </>
          ) : (
            `🤝 Juntos 🤝 (${selectedPages.length})`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default IHatePdfModal;
