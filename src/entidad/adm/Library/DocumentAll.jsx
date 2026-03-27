import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseconfig';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';

export function useDocumentAll({ isAdmin, selectedCompanyId, assignedCompanyIds = null, sortBy = 'date', sortDirection = 'desc', refreshKey = 0 }) {
  const [documents, setDocuments] = useState([]);
  const [folderStructure, setFolderStructure] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;

    const fetchDocuments = async () => {
      setLoading(true);
      try {
        // Usar la ruta multi-tenant correcta
        const approvedDocumentsPath = getTenantCollectionPath('approvedDocuments');
        let q = collection(db, approvedDocumentsPath);

        if (selectedCompanyId && selectedCompanyId !== 'todas') {
          q = query(q, where('companyId', '==', selectedCompanyId));
        }

        const snapshot = await getDocs(q);
        const documentPromises = snapshot.docs.map(docSnap => formatDocument(docSnap));
        let allDocs = await Promise.all(documentPromises);

        // Filtrar por empresas asignadas si no hay empresa seleccionada o es 'todas'
        if ((!selectedCompanyId || selectedCompanyId === 'todas') && assignedCompanyIds && assignedCompanyIds.size > 0) {
          allDocs = allDocs.filter(doc => assignedCompanyIds.has(doc.companyId));
        }

        setDocuments(allDocs);
        setFolderStructure(buildFolderStructure(allDocs));
      } catch (err) {
        console.error('Error loading documents:', err);
        setError('Error al cargar documentos');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [isAdmin, selectedCompanyId, assignedCompanyIds, refreshKey]);

  return { documents, setDocuments, folderStructure, loading, error };
}

async function formatDocument(docSnap) {
  const data = docSnap.data();
  const toDate = val => {
    if (!val) return null;
    if (typeof val === 'string') return new Date(val);
    if (val?.toDate) return val.toDate();
    if (val?.seconds) return new Date(val.seconds * 1000);
    return null;
  };

  // Obtener companyName de forma segura si no existe
  let companyName = data.companyName || data.name;
  console.log('🔍 [DocumentAll] Documento:', {
    id: docSnap.id,
    companyId: data.companyId,
    companyName: data.companyName,
    name: data.name,
    fileName: data.fileName
  });
  
  if (!companyName && data.companyId) {
    try {
      const companiesPath = getTenantCollectionPath('companies');
      console.log('🔍 [DocumentAll] Buscando empresa con companyId:', data.companyId);
      const companySnap = await getDoc(doc(db, companiesPath, data.companyId));
      
      if (companySnap.exists()) {
        const companyData = companySnap.data();
        console.log('🔍 [DocumentAll] Datos de empresa encontrados:', {
          id: companySnap.id,
          companyName: companyData.companyName,
          name: companyData.name,
          cuit: companyData.cuit,
          realemail: companyData.realemail
        });
        companyName = companySnap.data().name || companySnap.data().companyName || `Empresa ${data.companyId}`;
      } else {
        console.log('🔍 [DocumentAll] Empresa no encontrada con ID:', data.companyId);
        companyName = `Empresa ${data.companyId}`;
      }
    } catch (error) {
      console.error('🔍 [DocumentAll] Error buscando empresa:', error);
      companyName = `Empresa ${data.companyId}`;
    }
  }
  if (!companyName) {
    companyName = 'Sin empresa';
  }
  
  console.log('🔍 [DocumentAll] companyName final:', companyName);

    return {
      id: docSnap.id,
      name: data.name || data.documentName || 'Sin nombre',
      fileName: data.fileName || 'Sin archivo',
      fileType: data.fileType || 'application/octet-stream',
      size: data.fileSize || data.size || 0,
      comentario: data.comentario || '',
      entityType: data.entityType || 'company',
      entityName: data.entityName || 'Entidad',
      category: data.entityType === 'employee' ? 'personal' : data.entityType === 'vehicle' ? 'vehicle' : 'company',
      status: data.status || 'Aprobado',
      uploadedAt: toDate(data.uploadedAt) || new Date(),
      uploadedBy: data.uploadedByEmail || data.uploadedBy || 'Desconocido',
      lastModified: toDate(data.updatedAt) || new Date(),
      expirationDate: toDate(data.expirationDate),
      version: data.version || '1.0',
      fileURL: data.fileURL || '',
      companyId: data.companyId,
      companyName: companyName,
    clientId: data.clientId || null,
    reviewedAt: toDate(data.reviewedAt),
    reviewedBy: data.reviewedBy || 'Desconocido',
    subversion: data.subversion || 1,
    versionComment: data.versionComment || 'Sin comentarios',
    generalBackup: data.generalBackup || null
  };
}

function sortDocuments(docs, sortBy, direction) {
  return [...docs].sort((a, b) => {
    let aVal = a[sortBy] || '', bVal = b[sortBy] || '';
    if (aVal instanceof Date) aVal = aVal.getTime();
    if (bVal instanceof Date) bVal = bVal.getTime();
    return direction === 'asc' ? aVal > bVal ? 1 : -1 : aVal < bVal ? 1 : -1;
  });
}

function buildFolderStructure(docs) {
  const grouped = {};
  docs.forEach(doc => {
    const { entityType, entityName } = doc;
    if (!grouped[entityType]) grouped[entityType] = {};
    if (!grouped[entityType][entityName]) grouped[entityType][entityName] = [];
    grouped[entityType][entityName].push(doc);
  });

  return {
    biblioteca: {
      name: 'Biblioteca',
      files: docs,
      subfolders: Object.entries(grouped).map(([type, items]) => ({
        name: type,
        subfolders: Object.entries(items).map(([name, files]) => ({
          name,
          files
        }))
      }))
    }
  };
}
