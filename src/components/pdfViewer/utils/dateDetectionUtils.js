import { separateDateRanges } from './dateUtils.js';

/**
 * Función mejorada para extraer fechas del texto (corrige problemas de extracción)
 */
export const extractDatesFromText = (text) => {
  if (!text) return [];
  
  // Limpiar y normalizar el texto
  let cleanText = text.replace(/\s+/g, ' ').trim();
  
  // Corregir meses que se extraen incorrectamente con espacios
  cleanText = cleanText
    .replace(/\bju\s+lio\b/gi, 'julio')
    .replace(/\benero\b/gi, 'enero')
    .replace(/\bfebrero\b/gi, 'febrero')
    .replace(/\bmarzo\b/gi, 'marzo')
    .replace(/\babril\b/gi, 'abril')
    .replace(/\bmayo\b/gi, 'mayo')
    .replace(/\bjunio\b/gi, 'junio')
    .replace(/\bagosto\b/gi, 'agosto')
    .replace(/\bseptiembre\b/gi, 'septiembre')
    .replace(/\boctubre\b/gi, 'octubre')
    .replace(/\bnoviembre\b/gi, 'noviembre')
    .replace(/\bdiciembre\b/gi, 'diciembre');
  
  console.log(`🔧 Texto original: ${text.substring(0, 100)}...`);
  console.log(`🔧 Texto normalizado: ${cleanText.substring(0, 100)}...`);
  
  // Usar la función original con el texto corregido
  return separateDateRanges(cleanText);
};

/**
 * Mapeo de meses en español (completo y abreviado)
 */
const MONTH_NAMES = {
  'enero': 0, 'ene': 0,
  'febrero': 1, 'feb': 1,
  'marzo': 2, 'mar': 2,
  'abril': 3, 'abr': 3,
  'mayo': 4, 'may': 4,
  'junio': 5, 'jun': 5,
  'julio': 6, 'jul': 6,
  'agosto': 7, 'ago': 7,
  'septiembre': 8, 'sep': 8, 'setiembre': 8,
  'octubre': 9, 'oct': 9,
  'noviembre': 10, 'nov': 10,
  'diciembre': 11, 'dic': 11
};

/**
 * Función robusta para parsear cualquier formato de fecha y convertir a Date
 * Soporta: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD de mes de YYYY, etc.
 */
