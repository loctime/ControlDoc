export const parseFirestoreDate = (firestoreDate) => {
    if (!firestoreDate) return null;
    try {
      if (firestoreDate?.toDate) return firestoreDate.toDate();
      if (firestoreDate?.seconds) return new Date(firestoreDate.seconds * 1000);
      if (typeof firestoreDate === 'string') return new Date(firestoreDate);
      if (firestoreDate instanceof Date) return firestoreDate;
      return null;
    } catch (e) {
      console.error('Error parsing date:', firestoreDate);
      return null;
    }
  };

/**
 * Función centralizada para formatear fechas en formato DD/MM/AAAA
 */
export const formatDateDDMMAAAA = (date) => {
  if (!date) return 'Sin fecha';
  
  try {
    let dateObj;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (date?.toDate) {
      dateObj = date.toDate();
    } else if (date?.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      return 'Sin fecha';
    }
    
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida';
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formateando fecha:', error, date);
    return 'Fecha inválida';
  }
};

/**
 * Función centralizada para formatear fechas con hora DD/MM/AAAA HH:mm
 */
export const formatDateDDMMAAAAWithTime = (date) => {
  if (!date) return 'Sin fecha';
  
  try {
    let dateObj;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (date?.toDate) {
      dateObj = date.toDate();
    } else if (date?.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      return 'Sin fecha';
    }
    
    if (isNaN(dateObj.getTime())) {
      return 'Fecha inválida';
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formateando fecha con hora:', error, date);
    return 'Fecha inválida';
  }
};