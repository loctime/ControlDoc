/**
 * Construye un nombre de archivo de descarga en el formato:
 * [companyName]_[documentName]_[entityType]_[entityName (opcional)].pdf
 * 
 * Ejemplo:
 * - PACHAMAMA_Patente_vehicle_fiat_uno_wer_444.pdf
 * - PACHAMAMA_CUIT_company.pdf
 */

export const buildDownloadName = (doc) => {
    if (!doc) return 'documento.pdf';
  
    const clean = (text) =>
      String(text || '')
        .normalize('NFD') // elimina acentos
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^\w\-]/g, '');
  
    const company = clean(doc.companyName || 'SIN_EMPRESA');
    const client = doc.clientName ? clean(doc.clientName) : null;
    const name = clean(doc.name || doc.documentName || doc.fileName?.split('.')[0] || 'Documento');
    const entityType = clean(doc.entityType || 'sin_tipo');
    const entityName = ['employee', 'vehicle'].includes(entityType.toLowerCase())
      ? clean(doc.entityName || '')
      : null;
  
    const baseNameParts = [company];
    if (client) baseNameParts.push(client);
    baseNameParts.push(name, entityType);
    if (entityName) baseNameParts.push(entityName);
  
    const baseName = baseNameParts.join('_');
  
    // Intentar obtener extensión real
    const extractExt = (fileNameOrUrl) => {
      const match = fileNameOrUrl?.match(/\.(\w+)(\?.*)?$/);
      return match ? match[1].toLowerCase() : 'pdf'; // fallback en pdf
    };
  
    const ext =
      extractExt(doc.fileName) ||
      extractExt(doc.fileURL) ||
      'pdf';
  
    return `${baseName}.${ext}`;
  };