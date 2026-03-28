import { useState } from 'react';
import { 
  collection, 
  addDoc, 
  getDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../../config/firebaseconfig.js';
import { getTenantCollectionPath, getCurrentTenantId } from '../../../utils/tenantUtils.js';
import { uploadToControlFile, buildControlFilePath, getDownloadUrl } from '../../../utils/ControlFileStorage.js';

export default function useBatchApproval() {
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [selectedExpirationDate, setSelectedExpirationDate] = useState('');

  // Función para calcular elementos a aprobar
  const calculateItemsToApprove = (selectedDateForPage, pageGroups) => {
    const itemsToApprove = [];
    const processedPages = new Set();
    
    // Primero agregar grupos
    pageGroups.forEach(group => {
      const groupKey = `group-${group.id}`;
      if (selectedDateForPage[groupKey]) {
        itemsToApprove.push(groupKey);
        // Marcar páginas del grupo como procesadas
        group.pages.forEach(pageNum => processedPages.add(pageNum));
      }
    });
    
    // Luego agregar páginas individuales que no estén en grupos
    Object.keys(selectedDateForPage).forEach(key => {
      if (key.startsWith('group-')) return; // Ya procesado arriba
      
      const pageNum = parseInt(key);
      if (!processedPages.has(pageNum)) {
        itemsToApprove.push(key);
      }
    });
    
    return itemsToApprove;
  };

  // Función para aprobación masiva
  const handleBatchApprove = (selectedDateForPage, pageGroups) => {
    const itemsToApprove = calculateItemsToApprove(selectedDateForPage, pageGroups);
    
    if (itemsToApprove.length === 0) return;

    // Confirmación antes de procesar
    const confirmed = window.confirm(
      `¿Está seguro de aprobar ${itemsToApprove.length} páginas/grupos con las fechas seleccionadas?`
    );
    
    if (!confirmed) return;

    // Mostrar modal para seleccionar fecha de vencimiento del documento requerido
    setShowExpirationModal(true);
    return itemsToApprove;
  };

  // Función para confirmar la aprobación masiva
  const handleConfirmBatchApprove = async (
    itemsToApprove, 
    selectedDateForPage, 
    pageGroups, 
    documentId,
    fileURL,
    uploadedAt,
    uploadedByEmail,
    companyComment,
    adminComment,
    companyName,
    entityName,
    status,
    onClose,
    onDateSelect
  ) => {
    if (!selectedExpirationDate) {
      alert('Por favor seleccione una fecha de vencimiento para el documento requerido.');
      return;
    }

    console.log(`🎯 Elementos a aprobar (sin duplicados): ${itemsToApprove.length}`, itemsToApprove);
    
    setIsProcessingBatch(true);
    setProcessingProgress({ current: 0, total: itemsToApprove.length });
    setShowExpirationModal(false);

    try {
      // Obtener datos del usuario actual para aprobadoPor
      const { auth } = await import('../../../config/firebaseconfig.js');
      const currentUser = auth.currentUser;
      const currentUserData = currentUser ? {
        uid: currentUser.uid,
        email: currentUser.email || '',
        realemail: currentUser.displayName || currentUser.email || '',
        getToken: async () => await currentUser.getIdToken()
      } : {
        uid: 'unknown',
        email: 'unknown@approval.com',
        realemail: 'unknown@approval.com',
        getToken: async () => ''
      };
      
      console.log('🚀 Iniciando aprobación masiva de', itemsToApprove.length, 'elementos');
      
      // Obtener información del documento original para metadata base
      const originalDocumentData = await getOriginalDocumentData(documentId, fileURL, uploadedAt, uploadedByEmail, companyComment, adminComment, companyName, entityName, status);
      
      // Obtener la versión base para esta entidad/empresa
      const baseVersion = await getBaseVersionForDocument(originalDocumentData);
      
      // Ordenar elementos por fecha de vencimiento (más antigua primero)
      const sortedItems = itemsToApprove.map(itemKey => ({
        itemKey,
        expirationDate: selectedDateForPage[itemKey]
      })).sort((a, b) => {
        // Convertir fechas DD/MM/YY a Date para comparar
        const parseDate = (dateStr) => {
          const [day, month, year] = dateStr.split('/').map(Number);
          return new Date(2000 + year, month - 1, day);
        };
        return parseDate(a.expirationDate) - parseDate(b.expirationDate);
      });
      
      console.log('📅 Elementos ordenados por fecha de vencimiento:', sortedItems.map(item => 
        `${item.itemKey}: ${item.expirationDate}`
      ));
      
      let currentVersion = baseVersion + 1;
      
      // Procesar cada página/grupo en orden de fecha
      for (let i = 0; i < sortedItems.length; i++) {
        const { itemKey, expirationDate } = sortedItems[i]; // Usar fecha original del grupo/página
        
        setProcessingProgress({ current: i + 1, total: sortedItems.length });
        
        console.log(`🔄 Procesando elemento ${itemKey} con fecha ${expirationDate} (versión ${currentVersion})`);
        
        // Determinar si es una página individual o un grupo
        let isGroup = false;
        let pagesToProcess = [];
        let groupInfo = null;
        
        if (itemKey.startsWith('group-')) {
          // Es un grupo
          const groupId = parseInt(itemKey.replace('group-', ''));
          const group = pageGroups.find(g => g.id === groupId);
          if (group) {
            isGroup = true;
            pagesToProcess = group.pages;
            groupInfo = group;
            console.log(`📋 Procesando grupo ${groupId} con páginas:`, pagesToProcess);
          }
        } else {
          // Es una página individual
          const pageNum = parseInt(itemKey);
          pagesToProcess = [pageNum];
          console.log(`📄 Procesando página individual ${pageNum}`);
        }
        
        // Crear documento aprobado
        await createApprovedDocument({
          pages: pagesToProcess,
          expirationDate,
          version: currentVersion,
          originalData: originalDocumentData,
          isGroup,
          groupInfo,
          currentUserData
        });
        
        // Incrementar versión para el siguiente elemento
        currentVersion++;
        
        // Pequeña pausa para no sobrecargar el sistema
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Actualizar el documento requerido con la fecha de vencimiento seleccionada
      console.log('🔍 Datos del documento original:', {
        requiredDocumentId: originalDocumentData.requiredDocumentId,
        expirationDate: selectedExpirationDate,
        currentUserData: currentUserData
      });
      
      if (originalDocumentData.requiredDocumentId) {
        console.log('📝 Actualizando requiredDocument con fecha de vencimiento...');
        await updateRequiredDocumentWithExpiration(originalDocumentData.requiredDocumentId, selectedExpirationDate, currentUserData);
        console.log('✅ requiredDocument actualizado exitosamente');
      } else {
        console.warn('⚠️ No se encontró requiredDocumentId en el documento original');
      }
      
      // Actualizar el documento original en uploadedDocuments
      console.log('📝 Actualizando documento original en uploadedDocuments...');
      await updateOriginalUploadedDocument(originalDocumentData.id, currentVersion, selectedExpirationDate, currentUserData);
      console.log('✅ uploadedDocuments actualizado exitosamente');
      
      console.log('✅ Aprobación masiva completada exitosamente');
      
      // Disparar eventos de refresco para todas las pestañas
      window.dispatchEvent(new Event('companyListShouldRefresh'));
      window.dispatchEvent(new Event('pendientesShouldRefresh'));
      window.dispatchEvent(new Event('historialShouldRefresh'));
      window.dispatchEvent(new Event('dashboardShouldRefresh'));
      
      // Cerrar modal y notificar éxito
      onClose();
      if (onDateSelect) {
        onDateSelect('Aprobación masiva completada');
      }
      
    } catch (error) {
      console.error('❌ Error en aprobación masiva:', error);
      alert('Error durante la aprobación masiva. Por favor, intente nuevamente.');
    } finally {
      setIsProcessingBatch(false);
      setProcessingProgress({ current: 0, total: 0 });
      setSelectedExpirationDate('');
    }
  };

  // Función auxiliar para obtener datos del documento original
  const getOriginalDocumentData = async (documentId, fileURL, uploadedAt, uploadedByEmail, companyComment, adminComment, companyName, entityName, status) => {
    if (!documentId) {
      throw new Error('No se proporcionó documentId');
    }

    try {
      // Obtener datos del documento original desde Firestore
      const uploadedDocumentsPath = 'uploadedDocuments';
      const docRef = doc(db, uploadedDocumentsPath, documentId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Documento original no encontrado');
      }
      
      const data = docSnap.data();
      
      // Obtener nombre de la empresa
      let companyName = data.companyName;
      if (!companyName && data.companyId) {
        const companiesPath = getTenantCollectionPath('companies');
        const companyRef = doc(db, companiesPath, data.companyId);
        const companySnap = await getDoc(companyRef);
        if (companySnap.exists()) {
          companyName = companySnap.data().name || companySnap.data().companyName || 'Empresa sin nombre';
        }
      }
      
      return {
        // Datos del documento original
        id: documentId,
        companyId: data.companyId,
        companyName: companyName || 'Empresa sin nombre',
        entityId: data.entityId || data.companyId,
        entityName: data.entityName || entityName || 'Entidad',
        entityType: data.entityType || 'company',
        documentType: data.documentType || 'company',
        requiredDocumentId: data.requiredDocumentId,
        name: data.name || data.documentName || 'Documento',
        email: data.email || data.uploadedByEmail,
        uploadedBy: data.uploadedBy,
        uploadedByEmail: data.uploadedByEmail || uploadedByEmail,
        originalFileURL: data.fileURL || (data.fileId ? await getDownloadUrl(data.fileId) : null),
        fileName: data.fileName || 'documento.pdf',
        fileType: data.fileType || 'application/pdf',
        size: data.size || 0,
        
        // Metadata adicional
        adminComment: data.adminComment || adminComment || '',
        companyComment: data.companyComment || companyComment || '',
        uploadedAt: data.uploadedAt || uploadedAt,
        status: data.status || status
      };
    } catch (error) {
      console.error('Error obteniendo datos del documento original:', error);
      throw error;
    }
  };

  // Función auxiliar para obtener la versión base del documento
  const getBaseVersionForDocument = async (documentData) => {
    try {
      // Buscar la última versión aprobada para esta entidad/empresa/documento
      const approvedDocumentsPath = getTenantCollectionPath('approvedDocuments');
      const approvedQuery = query(
        collection(db, approvedDocumentsPath),
        where('companyId', '==', documentData.companyId),
        where('requiredDocumentId', '==', documentData.requiredDocumentId),
        orderBy('versionNumber', 'desc'),
        limit(1)
      );
      
      const approvedSnap = await getDocs(approvedQuery);
      
      if (!approvedSnap.empty) {
        const latestDoc = approvedSnap.docs[0].data();
        return latestDoc.versionNumber || latestDoc.version || 0;
      }
      
      // Si no hay documentos aprobados, buscar en requiredDocuments
      if (documentData.requiredDocumentId) {
        const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
        const requiredRef = doc(db, requiredDocumentsPath, documentData.requiredDocumentId);
        const requiredSnap = await getDoc(requiredRef);
        
        if (requiredSnap.exists()) {
          const requiredData = requiredSnap.data();
          return requiredData.version || 0;
        }
      }
      
      // Si no se encuentra nada, empezar desde 0
      return 0;
    } catch (error) {
      console.error('Error obteniendo versión base:', error);
      // Fallback: empezar desde 0
      return 0;
    }
  };

  // Función helper para convertir fecha DD/MM/YY a Date válido
  const parseExpirationDate = (dateStr) => {
    if (!dateStr) return null;
    
    try {
      // Formato DD/MM/YY -> DD/MM/20YY
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const date = new Date(`${year}-${month}-${day}`);
        
        // Validar que la fecha sea válida
        if (isNaN(date.getTime())) {
          console.error('Fecha inválida:', dateStr);
          return null;
        }
        
        return date;
      }
    } catch (error) {
      console.error('Error parseando fecha:', dateStr, error);
    }
    return null;
  };

  // Función para crear un documento aprobado
  const createApprovedDocument = async ({ pages, expirationDate, version, originalData, isGroup, groupInfo, currentUserData }) => {
    const now = new Date();
    const parsedExpirationDate = parseExpirationDate(expirationDate);
    
    // Extraer páginas específicas del PDF usando el backend
    let extractedPdfUrl;
    let extractedFileId;
    let extractedFileName;
    
    try {
      console.log(`📄 Extrayendo páginas ${pages.join(', ')} del PDF original...`);
      
      // Llamar al backend para extraer páginas
      const extractResponse = await fetch(`${import.meta.env.VITE_API_URL}/api/extract-pdf-pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await currentUserData.getToken?.() || ''}`
        },
        body: JSON.stringify({
          pdfUrl: originalData.originalFileURL,
          pageNumbers: pages
        })
      });
      
      if (!extractResponse.ok) {
        throw new Error(`Error extrayendo páginas: ${extractResponse.status} ${extractResponse.statusText}`);
      }
      
      // Obtener el PDF extraído como blob
      const extractedPdfBlob = await extractResponse.blob();
      console.log(`✅ PDF extraído obtenido, tamaño: ${extractedPdfBlob.size} bytes`);
      
      // Crear nombre para el archivo extraído
      const originalFileName = originalData.fileName || 'documento.pdf';
      const baseName = originalFileName.replace('.pdf', '');
      const pageSuffix = pages.length === 1 ? `_page_${pages[0]}` : `_pages_${pages.join('-')}`;
      extractedFileName = `${baseName}${pageSuffix}.pdf`;
      
      // Subir el PDF extraído a ControlFile
      const extractedPdfFile = new File([extractedPdfBlob], extractedFileName, { type: 'application/pdf' });
      const tenantId = getCurrentTenantId() || 'default';
      const path = buildControlFilePath(`empresas/${originalData.companyId}`, tenantId);
      const { fileId: uploadedFileId } = await uploadToControlFile(extractedPdfFile, path);
      extractedPdfUrl = null;
      extractedFileId = uploadedFileId;

      console.log(`✅ PDF extraído subido exitosamente a ControlFile:`, uploadedFileId);
      
    } catch (error) {
      console.error('❌ Error extrayendo/subiendo páginas del PDF:', error);
      // Fallback: usar URL original con parámetros (como antes)
      const pageParams = pages.join(',');
      extractedPdfUrl = `${originalData.originalFileURL}?pages=${pageParams}`;
      extractedFileName = originalData.fileName || 'documento.pdf';
      console.log('⚠️ Usando fallback con URL original:', extractedPdfUrl);
    }
    
    // Crear nombre del documento
    const documentName = originalData.name;
    
    // Crear metadata del documento aprobado
    const approvedDocumentData = {
      // Metadata base (copiada del original)
      companyId: originalData.companyId,
      companyName: originalData.companyName,
      clientId: originalData.clientId || null,
      entityId: originalData.entityId,
      entityName: originalData.entityName,
      entityType: originalData.entityType,
      documentType: originalData.documentType,
      requiredDocumentId: originalData.requiredDocumentId,
      email: originalData.email,
      uploadedBy: originalData.uploadedBy,
      uploadedByEmail: originalData.uploadedByEmail,
      
      // Metadata específica del documento aprobado
      name: documentName,
      documentName: documentName,
      originalName: originalData.name,
      fileName: extractedFileName,
      fileId: extractedFileId || null,
      fileURL: extractedFileId ? null : (extractedPdfUrl || null),
      fileType: "application/pdf",
      
      // Metadata de aprobación
      status: "Aprobado",
      reviewedAt: now,
      reviewedBy: currentUserData.email,
      expirationDate: parsedExpirationDate,
      
      // Metadata de versiones
      version: version,
      versionNumber: version,
      versionString: `${version}.0`,
      versionAction: "Aprobación",
      versionAuthor: currentUserData.email,
      versionComment: isGroup ? 
        `Grupo aprobado: ${groupInfo.name}` : 
        `Página ${pages.join(', ')} aprobada`,
      versionTimestamp: now,
      
      // Metadata adicional
      originalId: "originalDocId",
      originalFile: originalData.originalFileURL,
      pages: pages,
      isGroup: isGroup,
      groupInfo: groupInfo,
      
      // Timestamps
      createdAt: now,
      updatedAt: now,
      uploadedAt: now,
      copiedAt: now,
      
      // Campos adicionales
      subversion: 0,
      tags: [],
      category: "",
      adminComment: "",
      companyComment: "",
      comentario: "",
      exampleComment: "",
      realemail: originalData.uploadedByEmail,
      
      // Historial de versiones
      versionHistory: [{
        action: "approved",
        by: currentUserData.email,
        expirationDate: parsedExpirationDate,
        timestamp: now,
        versionId: `version-${version}-${Date.now()}`
      }]
    };
    
    console.log('📄 Creando documento aprobado:', {
      name: documentName,
      pages: pages,
      version: version,
      expirationDate: expirationDate,
      isGroup: isGroup
    });
    
    // Crear el documento en approvedDocuments
    try {
      const approvedDocumentsPath = getTenantCollectionPath('approvedDocuments');
      const approvedDocRef = await addDoc(collection(db, approvedDocumentsPath), approvedDocumentData);
      
      console.log('✅ Documento aprobado creado en approvedDocuments:', approvedDocRef.id);
      
      // También crear en uploadedDocuments para que aparezca en historial
      const uploadedDocumentsPath = 'uploadedDocuments';
      const uploadedDocRef = await addDoc(collection(db, uploadedDocumentsPath), approvedDocumentData);
      
      console.log('✅ Documento aprobado creado en uploadedDocuments:', uploadedDocRef.id);
      
      return { ...approvedDocumentData, id: approvedDocRef.id };
    } catch (error) {
      console.error('❌ Error creando documento aprobado:', error);
      throw error;
    }
  };

  // Función para actualizar requiredDocuments con fecha de vencimiento
  const updateRequiredDocumentWithExpiration = async (requiredDocumentId, expirationDate, currentUserData) => {
    try {
      const requiredDocumentsPath = getTenantCollectionPath('requiredDocuments');
      const requiredRef = doc(db, requiredDocumentsPath, requiredDocumentId);
      
      // Convertir la fecha a formato ISO usando la función helper
      const parsedDate = parseExpirationDate(expirationDate);
      if (!parsedDate) {
        console.error('No se pudo parsear la fecha de vencimiento:', expirationDate);
        return;
      }
      const expirationISO = parsedDate.toISOString();
      
      await updateDoc(requiredRef, {
        status: "Aprobado",
        deadline: {
          date: expirationISO,
          status: 'pending'
        },
        aprobadoAt: new Date().toISOString(),
        aprobadoPor: {
          uid: currentUserData.uid,
          email: currentUserData.email,
          realemail: currentUserData.realemail
        }
      });
      
      console.log('✅ requiredDocuments actualizado con fecha de vencimiento:', expirationDate);
    } catch (error) {
      console.error('❌ Error actualizando requiredDocuments con fecha:', error);
    }
  };

  // Función para actualizar el documento original en uploadedDocuments
  const updateOriginalUploadedDocument = async (documentId, version, expirationDate, currentUserData) => {
    try {
      const uploadedDocumentsPath = 'uploadedDocuments';
      const uploadedRef = doc(db, uploadedDocumentsPath, documentId);
      
      // Convertir la fecha a formato ISO
      const parsedDate = parseExpirationDate(expirationDate);
      const expirationISO = parsedDate ? parsedDate.toISOString() : null;
      const now = new Date();
      
      await updateDoc(uploadedRef, {
        status: "Aprobado",
        reviewedAt: now,
        reviewedBy: currentUserData.email,
        expirationDate: expirationISO,
        version: version,
        versionNumber: version,
        versionString: `${version}.0`,
        deadline: {
          date: expirationISO,
          status: expirationISO ? 'pending' : 'no-deadline'
        },
        aprobadoAt: now.toISOString(),
        aprobadoPor: {
          uid: currentUserData.uid,
          email: currentUserData.email,
          realemail: currentUserData.realemail
        }
      });
      
      console.log('✅ uploadedDocuments actualizado con status Aprobado y versión:', version);
    } catch (error) {
      console.error('❌ Error actualizando uploadedDocuments:', error);
      throw error;
    }
  };

  return {
    isProcessingBatch,
    processingProgress,
    showExpirationModal,
    setShowExpirationModal,
    selectedExpirationDate,
    setSelectedExpirationDate,
    handleBatchApprove,
    handleConfirmBatchApprove,
    calculateItemsToApprove
  };
};
