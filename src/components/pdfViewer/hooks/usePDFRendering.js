import { useState, useEffect, useRef } from 'react';

export function usePDFRendering(fileURL) {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const [pdfjsEnabled, setPdfjsEnabled] = useState(false);
  const [pdfjsLib, setPdfjsLib] = useState(null);

  // Cargar pdfConfig dinámicamente
  useEffect(() => {
    import('../../../config/pdfConfig.js').then(module => {
      setPdfjsEnabled(module.PDFJS_ENABLED);
      setPdfjsLib(module.pdfjsLib);
    }).catch(err => {
      console.error('Error cargando pdfConfig:', err);
      setPdfjsEnabled(false);
      setPdfjsLib(null);
    });
  }, []);

  // Si PDF.js está desactivado, mostrar error y no cargar nada
  useEffect(() => {
    if (!pdfjsEnabled) {
      setError('PDF.js está temporalmente desactivado. Use el botón de descarga para ver el documento.');
      setLoading(false);
      return;
    }

    if (!fileURL || !pdfjsLib) {
      setError('PDF.js no está disponible');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    pdfjsLib.getDocument(fileURL).promise
      .then(pdfDoc => {
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setPage(1);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error cargando PDF:', err);
        setError('Error al cargar el PDF');
        setLoading(false);
      });
  }, [fileURL, pdfjsEnabled, pdfjsLib]);

  // Renderizar página
  const renderPage = async (pageNum, query = '', matches = [], dateRects = []) => {
    if (!pdfjsEnabled || !pdfjsLib) {
      setError('PDF.js está temporalmente desactivado');
      return;
    }

    if (!pdf || !canvasRef.current || isRendering) return;

    setIsRendering(true);
    try {
      const pdfPage = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const viewport = pdfPage.getViewport({ scale: 1.5 });
      
      // Cancelar renderizado anterior si existe
      if (pdfPage._renderTask) {
        pdfPage._renderTask.cancel();
      }

      // Limpiar canvas antes de renderizar
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Establecer dimensiones del canvas
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Renderizar página
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      const renderTask = pdfPage.render(renderContext);
      await renderTask.promise;

      // Resaltar búsquedas
      if (query && matches.length > 0) {
        const content = await pdfPage.getTextContent();
        const textItems = content.items;
        
        matches.forEach((match, matchIndex) => {
          textItems.forEach((item, idx) => {
            if (item.str.includes(query)) {
              const [a, b, c, d, e, f] = item.transform;
              const width = item.width;
              const height = item.height || Math.abs(d);
              
              const rect = [e, f, e + width, f - height];
              const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
              
              ctx.save();
              ctx.beginPath();
              ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
              ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
              ctx.restore();
            }
          });
        });
      }

      // Resaltar fechas detectadas
      if (dateRects.length > 0) {
        console.log('🎨 Dibujando fechas:', dateRects.length, 'rectángulos');
        dateRects.forEach((dateRect, index) => {
          console.log(`🎨 Dibujando fecha ${index + 1}:`, dateRect);
          ctx.save();
          ctx.beginPath();
          
          // Calcular dimensiones del rectángulo
          const rectWidth = dateRect.x2 - dateRect.x1;
          const rectHeight = dateRect.y2 - dateRect.y1;
          
          // Hacer el subrayado más largo (extender 20px a cada lado)
          const extendedX1 = Math.max(0, dateRect.x1 - 20);
          const extendedX2 = dateRect.x2 + 20;
          const extendedWidth = extendedX2 - extendedX1;
          
          // Hacer el subrayado más alto (mínimo 8px de altura)
          const minHeight = 8;
          const extendedY1 = dateRect.y1;
          const extendedY2 = dateRect.y2 + Math.max(0, minHeight - rectHeight);
          const extendedHeight = extendedY2 - extendedY1;
          
          if (dateRect.isSelected) {
            // Fecha seleccionada: verde
            ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 4; // Más grueso
          } else {
            // Fecha normal: amarillo
            ctx.fillStyle = 'rgba(255, 193, 7, 0.3)';
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 3; // Más grueso
          }
          
          // Dibujar rectángulo extendido
          ctx.fillRect(extendedX1, extendedY1, extendedWidth, extendedHeight);
          ctx.strokeRect(extendedX1, extendedY1, extendedWidth, extendedHeight);
          ctx.restore();
        });
      } else {
        console.log('❌ No hay rectángulos de fechas para dibujar');
      }

    } catch (error) {
      console.error('Error renderizando página:', error);
      setError('Error al renderizar la página');
    } finally {
      setIsRendering(false);
    }
  };

  return {
    canvasRef,
    pdf,
    page,
    numPages,
    loading,
    error,
    setPage,
    renderPage
  };
}
