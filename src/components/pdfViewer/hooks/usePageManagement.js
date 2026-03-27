import { useState, useEffect } from 'react';
import { extractDatesFromText } from '../utils/dateDetectionUtils.js';
import { renderPageWithDates } from '../utils/dateRenderingUtils.js';

/**
 * Hook personalizado para manejar la lógica de páginas PDF
 */
export const usePageManagement = (fileURL, numPages, open) => {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pdfjsLib, setPdfjsLib] = useState(null);
  const [pdfjsEnabled, setPdfjsEnabled] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const [selectedPageData, setSelectedPageData] = useState(null);
  const [detectedDates, setDetectedDates] = useState([]);
  const [dateRects, setDateRects] = useState([]);

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

  // Generar páginas cuando se abre el modal
  useEffect(() => {
    if (!open || !fileURL || !numPages || !pdfjsEnabled || !pdfjsLib) {
      setPages([]);
      return;
    }
  }, [open, fileURL, numPages]);

  const loadAllPages = async () => {
    if (!fileURL) return;

    setLoading(true);
    setError(null);

    try {
      const pdf = await pdfjsLib.getDocument(fileURL).promise;
      const pagePromises = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        pagePromises.push(renderPage(pdf, pageNum));
      }

      const renderedPages = await Promise.all(pagePromises);
      setPages(renderedPages);
    } catch (err) {
      console.error('Error cargando páginas:', err);
      setError('Error al cargar las páginas del PDF');
    } finally {
      setLoading(false);
    }
  };

  const renderPage = async (pdf, pageNum) => {
    try {
      const pdfPage = await pdf.getPage(pageNum);
      const viewport = pdfPage.getViewport({ scale: 0.5 }); // Escala pequeña para vista previa
      
      // Crear canvas temporal
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Renderizar página
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      await pdfPage.render(renderContext).promise;

      return {
        pageNum,
        dataURL: canvas.toDataURL('image/png'),
        width: viewport.width,
        height: viewport.height
      };
    } catch (error) {
      console.error(`Error renderizando página ${pageNum}:`, error);
      return {
        pageNum,
        dataURL: null,
        error: true
      };
    }
  };

  const handlePageClick = async (pageNum) => {
    setSelectedPage(pageNum);
    
    // Cargar la página en grande y detectar fechas
    try {
      const pdf = await pdfjsLib.getDocument(fileURL).promise;
      const pdfPage = await pdf.getPage(pageNum);
      const viewport = pdfPage.getViewport({ scale: 2.0 }); // Escala más grande para mejor visualización
      
      // Extraer texto para detectar fechas
      const textContent = await pdfPage.getTextContent();
      const fullText = textContent.items.map(item => item.str).join(' ');
      const dates = extractDatesFromText(fullText);
      setDetectedDates(dates);
      
      // Renderizar página con fechas subrayadas
      const result = await renderPageWithDates(pdfPage, viewport, dates);
      setSelectedPageData({ 
        dataURL: result.dataURL, 
        canvas: result.canvas, 
        ctx: result.ctx 
      });
      setDateRects(result.dateRects);
    } catch (error) {
      console.error('Error cargando página:', error);
    }
  };

  const closePageView = () => {
    setSelectedPage(null);
    setSelectedPageData(null);
    setDetectedDates([]);
    setDateRects([]);
  };

  return {
    pages,
    loading,
    error,
    selectedPage,
    selectedPageData,
    detectedDates,
    dateRects,
    handlePageClick,
    closePageView
  };
};
