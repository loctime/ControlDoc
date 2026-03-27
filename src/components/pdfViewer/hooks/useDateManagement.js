import { useState } from 'react';
import { 
  formatDateToDDMMAA, 
  getDateIndexInPage,
  getDateByIndex,
  extractDatesFromText
} from '../utils/dateDetectionUtils.js';

export const useDateManagement = (fileURL, pageGroups, updateGroupDate) => {
  const [selectedDateForPage, setSelectedDateForPage] = useState({});
  const [manualDates, setManualDates] = useState({}); // Páginas con fechas manuales (protegidas)

  // Función para manejar click en fecha
  const handleDateClick = async (selectedPage, date, similarPages, pdfjsLib) => {
    const formattedDate = formatDateToDDMMAA(date);
    
    // Obtener el grupo de la página actual
    const currentPageGroup = pageGroups.find(group => group.pages.includes(selectedPage));
    
    if (currentPageGroup) {
      // Si la página pertenece a un grupo, asignar la fecha al grupo Y a las páginas individuales
      const groupKey = `group-${currentPageGroup.id}`;
      const updatedDates = { ...selectedDateForPage };
      
      // Asignar fecha al grupo
      updatedDates[groupKey] = formattedDate;
      
      // También asignar fecha a las páginas individuales del grupo (para visualización)
      currentPageGroup.pages.forEach(pageNum => {
        if (!manualDates[pageNum]) { // Solo si no es manual
          updatedDates[pageNum] = formattedDate;
        }
      });
      
      setSelectedDateForPage(updatedDates);
      
      // Actualizar la fecha del grupo
      updateGroupDate(currentPageGroup.id, formattedDate);
      
      console.log(`📅 Fecha asignada al grupo ${groupKey}:`, formattedDate, 'para páginas:', currentPageGroup.pages);
      console.log(`📅 Fechas también asignadas a páginas individuales del grupo para visualización`);
    }
    
    // SIEMPRE aplicar fechas automáticas a páginas similares (incluso si está en grupo)
    const similarPageNumbers = similarPages[selectedPage] || [];
    if (similarPageNumbers.length > 0) {
      console.log('🔄 Aplicando fechas automáticas a páginas similares...');
      await applyDateToSimilarPagesIntelligent(selectedPage, formattedDate, currentPageGroup, similarPages, pdfjsLib);
    }
    
    // Si no está en grupo, SIEMPRE asignar fecha a la página actual
    if (!currentPageGroup) {
      setSelectedDateForPage(prev => ({
        ...prev,
        [selectedPage]: formattedDate
      }));
      console.log('📅 Fecha seleccionada en modal:', formattedDate, 'para página individual:', selectedPage);
    }
  };

  // Función inteligente para aplicar fechas a páginas similares
  const applyDateToSimilarPagesIntelligent = async (pageNum, selectedDate, currentPageGroup, similarPages, pdfjsLib) => {
    const similarPageNumbers = similarPages[pageNum] || [];
    
    const updatedDates = { ...selectedDateForPage };
    const updatedManualDates = { ...manualDates };
    
    // Obtener el índice del cuadradito seleccionado en la página actual
    const selectedDateIndex = await getDateIndexInPage(pdfjsLib, fileURL, pageNum, selectedDate, formatDateToDDMMAA, extractDatesFromText);
    console.log(`📍 Cuadradito seleccionado: índice ${selectedDateIndex} (${selectedDate})`);
    
    // Para cada página similar, aplicar fecha inteligente
    for (const similarPageNum of similarPageNumbers) {
      // Saltar si tiene fecha manual (protegida)
      if (manualDates[similarPageNum]) {
        console.log(`🔒 Página ${similarPageNum} tiene fecha manual protegida, se omite`);
        continue;
      }
      
      // Verificar si la página similar está en un grupo
      const similarPageGroup = pageGroups.find(group => group.pages.includes(similarPageNum));
      
      if (similarPageGroup) {
        // La página similar está en un grupo
        const groupKey = `group-${similarPageGroup.id}`;
        
        // Solo asignar si el grupo NO tiene fecha ya
        if (!selectedDateForPage[groupKey]) {
          // USAR LA FECHA EXACTA QUE EL USUARIO SELECCIONÓ (no buscar en el grupo)
          updatedDates[groupKey] = selectedDate;
          updateGroupDate(similarPageGroup.id, selectedDate);
          
          // También asignar a las páginas individuales del grupo (para visualización)
          similarPageGroup.pages.forEach(pageNum => {
            if (!manualDates[pageNum]) { // Solo si no es manual
              updatedDates[pageNum] = selectedDate;
            }
          });
          
          console.log(`📅 Fecha asignada al grupo ${groupKey}:`, selectedDate, '(fecha seleccionada por usuario)');
          console.log(`📅 Fechas también asignadas a páginas individuales del grupo para visualización`);
        } else {
          console.log(`⏭️ Grupo ${groupKey} ya tiene fecha, se omite`);
        }
      } else {
        // La página similar NO está en grupo - asignar individual
        if (!selectedDateForPage[similarPageNum]) {
          try {
            const dateAtSameIndex = await getDateByIndex(pdfjsLib, fileURL, similarPageNum, selectedDateIndex, formatDateToDDMMAA, extractDatesFromText);
            if (dateAtSameIndex) {
              updatedDates[similarPageNum] = dateAtSameIndex;
              console.log(`📅 Fecha del cuadradito ${selectedDateIndex} en página ${similarPageNum}:`, dateAtSameIndex);
            }
          } catch (error) {
            console.error(`Error detectando fecha en página ${similarPageNum}:`, error);
          }
        } else {
          console.log(`⏭️ Página ${similarPageNum} ya tiene fecha, se omite`);
        }
      }
    }
    
    setSelectedDateForPage(updatedDates);
    setManualDates(updatedManualDates);
    console.log(`📅 Fechas finales aplicadas (inteligente):`, updatedDates);
  };

  // Función para aplicar fecha manual
  const handleApplyManualDate = (selectedPage, manualDateInput) => {
    if (!manualDateInput.trim()) return;
    
    const formattedDate = formatDateToDDMMAA(manualDateInput);
    if (formattedDate) {
      const updatedDates = { ...selectedDateForPage };
      updatedDates[selectedPage] = formattedDate;
      setSelectedDateForPage(updatedDates);
      
      // Marcar página como manual (protegida)
      const updatedManualDates = { ...manualDates };
      updatedManualDates[selectedPage] = true;
      setManualDates(updatedManualDates);
      
      console.log(`📅 Fecha manual aplicada a página ${selectedPage}:`, formattedDate, '🔒 [PROTEGIDA]');
      
      return true; // Indica que se aplicó correctamente
    }
    return false;
  };

  // Función para eliminar fecha de página
  const removeDateFromPage = (pageNum) => {
    const updatedDates = { ...selectedDateForPage };
    delete updatedDates[pageNum];
    
    // Si la página está en un grupo, también eliminar la fecha del grupo
    const pageGroup = pageGroups.find(group => group.pages.includes(pageNum));
    if (pageGroup) {
      const groupKey = `group-${pageGroup.id}`;
      delete updatedDates[groupKey];
      updateGroupDate(pageGroup.id, null);
      console.log(`📅 Fecha eliminada del grupo ${groupKey} y páginas individuales`);
    }
    
    setSelectedDateForPage(updatedDates);
    
    // Eliminar marca manual también
    const updatedManualDates = { ...manualDates };
    delete updatedManualDates[pageNum];
    setManualDates(updatedManualDates);
  };

  return {
    selectedDateForPage,
    setSelectedDateForPage,
    manualDates,
    setManualDates,
    handleDateClick,
    handleApplyManualDate,
    removeDateFromPage
  };
};
