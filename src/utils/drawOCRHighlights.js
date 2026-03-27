// utils/drawOCRHighlights.js
export function drawOCRHighlights(ctx, words, canvasWidth, canvasHeight, search = '') {
  // Normaliza texto para comparación flexible
  const normalize = (str) =>
    str
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // solo diacríticos
      .replace(/[^a-z0-9]/g, ''); // solo letras y números

  const searchNorm = normalize(search);
  if (!searchNorm) {
    return 0;
  }

  let matchCount = 0;
  const maxMatches = 50; // Limitar para performance

  words.forEach((word, i) => {
    if (!word.bbox || matchCount >= maxMatches) return;
    
    const wordNorm = normalize(word.text);
    const idx = wordNorm.indexOf(searchNorm);
    
    if (idx === -1) return;

    matchCount++;

    // Usar las coordenadas ya ajustadas del bbox
    const x0 = word.bbox.x0;
    const y0 = word.bbox.y0;
    const x1 = word.bbox.x1;
    const y1 = word.bbox.y1;
    const width = word.bbox.width || (x1 - x0);
    const height = word.bbox.height || (y1 - y0);

    // Calcular posición del subrayado (un poco más abajo para no tapar la palabra)
    const underlineY = y1 + 4;
    const underlineHeight = Math.max(2, height * 0.15); // Subrayado más grueso

    // Dibujar borde blanco sutil primero (para contraste)
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // Borde blanco semi-transparente
    ctx.lineWidth = underlineHeight + 2; // Un poco más ancho que el subrayado principal
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.9;
    ctx.moveTo(x0, underlineY);
    ctx.lineTo(x0 + width, underlineY);
    ctx.stroke();
    ctx.restore();

    // Subrayado azul principal más fuerte
    ctx.save();
    ctx.beginPath();
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-main').trim() || '#1976d2';
    ctx.strokeStyle = primaryColor; // Color principal del tema
    ctx.lineWidth = underlineHeight;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.98; // Más opaco
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 6; // Sombra más pronunciada
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.moveTo(x0, underlineY);
    ctx.lineTo(x0 + width, underlineY);
    ctx.stroke();
    ctx.restore();
  });

  return matchCount;
}