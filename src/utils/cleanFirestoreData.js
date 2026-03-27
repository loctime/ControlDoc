// utils/cleanFirestoreData.js

/**
 * Elimina todas las propiedades con valor undefined, null o string vacío de un objeto
 * para evitar guardar campos innecesarios en Firestore.
 *
 * @param {Object} obj - Objeto a limpiar
 * @returns {Object} - Objeto sin propiedades undefined, null o string vacío
 */
export function cleanFirestoreData(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null && v !== "")
    );
  }
  