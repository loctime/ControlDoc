// src/utils/useDocumentEntityTypes.js
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  deleteDoc
} from "firebase/firestore";
import { db } from "../firebaseconfig";
import { getTenantCollectionPath } from "./tenantUtils";

const DEFAULT_TYPES = [
  { value: "company", label: "Empresa (SimpleDoc)" },
  { value: "employee", label: "Empleado (PeronalDoc)" },
  { value: "vehicle", label: "Vehículo (VehicleDoc)" },
];

// Categorías principales que no se pueden eliminar
const PROTECTED_TYPES = ["company", "employee", "vehicle"];

export const useDocumentEntityTypes = (user = null) => {
  const [entityTypes, setEntityTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        // Usar la ruta multi-tenant correcta
        const documentEntityTypesPath = getTenantCollectionPath('documentEntityTypes');
        const ref = collection(db, documentEntityTypesPath);
        
        // Determinar el createdBy a filtrar
        let filterCreatedBy = null;
        if (user) {
          const isSuperAdmin = user?.role === 'max';
          if (isSuperAdmin) {
            filterCreatedBy = user?.uid;
          } else if (user?.createdBy?.uid) {
            // Administrador: usar el superadmin que lo creó
            filterCreatedBy = user.createdBy.uid;
          }
        }
        
        let snapshot;
        if (filterCreatedBy) {
          const q = query(ref, where('createdBy', '==', filterCreatedBy));
          snapshot = await getDocs(q);
        } else {
          snapshot = await getDocs(ref);
        }
        
        let types = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // Agregar los valores por defecto si no están (solo si no hay filtro o si el usuario es superadmin)
        // Las categorías por defecto no tienen createdBy, así que siempre se muestran
        for (const defaultType of DEFAULT_TYPES) {
          const existing = types.find((t) => t.value === defaultType.value);
          if (!existing) {
            const newDoc = await addDoc(ref, {
              ...defaultType,
              createdAt: serverTimestamp(),
              createdBy: null // Las categorías por defecto no tienen createdBy
            });
            types.push({ id: newDoc.id, ...defaultType, createdBy: null });
          } else if (existing.label !== defaultType.label) {
            // Actualizar el label si es diferente
            await updateDoc(doc(db, documentEntityTypesPath, existing.id), {
              label: defaultType.label
            });
            existing.label = defaultType.label;
          }
        }
        
        // Si hay filtro, agregar las categorías por defecto al resultado
        if (filterCreatedBy) {
          for (const defaultType of DEFAULT_TYPES) {
            const existing = types.find((t) => t.value === defaultType.value);
            if (!existing) {
              types.push({ 
                ...defaultType, 
                createdBy: null,
                id: `default-${defaultType.value}` 
              });
            }
          }
        }

        // Eliminar duplicados por value
        const uniqueMap = new Map();
        for (const t of types) {
          if (!uniqueMap.has(t.value)) {
            uniqueMap.set(t.value, t);
          }
        }
        const uniqueTypes = Array.from(uniqueMap.values());

        // Ordenar: principales primero, luego personalizados por fecha
        const order = ["company", "employee", "vehicle"];
        const principales = uniqueTypes.filter((t) => order.includes(t.value))
          .sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
        const personalizados = uniqueTypes.filter((t) => !order.includes(t.value))
          .sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return aTime - bTime;
          });

        setEntityTypes([...principales, ...personalizados]);
      } catch (error) {
        console.error("Error fetching document entity types:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTypes();
  }, [user]);

  const addNewEntityType = async (label, createdByUid = null) => {
    const value = label.toLowerCase().replace(/\s+/g, "_");

    const exists = entityTypes.some((t) => t.value === value);
    if (exists) return;

    const newType = {
      value,
      label,
      createdAt: serverTimestamp(),
      createdBy: createdByUid
    };

    try {
      // Usar la ruta multi-tenant correcta
      const documentEntityTypesPath = getTenantCollectionPath('documentEntityTypes');
      const newDoc = await addDoc(collection(db, documentEntityTypesPath), newType);
      setEntityTypes((prev) => [...prev, { id: newDoc.id, ...newType }]);
    } catch (error) {
      console.error("Error adding new entity type:", error);
    }
  };

  const removeEntityType = async (typeValue) => {
    // Verificar si es una categoría protegida
    if (PROTECTED_TYPES.includes(typeValue)) {
      throw new Error(`No se puede eliminar la categoría "${typeValue}" porque es una categoría principal del sistema`);
    }

    try {
      // Usar la ruta multi-tenant correcta
      const documentEntityTypesPath = getTenantCollectionPath('documentEntityTypes');
      const q = query(collection(db, documentEntityTypesPath), where('value', '==', typeValue));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = [];
      querySnapshot.forEach((document) => {
        deletePromises.push(deleteDoc(doc(db, documentEntityTypesPath, document.id)));
      });
      
      await Promise.all(deletePromises);
      setEntityTypes((prev) => prev.filter((t) => t.value !== typeValue));
    } catch (error) {
      console.error("Error removing entity type:", error);
      throw error;
    }
  };

  const isProtectedType = (typeValue) => {
    return PROTECTED_TYPES.includes(typeValue);
  };

  return { entityTypes, addNewEntityType, removeEntityType, isProtectedType, loading };
};
