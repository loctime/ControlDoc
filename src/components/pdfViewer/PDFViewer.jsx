import React, { useState, useEffect } from 'react';
import { Box, Tabs, Tab, Paper, Alert, Typography, Chip, Button } from '@mui/material';
import { useSearchHistory } from '../../hooks/useSearchHistory.js';
import { usePDFRendering } from './hooks/usePDFRendering.js';
import { useDateDetection } from './hooks/useDateDetection.js';
import { useFileUrl } from '../../hooks/useFileUrl.js';
import SearchBar from './components/SearchBar.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import DocumentMetadata from './components/DocumentMetadata.jsx';
import AllPagesModal from './components/AllPagesModal.jsx';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9]/g, '');      // elimina todo lo que no sea letra o número
}

// Función para formatear fecha a DD/MM/AA
function formatDateToDDMMAA(dateString) {
  if (!dateString) return '';
  try {
    const cleanDate = dateString.replace(/\s+/g, ' ').trim();
    let date = null;
    
    // Intentar parsear fecha en español (DD de mes de YYYY)
    const spanishDateMatch = cleanDate.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
    if (spanishDateMatch) {
      const [, day, month, year] = spanishDateMatch;
      const monthNames = { 
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
      };
      const monthIndex = monthNames[month.toLowerCase()];
      if (monthIndex !== undefined) { 
        date = new Date(parseInt(year), monthIndex, parseInt(day)); 
      }
    }
    
    // Intentar parsear fecha numérica (DD/MM/YYYY o DD-MM-YYYY)
    if (!date) {
      const numericMatch = cleanDate.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
      if (numericMatch) { 
        const [, day, month, year] = numericMatch; 
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day)); 
      }
    }
    
    // Intentar parsear fecha con año corto (DD/MM/YY)
    if (!date) {
      const shortYearMatch = cleanDate.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})/);
      if (shortYearMatch) { 
        const [, day, month, year] = shortYearMatch; 
        const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year); 
        date = new Date(fullYear, parseInt(month) - 1, parseInt(day)); 
      }
    }
    
    if (date && !isNaN(date)) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${day}/${month}/${year}`;
    }
    
    return dateString;
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return dateString;
  }
}

// Visor alternativo simple usando iframe
function SimplePDFViewer({ fileURL }) {
  return (
    <Box sx={{ width: '100%', height: '75vh', border: '1px solid var(--info-main)', borderRadius: 1 }}>
      <iframe
        src={fileURL}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '4px'
        }}
        title="Visor PDF"
        onError={(e) => {
          console.error('Error cargando PDF en iframe:', e);
        }}
      />
    </Box>
  );
}

export default function PDFViewer({
  fileURL,
  fileId,
  onApprove,
  onReject,
  onDownload,
  documentId,
  // Metadata del documento
  uploadedAt,
  uploadedByEmail,
  companyComment,
  adminComment,
  companyName,
  entityName,
  status
}) {
  const resolvedUrl = useFileUrl({ fileId, fileURL });
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [textContent, setTextContent] = useState('');
  const [showAllPagesModal, setShowAllPagesModal] = useState(false);
  const [pdfjsEnabled, setPdfjsEnabled] = useState(false);
  const advancedPdfGroupingEnabled = import.meta.env.VITE_ADVANCED_PDF_GROUPING_ENABLED === 'true';
  
  // Obtener PDFJS_ENABLED dinámicamente para evitar carga estática
  useEffect(() => {
    import('../../config/pdfConfig.js').then(module => {
      setPdfjsEnabled(module.PDFJS_ENABLED);
    }).catch(err => {
      console.error('Error cargando pdfConfig:', err);
      setPdfjsEnabled(false);
    });
  }, []);
  
  // Hooks personalizados (solo si PDF.js está habilitado)
  const { canvasRef, pdf, page, numPages, loading, error, setPage, renderPage } = pdfjsEnabled ? usePDFRendering(resolvedUrl) : {
    canvasRef: { current: null },
    pdf: null,
    page: 1,
    numPages: 0,
    loading: false,
    error: pdfjsEnabled ? null : 'PDF.js está temporalmente desactivado',
    setPage: () => {},
    renderPage: async () => {}
  };
  const { detectedDates, selectedDate, dateRects, setDateRects, handleDateClick, handleCanvasClick } = pdfjsEnabled ? useDateDetection(pdf, page, textContent) : {
    detectedDates: [],
    selectedDate: null,
    dateRects: [],
    setDateRects: () => {},
    handleDateClick: () => {},
    handleCanvasClick: () => {}
  };
  const { topSearches, recordSearch } = useSearchHistory();

  // Extraer texto del PDF (solo si PDF.js está habilitado)
  useEffect(() => {
    if (!pdfjsEnabled || !pdf || !page) return;

    const extractText = async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        const content = await pdfPage.getTextContent();
        const text = content.items.map(item => item.str).join(' ');
        setTextContent(text);
        console.log('📝 Texto extraído del PDF:', text.substring(0, 200) + '...');
      } catch (error) {
        console.error('Error extrayendo texto:', error);
      }
    };

    extractText();
  }, [pdf, page, pdfjsEnabled]);

  // Buscar texto en el PDF (solo si PDF.js está habilitado)
  const searchInPDF = async (searchQuery) => {
    if (!pdfjsEnabled || !pdf || !searchQuery.trim()) {
      setMatches([]);
      return;
    }

    try {
      const pdfPage = await pdf.getPage(page);
      const content = await pdfPage.getTextContent();
      const textItems = content.items;
      const foundMatches = [];

      textItems.forEach((item, idx) => {
        const normalizedText = normalize(item.str);
        const normalizedQuery = normalize(searchQuery);
        
        if (normalizedText.includes(normalizedQuery)) {
          foundMatches.push({
            item,
            index: idx,
            text: item.str
          });
        }
      });

      setMatches(foundMatches);
    } catch (error) {
      console.error('Error buscando en PDF:', error);
      setMatches([]);
    }
  };

  // Manejar cambios en la búsqueda
  const handleQueryChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    if (value.trim() && pdfjsEnabled) {
      searchInPDF(value);
    } else {
      setMatches([]);
    }
  };

  // Manejar teclas
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      recordSearch(query);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setQuery('');
      setMatches([]);
    }
  };

  // Seleccionar búsqueda popular
  const handleTopSearchSelect = (word) => {
    setQuery(word);
    if (pdfjsEnabled) {
      searchInPDF(word);
    }
    recordSearch(word);
  };

  // Calcular rectángulos de fechas cuando cambian las fechas detectadas (solo si PDF.js está habilitado)
  useEffect(() => {
    if (!pdfjsEnabled || !pdf || !page || detectedDates.length === 0) {
      setDateRects([]);
      return;
    }

    const calculateDateRects = async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        const content = await pdfPage.getTextContent();
        const textItems = content.items;
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        const newDateRects = [];

        // Crear texto completo concatenado para búsqueda
        const fullText = textItems.map(item => item.str).join(' ');
        console.log('📝 Texto completo para búsqueda:', fullText.substring(0, 100) + '...');
        
        detectedDates.forEach(date => {
          console.log(`🔍 Buscando fecha: "${date}"`);
          
          // Normalizar espacios en ambos textos para comparar
          const normalizedDate = date.replace(/\s+/g, ' ').trim();
          const normalizedFullText = fullText.replace(/\s+/g, ' ').trim();
          
          console.log(`🔍 Buscando fecha completa en texto: "${normalizedDate}"`);
          
          let foundDate = false;
          let dateIndex = -1;
          let foundItems = [];
          
          // Primero intentar búsqueda exacta
          if (normalizedFullText.includes(normalizedDate)) {
            console.log(`✅ Fecha completa encontrada en texto concatenado`);
            dateIndex = normalizedFullText.indexOf(normalizedDate);
            foundDate = true;
          } else {
            // Buscar formatos alternativos
            console.log(`🔍 Buscando formatos alternativos para: "${normalizedDate}"`);
            
            // Generar posibles formatos alternativos
            const possibleFormats = [];
            
            // Si es formato DD/MM/YY, generar DD-MM-YYYY, DD.MM.YYYY, etc.
            if (normalizedDate.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
              const [day, month, year] = normalizedDate.split('/');
              const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
              // Agregar formato con año completo usando el mismo separador
              possibleFormats.push(`${day}/${month}/${fullYear}`);
              possibleFormats.push(`${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`);
              possibleFormats.push(`${day}-${month}-${fullYear}`);
              possibleFormats.push(`${day}.${month}.${fullYear}`);
              possibleFormats.push(`${day.padStart(2, '0')}-${month.padStart(2, '0')}-${fullYear}`);
              possibleFormats.push(`${day.padStart(2, '0')}.${month.padStart(2, '0')}.${fullYear}`);
            }
            
            // Si es formato DD/MM/YYYY, generar DD-MM-YYYY, DD.MM.YYYY, etc.
            if (normalizedDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              const [day, month, year] = normalizedDate.split('/');
              possibleFormats.push(`${day}-${month}-${year}`);
              possibleFormats.push(`${day}.${month}.${year}`);
              possibleFormats.push(`${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`);
              possibleFormats.push(`${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`);
            }
            
            // Buscar en formatos alternativos
            for (const altFormat of possibleFormats) {
              if (normalizedFullText.includes(altFormat)) {
                console.log(`✅ Fecha encontrada en formato alternativo: "${altFormat}"`);
                dateIndex = normalizedFullText.indexOf(altFormat);
                foundDate = true;
                break;
              }
            }
          }
          
          if (foundDate) {
            console.log(`📍 Posición de la fecha: ${dateIndex}`);
            
            // LÓGICA 1: Búsqueda directa en cada item (para fechas numéricas)
            for (let i = 0; i < textItems.length; i++) {
              const item = textItems[i];
              const itemText = item.str;
              
              // Buscar la fecha directamente en el texto del item
              if (itemText.includes(normalizedDate)) {
                foundItems.push({ item, index: i, text: itemText });
                console.log(`📄 Fecha encontrada directamente en item ${i}: "${itemText}"`);
              } else {
                // Buscar formatos alternativos en el item
                const possibleFormats = [];
                
                // Si es formato DD/MM/YY, generar formatos alternativos
                if (normalizedDate.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
                  const [day, month, year] = normalizedDate.split('/');
                  const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
                  // Agregar formato con año completo usando el mismo separador
                  possibleFormats.push(`${day}/${month}/${fullYear}`);
                  possibleFormats.push(`${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`);
                  possibleFormats.push(`${day}-${month}-${fullYear}`);
                  possibleFormats.push(`${day}.${month}.${fullYear}`);
                  possibleFormats.push(`${day.padStart(2, '0')}-${month.padStart(2, '0')}-${fullYear}`);
                  possibleFormats.push(`${day.padStart(2, '0')}.${month.padStart(2, '0')}.${fullYear}`);
                }
                
                // Si es formato DD/MM/YYYY, generar formatos alternativos
                if (normalizedDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                  const [day, month, year] = normalizedDate.split('/');
                  possibleFormats.push(`${day}-${month}-${year}`);
                  possibleFormats.push(`${day}.${month}.${year}`);
                  possibleFormats.push(`${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`);
                  possibleFormats.push(`${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`);
                }
                
                // Si es formato en español (DD de mes de YYYY), buscar variaciones
                if (normalizedDate.match(/^\d{1,2}\s+de\s+\w+\s+de\s+\d{4}$/)) {
                  // Buscar la fecha con espacios múltiples (como viene del PDF)
                  const dateWithMultipleSpaces = normalizedDate.replace(/\s+/g, '   ');
                  if (itemText.includes(dateWithMultipleSpaces)) {
                    foundItems.push({ item, index: i, text: itemText, matchedFormat: dateWithMultipleSpaces });
                    console.log(`📄 Fecha encontrada en formato con espacios múltiples en item ${i}: "${itemText}" (formato: ${dateWithMultipleSpaces})`);
                    break;
                  }
                  
                  // Buscar la fecha normalizada (espacios simples)
                  const dateNormalized = normalizedDate.replace(/\s+/g, ' ').trim();
                  if (itemText.includes(dateNormalized)) {
                    foundItems.push({ item, index: i, text: itemText, matchedFormat: dateNormalized });
                    console.log(`📄 Fecha encontrada en formato normalizado en item ${i}: "${itemText}" (formato: ${dateNormalized})`);
                    break;
                  }
                }
                
                // Buscar formatos alternativos en el item
                for (const altFormat of possibleFormats) {
                  if (itemText.includes(altFormat)) {
                    foundItems.push({ item, index: i, text: itemText, matchedFormat: altFormat });
                    console.log(`📄 Fecha encontrada en formato alternativo en item ${i}: "${itemText}" (formato: ${altFormat})`);
                    break;
                  }
                }
              }
            }
            
            // LÓGICA 2: Si no se encontró con búsqueda directa, usar la lógica original (para fechas en español)
            if (foundItems.length === 0) {
              console.log(`🔍 No se encontró con búsqueda directa, usando lógica original para: "${normalizedDate}"`);
              
              // Encontrar qué items contienen la fecha usando posiciones
              let currentPos = 0;
              
              for (let i = 0; i < textItems.length; i++) {
                const item = textItems[i];
                const itemText = item.str;
                const itemStart = currentPos;
                const itemEnd = currentPos + itemText.length;
                
                // Verificar si la fecha está en este rango de items
                if (dateIndex >= itemStart && dateIndex < itemEnd) {
                  foundItems.push({ item, index: i, start: itemStart, end: itemEnd });
                  console.log(`📄 Fecha encontrada en item ${i} (lógica original): "${itemText}"`);
                }
                
                currentPos += itemText.length + 1; // +1 por el espacio
              }
            }
            
            // Si encontramos items que contienen la fecha, crear rectángulo individual
            if (foundItems.length > 0) {
              const firstItem = foundItems[0].item;
              const [a, b, c, d, e, f] = firstItem.transform;
              const itemText = firstItem.str;
              const itemWidth = firstItem.width;
              const itemHeight = firstItem.height || Math.abs(d);
              
              // Calcular posición exacta de la fecha dentro del item
              let dateInItem = normalizedDate;
              let dateStartInItem = itemText.indexOf(dateInItem);
              
              // Si no se encuentra directamente, usar el formato alternativo encontrado
              if (dateStartInItem === -1 && foundItems[0].matchedFormat) {
                dateInItem = foundItems[0].matchedFormat;
                dateStartInItem = itemText.indexOf(dateInItem);
              }
              
              if (dateStartInItem !== -1) {
                // Medir ancho del texto antes de la fecha
                const preText = itemText.substring(0, dateStartInItem);
                const dateText = dateInItem;
                
                // Crear contexto temporal para medir texto
                let preWidth = 0;
                let dateWidth = 0;
                
                if (typeof document !== 'undefined') {
                  const tempCanvas = document.createElement('canvas');
                  const tempCtx = tempCanvas.getContext('2d');
                  tempCtx.font = `${Math.abs(d)}px sans-serif`;
                  preWidth = tempCtx.measureText(preText).width;
                  dateWidth = tempCtx.measureText(dateText).width;
                } else {
                  preWidth = preText.length * (Math.abs(d) * 0.6);
                  dateWidth = dateText.length * (Math.abs(d) * 0.6);
                }
                
                // Calcular coordenadas exactas de la fecha
                const dateX1 = e + (preWidth / itemWidth) * itemWidth;
                const dateX2 = dateX1 + (dateWidth / itemWidth) * itemWidth;
                
                const rect = [dateX1, f, dateX2, f - itemHeight];
                const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
                
                console.log(`📐 Rectángulo individual para fecha: x1=${x1}, y1=${y1}, x2=${x2}, y2=${y2}`);
                
                newDateRects.push({
                  date,
                  x1, y1, x2, y2,
                  isSelected: selectedDate === date
                });
              } else {
                // Fallback: usar todo el item si no se puede calcular posición exacta
                const rect = [e, f, e + itemWidth, f - itemHeight];
                const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
                
                console.log(`📐 Rectángulo fallback para fecha: x1=${x1}, y1=${y1}, x2=${x2}, y2=${y2}`);
                
                newDateRects.push({
                  date,
                  x1, y1, x2, y2,
                  isSelected: selectedDate === date
                });
              }
            }
          } else {
            console.log(`❌ Fecha completa no encontrada en texto concatenado`);
          }
        });
        
        setDateRects(newDateRects);
        console.log('📐 Rectángulos de fechas calculados:', newDateRects);
      } catch (error) {
        console.error('Error calculando rectángulos de fechas:', error);
      }
    };

    calculateDateRects();
  }, [pdf, page, detectedDates, selectedDate, pdfjsEnabled]);

  // Renderizar página con búsquedas y fechas (con debounce, solo si PDF.js está habilitado)
  useEffect(() => {
    if (!pdfjsEnabled || !pdf || !page) return;

    const timeoutId = setTimeout(() => {
      renderPage(page, query, matches, dateRects);
    }, 100); // Debounce de 100ms

    return () => clearTimeout(timeoutId);
  }, [pdf, page, query, matches, dateRects, pdfjsEnabled]);

  // Manejar click en canvas para fechas (solo si PDF.js está habilitado)
  const handleCanvasClickEvent = (e) => {
    if (pdfjsEnabled) {
      handleCanvasClick(e, canvasRef);
    }
  };

  // Manejar mostrar todas las páginas
  const handleShowAllPages = () => {
    if (advancedPdfGroupingEnabled && pdfjsEnabled) {
      setShowAllPagesModal(true);
    }
  };

  // Manejar selección de página desde el modal
  const handlePageSelect = (pageNum) => {
    if (pdfjsEnabled) {
      setPage(pageNum);
    }
  };

  // Manejar selección de fecha desde el modal
  const handleDateSelect = (date) => {
    const formattedDate = formatDateToDDMMAA(date);
    if (pdfjsEnabled) {
      handleDateClick(formattedDate);
    }
    console.log('📅 Fecha seleccionada desde modal:', formattedDate);
  };

  if (loading && pdfjsEnabled) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Cargando PDF...</Typography>
      </Box>
    );
  }

  if (error && pdfjsEnabled) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Tabs value={tab} onChange={(e, newValue) => setTab(newValue)} sx={{ minHeight: 'auto' }}>
            <Tab label="Archivo original" sx={{ minHeight: 'auto', py: 0.5, fontSize: '0.8rem' }} />
            {pdfjsEnabled && <Tab label="Modo texto" sx={{ minHeight: 'auto', py: 0.5, fontSize: '0.8rem' }} />}
          </Tabs>
          
          {/* Metadata del documento en la misma fila */}
          <DocumentMetadata
            uploadedAt={uploadedAt}
            uploadedByEmail={uploadedByEmail}
            companyComment={companyComment}
            adminComment={adminComment}
            companyName={companyName}
            status={status}
          />
        </Box>
        
        {tab === 0 ? (
          <>
            {!pdfjsEnabled && (
              <Alert severity="info" sx={{ mb: 2 }}>
                PDF.js está temporalmente desactivado. Puede ver el documento usando el visor simple o abrirlo en una nueva pestaña.
              </Alert>
            )}

            {/* Barra de búsqueda (solo si PDF.js está habilitado) */}
            {pdfjsEnabled && (
              <SearchBar
                query={query}
                onQueryChange={handleQueryChange}
                onKeyPress={handleKeyPress}
                onKeyDown={handleKeyDown}
                matches={matches}
                topSearches={topSearches}
                onTopSearchSelect={handleTopSearchSelect}
              />
            )}

            {/* Panel de control */}
            <ControlPanel
              page={page}
              numPages={pdfjsEnabled ? numPages : 1}
              onPageChange={pdfjsEnabled ? setPage : () => {}}
              selectedDate={selectedDate}
              onApprove={onApprove}
              onReject={onReject}
              onDownload={onDownload}
              documentId={documentId}
              fileURL={resolvedUrl}
              onShowAllPages={pdfjsEnabled && advancedPdfGroupingEnabled ? handleShowAllPages : null}
            />

            {/* Visor PDF */}
            {pdfjsEnabled ? (
              <>
                {/* Canvas del PDF */}
                <canvas 
                  ref={canvasRef} 
                  style={{ 
                    border: '1px solid var(--info-main)', 
                    width: '100%', 
                    cursor: dateRects.length > 0 ? 'pointer' : 'default'
                  }}
                  onClick={handleCanvasClickEvent}
                />

                {/* Fechas detectadas */}
                {detectedDates.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Fechas detectadas:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {detectedDates.map((date, index) => (
                        <Chip
                          key={index}
                          label={date}
                          size="small"
                          variant="outlined"
                          color={selectedDate === date ? 'primary' : 'default'}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </>
            ) : (
              /* Visor alternativo con iframe */
              <Box sx={{ mt: 2 }}>
                <SimplePDFViewer fileURL={resolvedUrl} />
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Button
                    variant="outlined"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => window.open(resolvedUrl, '_blank')}
                    sx={{ mr: 1 }}
                  >
                    Abrir en nueva pestaña
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={onDownload}
                  >
                    Descargar PDF
                  </Button>
                </Box>
              </Box>
            )}
          </>
        ) : (
          /* Modo texto (solo si PDF.js está habilitado) */
          pdfjsEnabled && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                {textContent || 'Cargando texto...'}
              </Typography>
            </Box>
          )
        )}
      </Paper>

      {/* Modal de todas las páginas (solo si PDF.js está habilitado) */}
      {pdfjsEnabled && advancedPdfGroupingEnabled && (
        <AllPagesModal
          open={showAllPagesModal}
          onClose={() => setShowAllPagesModal(false)}
          fileURL={resolvedUrl}
          numPages={numPages}
          onPageSelect={handlePageSelect}
          onDateSelect={handleDateSelect}
          // Metadata del documento original
          documentId={documentId}
          uploadedAt={uploadedAt}
          uploadedByEmail={uploadedByEmail}
          companyComment={companyComment}
          adminComment={adminComment}
          companyName={companyName}
          entityName={entityName}
          status={status}
        />
      )}
    </Box>
  );
}
