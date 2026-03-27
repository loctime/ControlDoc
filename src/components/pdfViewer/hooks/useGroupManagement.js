import { useState } from 'react';

/**
 * Hook personalizado para manejar la lógica de agrupación de páginas
 */
export const useGroupManagement = (numPages) => {
  const [isGroupingMode, setIsGroupingMode] = useState(false);
  const [selectedPages, setSelectedPages] = useState([]);
  const [pageGroups, setPageGroups] = useState([]);
  const [nextGroupId, setNextGroupId] = useState(1);
  const [showGroupDateModal, setShowGroupDateModal] = useState(false);
  const [pendingGroup, setPendingGroup] = useState(null);

  const togglePageSelection = (pageNum) => {
    setSelectedPages(prev => 
      prev.includes(pageNum) ? prev.filter(p => p !== pageNum) : [...prev, pageNum]
    );
  };

  const handleSelectAll = () => {
    setSelectedPages(Array.from({ length: numPages }, (_, i) => i + 1));
  };

  const handleClearSelection = () => {
    setSelectedPages([]);
  };

  const handleCreateGroup = (selectedDateForPage, setSelectedDateForPage) => {
    if (selectedPages.length === 0) return;
    
    // Verificar fechas existentes en las páginas seleccionadas
    const existingDates = selectedPages
      .map(pageNum => selectedDateForPage[pageNum])
      .filter(date => date !== undefined && date !== null);
    
    // Si hay fechas existentes, verificar si son todas iguales
    const uniqueDates = [...new Set(existingDates)];
    
    if (uniqueDates.length > 1) {
      // Hay fechas diferentes - mostrar modal para seleccionar
      console.log('⚠️ Fechas diferentes detectadas. Mostrando modal de selección.');
      setPendingGroup({
        id: nextGroupId,
        name: `Grupo ${nextGroupId}`,
        pages: [...selectedPages].sort((a, b) => a - b),
        availableDates: uniqueDates
      });
      setShowGroupDateModal(true);
      return; // No crear el grupo aún, esperar selección de fecha
    }
    
    // Crear grupo automáticamente con número secuencial
    const newGroup = {
      id: nextGroupId,
      name: `Grupo ${nextGroupId}`,
      pages: [...selectedPages].sort((a, b) => a - b),
      // Si hay una fecha única, asignarla al grupo
      date: uniqueDates.length === 1 ? uniqueDates[0] : null
    };
    
    setPageGroups(prev => [...prev, newGroup]);
    setNextGroupId(prev => prev + 1);
    setSelectedPages([]);
    
    // Si hay una fecha única, asignarla al grupo en selectedDateForPage
    if (uniqueDates.length === 1) {
      const groupKey = `group-${nextGroupId}`;
      setSelectedDateForPage(prev => ({
        ...prev,
        [groupKey]: uniqueDates[0]
      }));
      console.log(`📅 Fecha asignada al grupo recién creado ${groupKey}:`, uniqueDates[0]);
    }
  };

  const handleDeleteGroup = (groupId, selectedDateForPage, setSelectedDateForPage) => {
    // Obtener las páginas del grupo que se va a eliminar
    const groupToDelete = pageGroups.find(group => group.id === groupId);
    
    if (groupToDelete) {
      // Eliminar las fechas de todas las páginas del grupo Y la fecha del grupo
      const updatedDates = { ...selectedDateForPage };
      const groupKey = `group-${groupId}`;
      delete updatedDates[groupKey]; // Eliminar fecha del grupo
      
      groupToDelete.pages.forEach(pageNum => {
        delete updatedDates[pageNum]; // Eliminar fechas individuales (por si acaso)
      });
      setSelectedDateForPage(updatedDates);
    }
    
    setPageGroups(prev => {
      const filteredGroups = prev.filter(group => group.id !== groupId);
      
      // Reorganizar IDs para que sean secuenciales (1, 2, 3, ...)
      const reorganizedGroups = filteredGroups.map((group, index) => ({
        ...group,
        id: index + 1,
        name: `Grupo ${index + 1}`
      }));
      
      // Actualizar nextGroupId para el siguiente grupo
      setNextGroupId(reorganizedGroups.length + 1);
      
      return reorganizedGroups;
    });
  };

  const getPageGroupNumber = (pageNum) => {
    const group = pageGroups.find(g => g.pages.includes(pageNum));
    return group ? group.id : null;
  };

  const updateGroupDate = (groupId, date) => {
    setPageGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, date }
        : group
    ));
  };

  const createAutoGroup = (groupData) => {
    setPageGroups(prev => [...prev, groupData]);
  };

  const createMultipleAutoGroups = (groupsData) => {
    setPageGroups(prev => [...prev, ...groupsData]);
  };

  // Función para confirmar la fecha del grupo
  const handleConfirmGroupDate = (selectedDate, setSelectedDateForPage) => {
    if (pendingGroup) {
      // Crear el grupo con la fecha seleccionada
      const newGroup = {
        id: pendingGroup.id,
        name: pendingGroup.name,
        pages: pendingGroup.pages,
        date: selectedDate
      };
      
      setPageGroups(prev => [...prev, newGroup]);
      setNextGroupId(prev => prev + 1);
      setSelectedPages([]);
      
      // Asignar la fecha al grupo en selectedDateForPage
      const groupKey = `group-${pendingGroup.id}`;
      setSelectedDateForPage(prev => ({
        ...prev,
        [groupKey]: selectedDate
      }));
      
      console.log(`📅 Grupo ${pendingGroup.id} creado con fecha seleccionada:`, selectedDate);
      
      // Limpiar estado del modal
      setPendingGroup(null);
      setShowGroupDateModal(false);
    }
  };

  // Función para cancelar la creación del grupo
  const handleCancelGroupDate = () => {
    setPendingGroup(null);
    setShowGroupDateModal(false);
    setSelectedPages([]);
  };

  return {
    isGroupingMode,
    setIsGroupingMode,
    selectedPages,
    pageGroups,
    togglePageSelection,
    handleSelectAll,
    handleClearSelection,
    handleCreateGroup,
    handleDeleteGroup,
    getPageGroupNumber,
    updateGroupDate,
    createAutoGroup,
    createMultipleAutoGroups,
    // Estados y funciones para el modal de fecha de grupo
    showGroupDateModal,
    setShowGroupDateModal,
    pendingGroup,
    handleConfirmGroupDate,
    handleCancelGroupDate
  };
};
