import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Stack,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import { ZoomIn, ZoomOut, Fullscreen, FullscreenExit, Search } from '@mui/icons-material';
import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { drawOCRHighlights } from '../../utils/drawOCRHighlights';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import TopSearchesButtons from './TopSearchesButtons';
import SearchStats from './SearchStats';
import { extractDatesFromText, formatDateToDDMMAA } from '../pdfViewer/utils/dateDetectionUtils';

export default function ImageViewerWithSearch({ 
  fileURL, 
  fileName,
  sx = {},
  showControls = true,
  maxHeight = '75vh',
  onDateSelect // Callback cuando se selecciona una fecha
}) {
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [tab, setTab] = useState(0);
  const [ocrData, setOcrData] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [imgObj, setImgObj] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [urlAccessible, setUrlAccessible] = useState(null);
  const [detectedDates, setDetectedDates] = useState([]);
  const [dateRects, setDateRects] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Hook para historial de búsquedas
  const { recordSearch } = useSearchHistory();

  // Función para seleccionar búsqueda desde los botones
  const handleTopSearchSelect = (word) => {
    setSearchQuery(word);
  };

  // Resetear estado cuando cambie la URL
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setRetryCount(0);
    setIsRetrying(false);
    setOcrData(null);
    setOcrError('');
    
    // Verificar si la URL es válida antes de intentar cargar
    if (fileURL) {
      console.log('🔍 Verificando URL de imagen:', fileURL);
      // Verificar que la URL tenga el formato correcto
      if (!fileURL.startsWith('http')) {
        console.error('❌ URL inválida:', fileURL);
        setImageError(true);
        return;
      }
      
      // Verificar accesibilidad de la URL
      checkUrlAccessibility();
    }
  }, [fileURL]);

  // Verificar accesibilidad de la URL
  const checkUrlAccessibility = async () => {
    if (!fileURL) return;
    
    try {
      setUrlAccessible(null);
      console.log('🔍 Verificando accesibilidad de URL...');
      
      // Pequeño delay para dar tiempo a que Backblaze procese el archivo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await fetch(fileURL, { 
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        console.log('✅ URL accesible');
        setUrlAccessible(true);
      } else {
        console.log('❌ URL no accesible:', response.status, response.statusText);
        setUrlAccessible(false);
        setImageError(true);
      }
    } catch (error) {
      console.log('❌ Error verificando URL:', error.message);
      setUrlAccessible(false);
      setImageError(true);
    }
  };

  // Cargar datos OCR cuando la imagen esté lista
  useEffect(() => {
    if (imageLoaded && fileURL && !ocrData) {
      loadOCRData();
    }
  }, [imageLoaded, fileURL, ocrData]);

  // Detectar fechas cuando cambian los datos OCR
  useEffect(() => {
    if (ocrData?.text) {
      const dates = extractDatesFromText(ocrData.text);
      setDetectedDates(dates);
      console.log('📅 Fechas detectadas en imagen:', dates);
    } else {
      setDetectedDates([]);
    }
  }, [ocrData]);

  // Función para encontrar la primera palabra que contiene parte de una fecha
  const findWordForDate = (dateString, words) => {
    if (!dateString || !words || words.length === 0) return null;
    
    // Normalizar la fecha para buscar (sin espacios, solo números y separadores)
    const normalizedDate = dateString.replace(/\s+/g, '').toLowerCase();
    
    // Buscar palabras que contengan partes de la fecha
    for (const word of words) {
      if (!word.text || !word.bbox) continue;
      
      const wordText = word.text.replace(/\s+/g, '').toLowerCase();
      
      // Buscar si la palabra contiene el inicio de la fecha (primeros 2-3 caracteres)
      if (normalizedDate.length >= 2) {
        const dateStart = normalizedDate.substring(0, 2);
        if (wordText.includes(dateStart)) {
          return word;
        }
      }
      
      // También buscar si la palabra contiene cualquier parte numérica de la fecha
      const dateNumbers = normalizedDate.match(/\d+/g);
      if (dateNumbers) {
        for (const num of dateNumbers) {
          if (wordText.includes(num) && num.length >= 2) {
            return word;
          }
        }
      }
    }
    
    return null;
  };

  // Función para dibujar rectángulos de fechas
  const drawDateRects = (ctx, dates, ocrData, imgObj, drawWidth, drawHeight, offsetX, offsetY, selectedDate) => {
    if (!dates || dates.length === 0 || !ocrData?.words) return;
    
    const scaleX = drawWidth / imgObj.naturalWidth;
    const scaleY = drawHeight / imgObj.naturalHeight;
    const newDateRects = [];
    
    dates.forEach((date, index) => {
      const formattedDate = formatDateToDDMMAA(date);
      const word = findWordForDate(formattedDate, ocrData.words);
      
      if (!word || !word.bbox) {
        console.log(`⚠️ No se encontró palabra para fecha: ${formattedDate}`);
        return;
      }
      
      // Ajustar coordenadas al canvas
      const x0 = word.bbox.x0 * scaleX + offsetX;
      const y0 = word.bbox.y0 * scaleY + offsetY;
      const height = (word.bbox.y1 - word.bbox.y0) * scaleY;
      
      // Calcular ancho del texto de la fecha usando measureText
      ctx.save();
      ctx.font = `${Math.max(12, height * 0.8)}px sans-serif`;
      const dateWidth = ctx.measureText(formattedDate).width;
      ctx.restore();
      
      const x1 = x0 + dateWidth;
      const y1 = y0 + height;
      
      const isSelected = selectedDate === formattedDate;
      
      // Guardar rectángulo para detección de clicks
      newDateRects.push({
        date: formattedDate,
        x0, y0, x1, y1,
        isSelected
      });
      
      // Dibujar rectángulo
      ctx.save();
      if (isSelected) {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
      } else {
        ctx.fillStyle = 'rgba(255, 193, 7, 0.3)';
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 2;
      }
      
      // Extender el rectángulo un poco para facilitar el click
      const extendedX0 = Math.max(0, x0 - 10);
      const extendedX1 = x1 + 10;
      const extendedY0 = y0;
      const extendedY1 = y1 + Math.max(0, 8 - height);
      
      ctx.fillRect(extendedX0, extendedY0, extendedX1 - extendedX0, extendedY1 - extendedY0);
      ctx.strokeRect(extendedX0, extendedY0, extendedX1 - extendedX0, extendedY1 - extendedY0);
      ctx.restore();
    });
    
    setDateRects(newDateRects);
  };

  // Manejar click en canvas para fechas
  const handleCanvasClick = (e) => {
    if (!canvasRef.current || dateRects.length === 0) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calcular escalado
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    console.log('🖱️ Click en imagen:', { x, y, canvasX, canvasY });
    console.log('📐 Rectángulos de fechas:', dateRects);
    
    // Verificar si el click está dentro de algún rectángulo de fecha
    for (const dateRect of dateRects) {
      const extendedX0 = Math.max(0, dateRect.x0 - 10);
      const extendedX1 = dateRect.x1 + 10;
      const extendedY0 = dateRect.y0;
      const extendedY1 = dateRect.y1 + Math.max(0, 8 - (dateRect.y1 - dateRect.y0));
      
      if (canvasX >= extendedX0 && canvasX <= extendedX1 && 
          canvasY >= extendedY0 && canvasY <= extendedY1) {
        console.log('✅ Fecha clickeada:', dateRect.date);
        setSelectedDate(dateRect.date);
        
        // Llamar callback si existe
        if (onDateSelect) {
          onDateSelect(dateRect.date);
        }
        
        return;
      }
    }
    
    console.log('❌ No se clickeó en ninguna fecha');
  };

  const loadOCRData = async () => {
    setOcrLoading(true);
    setOcrError('');
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/analyze-file`,
        { fileURL },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      setOcrData(response.data);
      console.log('✅ Datos OCR cargados:', response.data);
    } catch (error) {
      console.warn('⚠️ Error al cargar OCR:', error.message);
      setOcrError('No se pudo cargar el análisis de texto');
    } finally {
      setOcrLoading(false);
    }
  };

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

  const handleImageLoad = () => {
    console.log('✅ Imagen cargada exitosamente');
    setImageLoaded(true);
    setImageError(false);
    setRetryCount(0); // Reset retry count on successful load
    setIsRetrying(false);
    
    // Cargar imagen para canvas
    const img = new window.Image();
    img.onload = () => {
      setImgObj(img);
      setImgSize({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
      setImgLoaded(true);
    };
    img.onerror = () => {
      console.warn('⚠️ Error al cargar imagen para canvas');
      setImgLoaded(true);
    };
    img.src = fileURL;
  };

  const handleImageError = (e) => {
    console.log('❌ Error al cargar imagen:', {
      fileURL,
      fileName,
      error: e,
      target: e.target,
      retryCount
    });
    
    // Intentar reintento automático hasta 3 veces
    if (retryCount < 3 && !isRetrying) {
      console.log(`🔄 Reintentando carga de imagen (${retryCount + 1}/3)...`);
      setIsRetrying(true);
      setRetryCount(prev => prev + 1);
      
      // Reintentar después de un breve delay
      setTimeout(() => {
        if (imgRef.current) {
          imgRef.current.src = fileURL + '?retry=' + Date.now();
        }
        setIsRetrying(false);
      }, 1000 * (retryCount + 1)); // Delay progresivo: 1s, 2s, 3s
    } else {
      setImageError(true);
      setImageLoaded(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Realizar búsqueda en tiempo real
    if (query.trim() && ocrData?.words) {
      const queryLower = query.toLowerCase();
      const results = ocrData.words.filter(word => {
        const wordText = word.text?.toLowerCase() || '';
        // Buscar en la palabra completa
        if (wordText.includes(queryLower)) return true;
        // Buscar también en el texto completo del OCR si existe
        return false;
      });
      setSearchResults(results);
      console.log('🔍 Búsqueda:', query, 'Resultados:', results.length, 'Total palabras OCR:', ocrData.words.length);
      
      // Si no hay resultados en palabras individuales, verificar en texto completo
      if (results.length === 0 && ocrData.text) {
        const textLower = ocrData.text.toLowerCase();
        if (textLower.includes(queryLower)) {
          console.log('✅ Texto encontrado en texto completo OCR');
          // Aquí podríamos buscar todas las palabras que estén cerca del término buscado
          // Por ahora, solo confirmamos que existe
          return;
        }
      }
    } else {
      setSearchResults([]);
    }
  };

  // Renderizar imagen con resaltado en canvas
  useEffect(() => {
    if (!imgObj || !imgLoaded || !canvasRef.current || tab !== 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    // Configurar canvas
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Calcular dimensiones de la imagen para ajustar al contenedor
    const imgAspectRatio = imgObj.naturalWidth / imgObj.naturalHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (imgAspectRatio > containerAspectRatio) {
      // Imagen más ancha que el contenedor
      drawWidth = containerWidth;
      drawHeight = containerWidth / imgAspectRatio;
      offsetX = 0;
      offsetY = (containerHeight - drawHeight) / 2;
    } else {
      // Imagen más alta que el contenedor
      drawHeight = containerHeight;
      drawWidth = containerHeight * imgAspectRatio;
      offsetX = (containerWidth - drawWidth) / 2;
      offsetY = 0;
    }

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar imagen centrada y escalada
    ctx.drawImage(imgObj, offsetX, offsetY, drawWidth, drawHeight);

    // Aplicar resaltado si hay búsqueda
    if (searchQuery && searchQuery.trim() && ocrData?.words) {
      // Verificar palabras con bbox
      const wordsWithBbox = ocrData.words.filter(word => word.bbox);
      
      if (wordsWithBbox.length > 0) {
        // Ajustar coordenadas de las palabras para el nuevo escalado
        const adjustedWords = wordsWithBbox.map(word => {
          // Calcular escalas
          const scaleX = drawWidth / imgObj.naturalWidth;
          const scaleY = drawHeight / imgObj.naturalHeight;
          
          return {
            ...word,
            bbox: {
              x0: word.bbox.x0 * scaleX + offsetX,
              y0: word.bbox.y0 * scaleY + offsetY,
              x1: word.bbox.x1 * scaleX + offsetX,
              y1: word.bbox.y1 * scaleY + offsetY,
              width: (word.bbox.x1 - word.bbox.x0) * scaleX,
              height: (word.bbox.y1 - word.bbox.y0) * scaleY
            }
          };
        });
        
        const matches = drawOCRHighlights(ctx, adjustedWords, canvas.width, canvas.height, searchQuery);
        setMatchCount(matches);
      } else {
        setMatchCount(0);
      }
    } else {
      setMatchCount(0);
    }

    // Dibujar rectángulos de fechas detectadas
    if (detectedDates.length > 0 && ocrData?.words && ocrData?.text) {
      drawDateRects(ctx, detectedDates, ocrData, imgObj, drawWidth, drawHeight, offsetX, offsetY, selectedDate);
    }
  }, [imgObj, imgLoaded, searchQuery, ocrData, tab, scale, detectedDates, selectedDate]);

  // Guardar palabra buscada
  const saveSearchTerm = async (term) => {
    if (!term.trim()) return;
    
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        console.warn('⚠️ Usuario no autenticado, no se puede guardar búsqueda');
        return;
      }
      
      const token = await user.getIdToken();
      
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/search-history`,
        { 
          searchTerm: term,
          fileName: fileName,
          fileURL: fileURL
        },
        {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 5000
        }
      );
      console.log('✅ Palabra buscada guardada:', term);
    } catch (error) {
      console.warn('⚠️ Error al guardar búsqueda:', error.message);
    }
  };

  if (imageError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="body2">
          ❌ No se pudo cargar la imagen
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          URL: {fileURL}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Archivo: {fileName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Reintentos: {retryCount}/3
        </Typography>
        {urlAccessible === false && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 1 }}>
            ⚠️ La URL no es accesible (posible problema de CORS o archivo no encontrado)
          </Typography>
        )}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
             {/* Campo de búsqueda */}
       {imageLoaded && (
         <Box sx={{ mb: 2 }}>
           <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
             <TextField
               fullWidth
               size="small"
               label="Buscar en imagen..."
               value={searchQuery}
               onChange={handleSearchChange}
               onKeyPress={(e) => {
                 if (e.key === 'Enter' && searchQuery.trim()) {
                   saveSearchTerm(searchQuery.trim());
                   recordSearch(searchQuery.trim());
                 }
               }}
               placeholder="Buscar texto en la imagen... (Enter para guardar)"
               InputProps={{
                 startAdornment: (
                   <InputAdornment position="start">
                     <Search />
                   </InputAdornment>
                 ),
               }}
               inputProps={{ 'aria-label': 'Buscar texto en imagen' }}
             />
             <SearchStats />
           </Box>
           
           {/* Palabras más buscadas */}
           <TopSearchesButtons onSearchSelect={handleTopSearchSelect} maxButtons={6} />
           
           {/* Indicador de fechas detectadas */}
           {detectedDates.length > 0 && (
             <Box sx={{ mt: 1, p: 1, bgcolor: 'info.light', borderRadius: 1, border: '1px solid', borderColor: 'info.main' }}>
               <Typography variant="caption" color="info.dark">
                 📅 {detectedDates.length} fecha{detectedDates.length > 1 ? 's' : ''} detectada{detectedDates.length > 1 ? 's' : ''}. Haz clic en una fecha para seleccionarla.
               </Typography>
             </Box>
           )}
           
           {/* Mensaje cuando no hay resultados - solo mostrar si realmente no existe en el texto */}
           {searchQuery.trim() && searchResults.length === 0 && ocrData && (
             (() => {
               // Verificar si el texto existe en alguna parte
               const queryLower = searchQuery.toLowerCase();
               const textExists = ocrData.text?.toLowerCase().includes(queryLower);
               
               // Solo mostrar error si realmente no existe
               return !textExists && (
                 <Box sx={{ mt: 1, p: 1, bgcolor: 'warning.light', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                   <Typography variant="caption" color="warning.dark">
                     ❌ No se encontraron resultados para "{searchQuery}" en esta imagen.
                   </Typography>
                 </Box>
               );
             })()
           )}
         </Box>
       )}

      {/* Tabs para imagen y texto */}
      {imageLoaded && (
        <Tabs value={tab} onChange={(_, newTab) => setTab(newTab)} sx={{ mb: 2 }}>
          <Tab label="Imagen" />
          <Tab label="Texto extraído" />
        </Tabs>
      )}

      {/* Contenido de los tabs */}
      {tab === 0 ? (
        // Tab de imagen
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
          {/* Loading indicator */}
          {!imageLoaded && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: 2,
              position: 'absolute',
              zIndex: 2
            }}>
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary">
                {urlAccessible === null ? 'Verificando URL...' : 
                 isRetrying ? `Reintentando carga... (${retryCount}/3)` : 
                 'Cargando imagen...'}
              </Typography>
            </Box>
          )}

                     {/* Imagen oculta para cargar */}
           <img
             ref={imgRef}
             src={fileURL}
             alt={fileName || 'Imagen'}
             onLoad={handleImageLoad}
             onError={handleImageError}
             style={{
               display: 'none'
             }}
           />
           
           {/* Canvas para imagen con resaltado */}
           <canvas
             ref={canvasRef}
             onClick={handleCanvasClick}
             style={{
               maxWidth: `${scale * 100}%`,
               maxHeight: `${scale * 100}%`,
               objectFit: 'contain',
               opacity: imageLoaded ? 1 : 0,
               transition: 'opacity 0.3s ease-in-out',
               cursor: dateRects.length > 0 ? 'pointer' : 'default'
             }}
           />

          {/* Controles */}
          {showControls && imageLoaded && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                display: 'flex',
                gap: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: 1,
                padding: 0.5,
                zIndex: 3
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

          {/* Indicador de zoom */}
          {imageLoaded && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: 1,
                fontSize: '0.75rem',
                zIndex: 3
              }}
            >
              Zoom: {Math.round(scale * 100)}%
            </Box>
          )}
        </Box>
      ) : (
        // Tab de texto extraído
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 2, 
            minHeight: maxHeight,
            maxHeight: maxHeight,
            overflow: 'auto'
          }}
        >
          {ocrLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary">
                Analizando texto de la imagen...
              </Typography>
            </Box>
          ) : ocrError ? (
            <Alert severity="warning">
              {ocrError}
            </Alert>
          ) : ocrData ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Texto extraído de la imagen
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem'
                }}
              >
                {ocrData.text || 'No se detectó texto en la imagen.'}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Haz clic en "Texto extraído" para analizar la imagen
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  );
}