export const parseAnyDateFormat = (dateString) => {
  if (!dateString) return null;
  
  try {
    let cleanDate = dateString.toString().replace(/\s+/g, ' ').trim();
    
    // Corregir meses con espacios incorrectos
    cleanDate = cleanDate
      .replace(/\bju\s+lio\b/gi, 'julio')
      .replace(/\benero\b/gi, 'enero')
      .replace(/\bfebrero\b/gi, 'febrero')
      .replace(/\bmarzo\b/gi, 'marzo')
      .replace(/\babril\b/gi, 'abril')
      .replace(/\bmayo\b/gi, 'mayo')
      .replace(/\bjunio\b/gi, 'junio')
      .replace(/\bagosto\b/gi, 'agosto')
      .replace(/\bseptiembre\b/gi, 'septiembre')
      .replace(/\boctubre\b/gi, 'octubre')
      .replace(/\bnoviembre\b/gi, 'noviembre')
      .replace(/\bdiciembre\b/gi, 'diciembre');
    
    let day, month, year;
    let date = null;
    
    // 1. Formato español: "DD de mes de YYYY" o "DD de mes de YY"
    const spanishFullMatch = cleanDate.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{2,4})/i);
    if (spanishFullMatch) {
      [, day, monthName, yearStr] = spanishFullMatch;
      const monthIndex = MONTH_NAMES[monthName.toLowerCase()];
      if (monthIndex !== undefined) {
        year = yearStr.length === 2 
          ? (parseInt(yearStr) < 50 ? 2000 + parseInt(yearStr) : 1900 + parseInt(yearStr))
          : parseInt(yearStr);
        date = new Date(year, monthIndex, parseInt(day));
      }
    }
    
    // 2. Formato español sin "de": "DD mes YYYY"
    if (!date) {
      const spanishShortMatch = cleanDate.match(/(\d{1,2})\s+(\w+)\s+(\d{2,4})/i);
      if (spanishShortMatch) {
        [, day, monthName, yearStr] = spanishShortMatch;
        const monthIndex = MONTH_NAMES[monthName.toLowerCase()];
        if (monthIndex !== undefined) {
          year = yearStr.length === 2 
            ? (parseInt(yearStr) < 50 ? 2000 + parseInt(yearStr) : 1900 + parseInt(yearStr))
            : parseInt(yearStr);
          date = new Date(year, monthIndex, parseInt(day));
        }
      }
    }
    
    // 3. Formato ISO: YYYY-MM-DD o YYYY/MM/DD o YYYY.MM.DD
    if (!date) {
      const isoMatch = cleanDate.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (isoMatch) {
        [, year, month, day] = isoMatch;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }
    
    // 4. Formato numérico con separadores: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, etc.
    if (!date) {
      const numericMatch = cleanDate.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
      if (numericMatch) {
        let [part1, part2, yearStr] = numericMatch.slice(1);
        year = yearStr.length === 2 
          ? (parseInt(yearStr) < 50 ? 2000 + parseInt(yearStr) : 1900 + parseInt(yearStr))
          : parseInt(yearStr);
        
        // Detectar si es formato americano (MM/DD) o europeo (DD/MM)
        const num1 = parseInt(part1);
        const num2 = parseInt(part2);
        
        if (num1 > 12 && num2 <= 12) {
          // DD/MM/YYYY
          day = num1;
          month = num2;
        } else if (num2 > 12 && num1 <= 12) {
          // MM/DD/YYYY
          day = num2;
          month = num1;
        } else if (num1 <= 12 && num2 <= 12) {
          // Ambos podrían ser mes, usar heurística: asumir DD/MM (formato más común en español)
          day = num1;
          month = num2;
        } else {
          // Ambos > 12, usar el primero como día
          day = num1;
          month = num2;
        }
        
        date = new Date(year, parseInt(month) - 1, parseInt(day));
      }
    }
    
    // Validar que la fecha sea válida
    if (date && !isNaN(date.getTime())) {
      // Validar rango razonable (1900-2100)
      const year = date.getFullYear();
      if (year >= 1900 && year <= 2100) {
        return date;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parseando fecha:', error, dateString);
    return null;
  }
};

/**
 * Función para formatear fecha a DD/MM/YYYY (formato estándar de la app)
 * Ahora soporta todos los formatos posibles
 */
export const formatDateToDDMMAA = (dateString) => {
  if (!dateString) return '';
  
  // Si ya está en formato DD/MM/YYYY, retornarlo
  if (typeof dateString === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return dateString;
  }
  
  // Intentar parsear con la función robusta
  const date = parseAnyDateFormat(dateString);
  
  if (date && !isNaN(date.getTime())) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // Fallback: retornar original si no se pudo parsear
  return dateString;
};

/**
 * Función para validar formato de fecha (actualizada)
 */
export const isValidDateFormat = (dateString) => {
  if (!dateString) return false;
  return parseAnyDateFormat(dateString) !== null;
};

/**
 * Función para obtener el índice (orden) del cuadradito seleccionado
 */
export const getDateIndexInPage = async (pdfjsLib, fileURL, pageNum, date, formatDateToDDMMAA, extractDatesFromText) => {
  try {
    const pdf = await pdfjsLib.getDocument(fileURL).promise;
    const pdfPage = await pdf.getPage(pageNum);
    const textContent = await pdfPage.getTextContent();
    const fullText = textContent.items.map(item => item.str).join(' ');
    const dates = extractDatesFromText(fullText);
    
    console.log(`🔍 Buscando índice para fecha ${date} en página ${pageNum}`);
    console.log(`📝 Fechas detectadas en orden:`, dates.map(d => formatDateToDDMMAA(d)));
    
    // Buscar el índice de la fecha en la lista ordenada
    for (let i = 0; i < dates.length; i++) {
      const formattedDate = formatDateToDDMMAA(dates[i]);
      if (formattedDate === date) {
        console.log(`📍 Fecha ${date} encontrada en índice ${i} (cuadradito ${i + 1})`);
        return i;
      }
    }
    
    console.log(`⚠️ No se encontró índice para fecha ${date} en página ${pageNum}`);
    return null;
  } catch (error) {
    console.error(`Error obteniendo índice de fecha en página ${pageNum}:`, error);
    return null;
  }
};

/**
 * Función para obtener la fecha por índice en una página
 */
export const getDateByIndex = async (pdfjsLib, fileURL, pageNum, index, formatDateToDDMMAA, extractDatesFromText) => {
  try {
    const pdf = await pdfjsLib.getDocument(fileURL).promise;
    const pdfPage = await pdf.getPage(pageNum);
    const textContent = await pdfPage.getTextContent();
    const fullText = textContent.items.map(item => item.str).join(' ');
    
    let dates = extractDatesFromText(fullText);
    
    if (dates.length === 0) {
      console.log(`🔍 No se detectaron fechas en página ${pageNum}, intentando detección agresiva...`);
      const aggressiveDates = detectDatesAggressively(fullText);
      if (aggressiveDates.length > 0) {
        console.log(`✅ Detección agresiva encontró ${aggressiveDates.length} fechas en página ${pageNum}:`, aggressiveDates);
        dates = aggressiveDates.map(date => new Date(date)); // Convertir a Date para consistencia
      }
    }
    
    console.log(`📝 Fechas detectadas en página ${pageNum}:`, dates.map(d => formatDateToDDMMAA(d)));
    
    if (index >= 0 && index < dates.length) {
      const date = formatDateToDDMMAA(dates[index]);
      console.log(`📍 Fecha en índice ${index} de página ${pageNum}: ${date}`);
      return date;
    } else {
      console.log(`⚠️ Índice ${index} fuera de rango en página ${pageNum} (${dates.length} fechas disponibles)`);
      return null;
    }
  } catch (error) {
    console.error(`Error obteniendo fecha por índice en página ${pageNum}:`, error);
    return null;
  }
};

/**
 * Función para detección agresiva de fechas con patrones más amplios
 */
export const detectDatesAggressively = (text) => {
  const dates = [];
  
  // Patrones más amplios para detectar fechas
  const patterns = [
    // DD/MM/YYYY o DD/MM/YY
    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/g,
    // DD de mes de YYYY (en español)
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})\b/gi,
    // DD-MM-YYYY
    /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/g,
    // DD.MM.YYYY
    /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g,
    // Solo números que podrían ser fechas (más permisivo)
    /\b(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})\b/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0] && match[0].trim()) {
        dates.push(match[0].trim());
      }
    }
  });
  
  // Eliminar duplicados y filtrar fechas válidas
  const uniqueDates = [...new Set(dates)].filter(date => {
    // Verificar que la fecha sea razonable (año entre 1900 y 2100)
    const yearMatch = date.match(/(\d{2,4})/);
    if (yearMatch) {
      let year = parseInt(yearMatch[1]);
      if (year < 100) year += 2000; // Convertir años de 2 dígitos
      return year >= 1900 && year <= 2100;
    }
    return false;
  });
  
  console.log(`🔍 Detección agresiva encontrada ${uniqueDates.length} fechas:`, uniqueDates);
  return uniqueDates;
};
