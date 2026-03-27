// Función para formatear fechas a DD/MM/YYYY (formato estándar de la app)
export function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // Patrones de fecha soportados
  const patterns = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,  // DD/MM/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,   // DD-MM-YYYY
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,  // DD.MM.YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // DD/MM/YY
    /^(\d{1,2})-(\d{1,2})-(\d{2})$/,   // DD-MM-YY
    /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/  // DD.MM.YY
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const [, day, month, year] = match;
      // Convertir año corto a año completo
      const fullYear = year.length === 2 
        ? (parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year))
        : parseInt(year);
      const paddedDay = day.padStart(2, '0');
      const paddedMonth = month.padStart(2, '0');
      // Devolver año completo (DD/MM/YYYY)
      return `${paddedDay}/${paddedMonth}/${fullYear}`;
    }
  }
  
  return dateStr; // Retorna original si no coincide con ningún patrón
}

// Función para detectar fechas en texto (MEJORADA - soporta todos los formatos)
export function detectDatesInText(text) {
  if (!text) return [];
  
  const dates = [];
  const foundDates = new Set();
  
  // Limpiar texto
  let cleanText = text.replace(/\s+/g, ' ').trim();
  
  // Patrones de detección (ordenados por especificidad)
  const patterns = [
    // Formato español completo: "DD de mes de YYYY" o "DD de mes de YY"
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+de\s+(\d{2,4})\b/gi,
    
    // Formato español corto: "DD mes YYYY"
    /\b(\d{1,2})\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+(\d{2,4})\b/gi,
    
    // Formato ISO: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
    /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g,
    
    // Formato numérico: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, etc.
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(cleanText)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch && !foundDates.has(fullMatch)) {
        foundDates.add(fullMatch);
        dates.push(fullMatch);
      }
    }
  });
  
  // Eliminar duplicados y formatear
  const uniqueDates = [...new Set(dates)];
  const formattedDates = [];
  uniqueDates.forEach(dateStr => {
    const formattedDate = formatDate(dateStr.trim());
    if (formattedDate && !formattedDates.includes(formattedDate)) {
      formattedDates.push(formattedDate);
    }
  });
  
  return formattedDates;
}

// Función para separar rangos de fechas
export function separateDateRanges(text) {
  if (!text) return [];
  
  const allDates = [];
  const processedRanges = new Set();
  
  // Patrón para detectar rangos de fechas
  const rangePattern = /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*(?:a|al|-)\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/gi;
  
  // Procesar rangos primero
  let match;
  while ((match = rangePattern.exec(text)) !== null) {
    const startDate = match[1].trim();
    const endDate = match[2].trim();
    const rangeKey = `${startDate}-${endDate}`;
    
    if (!processedRanges.has(rangeKey)) {
      processedRanges.add(rangeKey);
      
      const formattedStart = formatDate(startDate);
      const formattedEnd = formatDate(endDate);
      
      if (formattedStart && !allDates.includes(formattedStart)) {
        allDates.push(formattedStart);
      }
      if (formattedEnd && !allDates.includes(formattedEnd)) {
        allDates.push(formattedEnd);
      }
    }
  }
  
  // Procesar fechas individuales que no están en rangos
  const individualDates = detectDatesInText(text);
  individualDates.forEach(date => {
    if (!allDates.includes(date)) {
      allDates.push(date);
    }
  });
  
  return allDates;
}
