import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, addDoc, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebaseconfig';
import { getTenantCollectionPath } from '../../utils/tenantUtils';
import { useAuth } from '../../context/AuthContext';

const MUTATION_DEFAULTS = {
  retry: 1,
  retryDelay: 1000,
};

/**
 * Crea un nuevo cliente (subempresa)
 * @param {Object} clientData - Datos del cliente
 * @param {string} clientData.companyName - Nombre del cliente
 * @param {string} parentCompanyId - ID de la empresa padre
 * @param {string} userId - ID del usuario que crea el cliente
 * @returns {Promise<Object>} Cliente creado
 */
const createClient = async ({ clientData, parentCompanyId, userId }) => {
  // Validar que el usuario sea owner (se valida en el componente)
  
  // Validar que la empresa padre exista
  const companiesPath = getTenantCollectionPath('companies');
  const parentCompanyRef = doc(db, companiesPath, parentCompanyId);
  const parentCompanyDoc = await getDoc(parentCompanyRef);
  
  if (!parentCompanyDoc.exists()) {
    throw new Error('La empresa padre no existe');
  }
  
  const parentData = parentCompanyDoc.data();
  
  // Validar que la empresa padre sea del tipo "main"
  if (parentData.type !== 'main') {
    throw new Error('Solo se pueden crear clientes para empresas principales');
  }
  
  // Verificar que no exista un cliente con el mismo nombre
  const existingQuery = query(
    collection(db, companiesPath),
    where('parentCompanyId', '==', parentCompanyId),
    where('companyName', '==', clientData.companyName)
  );
  
  const existingSnapshot = await getDocs(existingQuery);
  if (!existingSnapshot.empty) {
    throw new Error('Ya existe un cliente con ese nombre');
  }
  
  // Crear el cliente
  const newClient = {
    companyName: clientData.companyName,
    parentCompanyId: parentCompanyId,
    type: 'client',
    createdBy: userId,
    active: true,
    status: 'pending', // Requiere aprobación del administrador
    createdAt: new Date(),
    ...clientData
  };
  
  const docRef = await addDoc(collection(db, companiesPath), newClient);
  
  return { id: docRef.id, ...newClient };
};

/**
 * Hook para mutaciones de clientes
 */
export function useClientMutations() {
  const queryClient = useQueryClient();
  const { mainCompanyId } = useAuth();

  const createClientMutation = useMutation({
    mutationFn: ({ clientData, userId }) => {
      if (!mainCompanyId) {
        throw new Error('No se encontró la empresa principal');
      }
      return createClient({
        clientData,
        parentCompanyId: mainCompanyId,
        userId
      });
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['availableCompanies', mainCompanyId] });
    },
    ...MUTATION_DEFAULTS,
  });

  return {
    createClientMutation,
  };
}

