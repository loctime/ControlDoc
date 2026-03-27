/**
 * Utilidades para renderizado de fechas en PDFs
 */

/**
 * Renderiza una página PDF con fechas subrayadas
 */
export const renderPageWithDates = async (pdfPage, viewport, dates, selectedDate = null) => {
  console.log('🎨 Iniciando renderPageWithDates con fechas:', dates);
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
  console.log('🎨 Página renderizada, calculando fechas...');

  // Calcular rectángulos de fechas y subrayarlas
  const content = await pdfPage.getTextContent();
  const textItems = content.items;
  const newDateRects = [];

  console.log('🔍 Renderizando página con fechas:', dates);

  // Usar la misma lógica que funciona en PDFViewer principal
  const fullText = textItems.map(item => item.str).join(' ');
  console.log('📝 Texto completo para búsqueda:', fullText.substring(0, 100) + '...');
  
  dates.forEach(date => {
    console.log(`🔍 Buscando fecha en modal: "${date}"`);
    
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
      const possibleFormats = generatePossibleFormats(normalizedDate);
      
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
      foundItems = findDateItems(textItems, normalizedDate, dateIndex);
      
      // Procesar los items encontrados
      if (foundItems.length > 0) {
        const rect = calculateDateRect(foundItems[0], viewport, normalizedDate);
        if (rect) {
          newDateRects.push({
            date,
            ...rect,
            isSelected: selectedDate === date
          });
        }
      }
    } else {
      console.log(`❌ Fecha completa no encontrada en texto concatenado`);
    }
  });

  console.log('📐 Rectángulos calculados:', newDateRects);

  // Dibujar subrayados
  drawDateRects(ctx, newDateRects);

  console.log('🎨 Rectángulos guardados:', newDateRects);
  
  // Guardar canvas para mostrar
  const dataURL = canvas.toDataURL('image/png');
  return { dataURL, canvas, ctx, dateRects: newDateRects };
};

/**
 * Genera formatos posibles de una fecha
 */
const generatePossibleFormats = (date) => {
  const formats = [];
  
  // Si es formato DD/MM/YY, generar DD-MM-YYYY, DD.MM.YYYY, etc.
  if (date.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
    const [day, month, year] = date.split('/');
    const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
    // Agregar formato con año completo usando el mismo separador
    formats.push(`${day}/${month}/${fullYear}`);
    formats.push(`${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`);
    formats.push(`${day}-${month}-${fullYear}`);
    formats.push(`${day}.${month}.${fullYear}`);
    formats.push(`${day.padStart(2, '0')}-${month.padStart(2, '0')}-${fullYear}`);
    formats.push(`${day.padStart(2, '0')}.${month.padStart(2, '0')}.${fullYear}`);
  }
  
  // Si es formato DD/MM/YYYY, generar DD-MM-YYYY, DD.MM.YYYY, etc.
  if (date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const [day, month, year] = date.split('/');
    formats.push(`${day}-${month}-${year}`);
    formats.push(`${day}.${month}.${year}`);
    formats.push(`${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`);
    formats.push(`${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`);
  }
  
  return formats;
};

/**
 * Encuentra items que contienen la fecha
 */
const findDateItems = (textItems, normalizedDate, dateIndex) => {
  const foundItems = [];
  
  // LÓGICA 1: Búsqueda directa en cada item
  for (let i = 0; i < textItems.length; i++) {
    const item = textItems[i];
    const itemText = item.str;
    
    // Buscar la fecha directamente en el texto del item
    if (itemText.includes(normalizedDate)) {
      foundItems.push({ item, index: i, text: itemText });
      console.log(`📄 Fecha encontrada directamente en item ${i}: "${itemText}"`);
    } else {
      // Buscar formatos alternativos en el item
      const possibleFormats = generatePossibleFormats(normalizedDate);
      
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
  
  // LÓGICA 2: Si no se encontró con búsqueda directa, usar la lógica original
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
  
  return foundItems;
};

/**
 * Calcula el rectángulo de una fecha
 */
const calculateDateRect = (foundItem, viewport, normalizedDate) => {
  const firstItem = foundItem.item;
  const itemText = firstItem.str;
  const [a, b, c, d, e, f] = firstItem.transform;
  const itemWidth = firstItem.width;
  const itemHeight = firstItem.height || Math.abs(d);
  
  // Calcular posición exacta de la fecha dentro del item
  let dateInItem = normalizedDate;
  let dateStartInItem = itemText.indexOf(dateInItem);
  
  // Si no se encuentra directamente, usar el formato alternativo encontrado
  if (dateStartInItem === -1 && foundItem.matchedFormat) {
    dateInItem = foundItem.matchedFormat;
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
    
    console.log(`📐 Rectángulo individual para fecha en modal: x1=${x1}, y1=${y1}, x2=${x2}, y2=${y2}`);
    
    return { x1, y1, x2, y2 };
  } else {
    // Fallback: usar todo el item si no se puede calcular posición exacta
    const rect = [e, f, e + itemWidth, f - itemHeight];
    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
    
    console.log(`📐 Rectángulo fallback para fecha en modal: x1=${x1}, y1=${y1}, x2=${x2}, y2=${y2}`);
    
    return { x1, y1, x2, y2 };
  }
};

/**
 * Dibuja los rectángulos de fechas en el canvas
 */
const drawDateRects = (ctx, dateRects) => {
  dateRects.forEach((dateRect) => {
    console.log('🎨 Dibujando rectángulo:', dateRect);
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
      ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 4; // Más grueso
    } else {
      ctx.fillStyle = 'rgba(255, 193, 7, 0.3)';
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 3; // Más grueso
    }
    
    // Dibujar rectángulo extendido
    ctx.fillRect(extendedX1, extendedY1, extendedWidth, extendedHeight);
    ctx.strokeRect(extendedX1, extendedY1, extendedWidth, extendedHeight);
    ctx.restore();
  });
};
