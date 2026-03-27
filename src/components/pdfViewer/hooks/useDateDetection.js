import { useState, useEffect } from 'react';
import { separateDateRanges } from '../utils/dateUtils.js';

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

export function useDateDetection(pdf, page, textContent) {
  const [detectedDates, setDetectedDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateRects, setDateRects] = useState([]);

  // Detectar fechas cuando cambia el texto del PDF
  useEffect(() => {
    if (textContent) {
      console.log('🔍 Analizando texto para fechas:', textContent.substring(0, 200) + '...');
      const dates = separateDateRanges(textContent);
      setDetectedDates(dates);
      console.log('📅 Fechas detectadas:', dates);
    } else {
      setDetectedDates([]);
    }
  }, [textContent]);

  // Limpiar selección cuando cambia la página
  useEffect(() => {
    setSelectedDate(null);
    setDateRects([]);
  }, [page]);

  const handleDateClick = (date) => {
    const formattedDate = formatDateToDDMMAA(date);
    setSelectedDate(formattedDate);
    console.log('📅 Fecha seleccionada:', formattedDate);
  };

  const handleCanvasClick = (e, canvasRef) => {
    if (!canvasRef.current || dateRects.length === 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calcular escalado
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    console.log('🖱️ Click en coordenadas:', { x, y });
    console.log('📏 Escalado:', { scaleX, scaleY });
    console.log('🎯 Coordenadas del canvas:', { canvasX, canvasY });
    console.log('📐 Rectángulos de fechas:', dateRects);

    // Verificar si el click está dentro de algún rectángulo de fecha (usando coordenadas extendidas)
    for (const dateRect of dateRects) {
      console.log('🔍 Verificando rectángulo:', dateRect);
      
      // Usar las coordenadas extendidas para la detección de clics
      const extendedX1 = Math.max(0, dateRect.x1 - 20);
      const extendedX2 = dateRect.x2 + 20;
      const extendedY1 = dateRect.y1;
      const extendedY2 = dateRect.y2 + Math.max(0, 8 - (dateRect.y2 - dateRect.y1));
      
      console.log('📏 Coordenadas extendidas:', { extendedX1, extendedX2, extendedY1, extendedY2 });
      
      if (canvasX >= extendedX1 && canvasX <= extendedX2 && 
          canvasY >= extendedY1 && canvasY <= extendedY2) {
        console.log('✅ Fecha clickeada:', dateRect.date);
        handleDateClick(dateRect.date);
        return;
      }
    }
    
    console.log('❌ No se clickeó en ninguna fecha');
  };

  return {
    detectedDates,
    selectedDate,
    dateRects,
    setDateRects,
    handleDateClick,
    handleCanvasClick
  };
}
