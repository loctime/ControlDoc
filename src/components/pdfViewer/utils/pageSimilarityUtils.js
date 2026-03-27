/**
 * Función para generar hash de template de una página
 */
export const generatePageTemplateHash = async (pdfjsLib, fileURL, pageNum) => {
  try {
    const pdf = await pdfjsLib.getDocument(fileURL).promise;
    const pdfPage = await pdf.getPage(pageNum);
    const textContent = await pdfPage.getTextContent();
    
    // Crear un hash basado en la estructura del texto (sin fechas)
    const textItems = textContent.items;
    const templateText = textItems
      .map(item => {
        // Filtrar fechas y números para crear template
        let text = item.str;
        // Reemplazar fechas con placeholders
        text = text.replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, '[FECHA]');
        text = text.replace(/\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/g, '[FECHA]');
        // Reemplazar números con placeholders
        text = text.replace(/\d+/g, '[NUM]');
        return text;
      })
      .join(' ');
    
    // Normalizar caracteres especiales para evitar errores con btoa
    const normalizedText = templateText
      .normalize('NFD') // Descomponer caracteres acentuados
      .replace(/[\u0300-\u036f]/g, '') // Remover marcas diacríticas
      .replace(/[^\x00-\x7F]/g, '?'); // Reemplazar otros caracteres no ASCII
    
    // Crear hash simple basado en longitud y estructura
    const hash = btoa(normalizedText).slice(0, 20);
    return hash;
  } catch (error) {
    console.error('Error generando template hash:', error);
    return null;
  }
};

/**
 * Función para analizar similitud de páginas
 */
export const analyzePageSimilarity = async (pdfjsLib, fileURL, pages, setIsAnalyzingSimilarity, setPageTemplates, setSimilarPages) => {
  if (!pages.length) return;
  
  setIsAnalyzingSimilarity(true);
  const newTemplates = {};
  const newSimilarPages = {};
  
  try {
    // Generar templates para todas las páginas
    for (const page of pages) {
      const templateHash = await generatePageTemplateHash(pdfjsLib, fileURL, page.pageNum);
      if (templateHash) {
        newTemplates[page.pageNum] = templateHash;
      }
    }
    
    setPageTemplates(newTemplates);
    
    // Agrupar páginas por template similar
    const templateGroups = {};
    Object.entries(newTemplates).forEach(([pageNum, hash]) => {
      if (!templateGroups[hash]) {
        templateGroups[hash] = [];
      }
      templateGroups[hash].push(parseInt(pageNum));
    });
    
    // Crear mapeo de páginas similares
    Object.values(templateGroups).forEach(group => {
      if (group.length > 1) {
        group.forEach(pageNum => {
          newSimilarPages[pageNum] = group.filter(p => p !== pageNum);
        });
      }
    });
    
    setSimilarPages(newSimilarPages);
    console.log('🔍 Análisis de similitud completado:', { newTemplates, newSimilarPages });
    
  } catch (error) {
    console.error('Error analizando similitud:', error);
  } finally {
    setIsAnalyzingSimilarity(false);
  }
};
