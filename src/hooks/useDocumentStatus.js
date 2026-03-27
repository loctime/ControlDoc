import { React,  useMemo } from 'react';
import { getDeadlineStatus } from '../utils/getDeadlineUtils';
import { parseFirestoreDate } from '../utils/dateHelpers';

export const STATUS_COLORS = {
  'Aprobado': 'success',
  'Rechazado': 'error',
  'Pendiente de revisión': 'warning',
  'Pendiente de subida': 'info',
  'Vencido': 'error',
  'En proceso': 'info',
};

const getIconComponent = (iconName) => {
  switch(iconName) {
    case 'Error': return 'error';
    case 'Warning': return 'warning';
    case 'Info': return 'info';
    case 'CheckCircle': return 'success';
    default: return 'info';
  }
};

export default function useDocumentStatus() {
  const getDocumentStatus = (document) => {
    const expirationDate = parseFirestoreDate(document?.expirationDate);
    return getDeadlineStatus(expirationDate);
  };

  const getCompanyStatus = (company) => {
    const status = getDeadlineStatus(company?.nearestExpiration);
    return {
      ...status,
      icon: getIconComponent(status.icon)
    };
  };

  const getAdminStatus = (doc) => ({
    status: doc?.status || 'Pendiente de subida',
    color: STATUS_COLORS[doc?.status] || 'default'
  });

  const isPendingUpload = (doc) =>
    doc?.status === 'Aprobado' &&
    getDocumentStatus(doc)?.level === 'warning';

  const isVencido = (doc) => 
    getDocumentStatus(doc)?.level === 'error';

  const filterByStatus = (docs, status) => {
    if (status === 'todos') return docs;
    if (status === 'Pendiente de subida') return docs.filter(isPendingUpload);
    if (status === 'Vencido') return docs.filter(isVencido);
    return docs.filter(doc => doc.status === status);
  };

  const countByStatus = (docs, status) => {
    if (status === 'Pendiente de subida') return docs.filter(isPendingUpload).length;
    if (status === 'Vencido') return docs.filter(isVencido).length;
    return docs.filter(doc => doc.status === status).length;
  };

  const getStatusColor = (status) => STATUS_COLORS[status] || 'default';

  return {
    getDocumentStatus,
    getAdminStatus,
    getCompanyStatus,
    filterByStatus,
    countByStatus,
    getStatusColor,
    isPendingUpload,
    isVencido,
  };
}
