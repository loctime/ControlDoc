// g:\controldoc-master99\src\component\administrador\AdminAcceptCompanyPage.jsx
import React, { useState, useEffect } from 'react';
import { 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Chip, Box, Paper, Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { auth, db } from '../../config/firebaseconfig';
import { useCompanies } from '../../context/CompaniesContext';
import { setDoc, doc, collection, getDocs, query, where, getDoc } from 'firebase/firestore';
import { getTenantCollectionPath } from '../../utils/tenantUtils';

const AdminAcceptCompanyPage = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const { enqueueSnackbar } = useSnackbar();
  const { refreshCompanies } = useCompanies();
  
  // Log para ver el rol del usuario y tenant
  useEffect(() => {
    const tenantId = getTenantCollectionPath("companies").split('/')[1];
    console.log('🔍 [AceptCompany] Información del usuario y tenant:', {
      tenantId: tenantId,
      role: auth.currentUser?.role,
      email: auth.currentUser?.email,
      uid: auth.currentUser?.uid,
      displayName: auth.currentUser?.displayName
    });
  }, []);

  useEffect(() => {
    loadPendingCompanies();
    
    // También buscar todas las empresas del tenant para debug
    const debugAllCompanies = async () => {
      try {
        const tenantCompaniesPath = getTenantCollectionPath("companies");
        const allCompaniesSnapshot = await getDocs(collection(db, tenantCompaniesPath));
        console.log('🔍 [AceptCompany] Todas las empresas en el tenant:', allCompaniesSnapshot.size);
        
        allCompaniesSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('🔍 [AceptCompany] Empresa en tenant:', {
            id: doc.id,
            name: data.companyName || data.name,
            status: data.status,
            email: data.email
          });
        });
      } catch (error) {
        console.error('❌ [AceptCompany] Error buscando todas las empresas:', error);
      }
    };
    
    debugAllCompanies();
  }, []);

  const loadPendingCompanies = async () => {
    try {
      setLoading(true);
      
      const tenantCompaniesPath = getTenantCollectionPath("companies");
      const currentAdminId = auth.currentUser?.uid;
      
      if (!currentAdminId) {
        setCompanies([]);
        setLoading(false);
        return;
      }
      
      console.log('🔍 [AceptCompany] Buscando empresas en:', tenantCompaniesPath);
      
      // 1. Obtener empresas aprobadas asignadas al admin actual
      const [newFormatSnapshot, oldFormatSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, tenantCompaniesPath),
          where("assignedAdminIds", "array-contains", currentAdminId),
          where("status", "==", "approved")
        )),
        getDocs(query(
          collection(db, tenantCompaniesPath),
          where("assignedAdminId", "==", currentAdminId),
          where("status", "==", "approved")
        ))
      ]);
      
      const assignedCompanyIds = new Set();
      [...newFormatSnapshot.docs, ...oldFormatSnapshot.docs].forEach(doc => {
        assignedCompanyIds.add(doc.id);
      });
      
      console.log('🔍 [AceptCompany] Empresas asignadas al admin:', assignedCompanyIds.size);
      
      // 2. Obtener TODAS las empresas pendientes
      const q = query(
        collection(db, tenantCompaniesPath),
        where("status", "==", "pending")
      );
      const snapshot = await getDocs(q);
      
      // 3. Filtrar: solo empresas principales asignadas o clientes de empresas asignadas
      const pendingCompanies = [];
      
      console.log('🔍 [AceptCompany] Documentos pendientes encontrados:', snapshot.size);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Si es empresa principal: mostrar si está asignada o sin asignar aún
        if (data.type !== 'client') {
          const hasAssignedAdmins = (data.assignedAdminIds && data.assignedAdminIds.length > 0) || data.assignedAdminId;
          // Mostrar si no tiene admins asignados (nueva) o si está asignada al admin actual
          if (!hasAssignedAdmins || assignedCompanyIds.has(doc.id)) {
            pendingCompanies.push({
              id: doc.id,
              ...data
            });
          }
        } 
        // Si es cliente: mostrar solo si la empresa padre está asignada al admin
        else if (data.parentCompanyId && assignedCompanyIds.has(data.parentCompanyId)) {
          pendingCompanies.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      console.log('🔍 [AceptCompany] Total empresas pendientes filtradas:', pendingCompanies.length);
      setCompanies(pendingCompanies);
    } catch (error) {
      console.error('❌ [AceptCompany] Error cargando empresas:', error);
      enqueueSnackbar('Error al cargar empresas: ' + error.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (companyId, status) => {
    try {
      const company = companies.find(c => c.id === companyId);
      
      // 🔥 USAR RUTA DE TENANT PARA ACTUALIZAR EMPRESA
      const tenantCompaniesPath = getTenantCollectionPath("companies");
      await setDoc(doc(db, tenantCompaniesPath, companyId), {
        ...company,
        status: status,
        reviewedAt: new Date()
      }, { merge: true });
  
      enqueueSnackbar(`Empresa "${company.companyName || company.name}" Rechazada`, {
        variant: 'success',
        autoHideDuration: 3000
      });
  
      // No recargamos la página, solo refrescamos la lista local
      loadPendingCompanies();
      refreshCompanies();
    } catch (error) {
      enqueueSnackbar('Error al rechazar empresa: ' + error.message, { variant: 'error' });
    }
  };
  

  const approveCompany = async (companyId) => {
    try {
      const company = companies.find(c => c.id === companyId);

      if (!company) {
        console.error('❌ [AceptCompany] Empresa no encontrada:', companyId);
        throw new Error("Empresa no encontrada");
      }
      
      if (!company.companyName && !company.name) {
        console.error('❌ [AceptCompany] Falta nombre:', company);
        throw new Error("Falta nombre de la empresa");
      }

      const tenantCompaniesPath = getTenantCollectionPath("companies");
      const isClient = company.type === 'client';

      // Obtener ID del administrador actual que aprueba
      const currentAdminId = auth.currentUser?.uid;
      
      if (isClient) {
        // Aprobar cliente - heredar assignedAdminIds de la empresa padre
        console.log('✅ [AceptCompany] Aprobando cliente:', {
          companyId,
          companyName: company.companyName || company.name,
          parentCompanyId: company.parentCompanyId
        });

        // Obtener assignedAdminIds de la empresa padre
        let parentAdminIds = [];
        if (company.parentCompanyId) {
          try {
            const parentCompanyRef = doc(db, tenantCompaniesPath, company.parentCompanyId);
            const parentCompanySnap = await getDoc(parentCompanyRef);
            if (parentCompanySnap.exists()) {
              const parentData = parentCompanySnap.data();
              // Obtener admins de la empresa padre (soporte para formato antiguo)
              parentAdminIds = parentData.assignedAdminIds || 
                             (parentData.assignedAdminId ? [parentData.assignedAdminId] : []);
            }
          } catch (error) {
            console.error('❌ [AceptCompany] Error obteniendo empresa padre:', error);
          }
        }

        // Si la empresa padre no tiene admins asignados, asignar al admin actual
        if (parentAdminIds.length === 0) {
          parentAdminIds = [currentAdminId];
        }

        // Asegurar que el admin actual esté en la lista
        if (!parentAdminIds.includes(currentAdminId)) {
          parentAdminIds.push(currentAdminId);
        }

        await setDoc(doc(db, tenantCompaniesPath, companyId), {
          ...company,
          status: "approved",
          reviewedAt: new Date(),
          assignedAdminIds: parentAdminIds, // Heredar de empresa padre
          assignedAt: new Date()
        }, { merge: true });

        enqueueSnackbar(`Cliente "${company.companyName || company.name}" aprobado correctamente`, {
          variant: 'success',
          autoHideDuration: 3000
        });
      } else {
        // Aprobar empresa principal (necesita email y actualización de usuario)
        if (!company.ownerId) {
          console.error('❌ [AceptCompany] Falta ownerId:', company);
          throw new Error("Falta ownerId en la empresa");
        }

        const safeCompanyName = (company.companyName || company.name).toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9.-]/g, "");
        const generatedEmail = `${safeCompanyName}@controldoc.app`;

        const realemail = company.realemail || company.email;
        if (!realemail) {
          console.error('❌ [AceptCompany] Falta email real:', company);
          throw new Error("No se encontró el email real de la empresa");
        }

        console.log('✅ [AceptCompany] Aprobando empresa principal:', {
          companyId,
          companyName: company.companyName || company.name,
          ownerId: company.ownerId,
          generatedEmail,
          realemail
        });

        // 1. Aprobar empresa y actualizar Firestore usando rutas de tenant
        console.log('📝 [AceptCompany] Actualizando empresa en:', tenantCompaniesPath);
        const currentAdminId = auth.currentUser?.uid;
        
        // Mantener admins existentes y agregar el nuevo
        const existingAdminIds = company.assignedAdminIds || [];
        const updatedAdminIds = existingAdminIds.includes(currentAdminId) 
          ? existingAdminIds 
          : [...existingAdminIds, currentAdminId];
        
        await setDoc(doc(db, tenantCompaniesPath, companyId), {
          ...company,
          status: "approved",
          reviewedAt: new Date(),
          email: generatedEmail,
          realemail: realemail,
          assignedAdminIds: updatedAdminIds,
          assignedAt: new Date()
        }, { merge: true });

        // 2. Actualizar datos del usuario usando rutas de tenant
        const tenantUsersPath = getTenantCollectionPath("users");
        console.log('📝 [AceptCompany] Actualizando usuario en:', tenantUsersPath);
        // Preservar el role existente del usuario o usar "user" por defecto
        const userRef = doc(db, tenantUsersPath, company.ownerId);
        const userSnap = await getDoc(userRef);
        const currentUserRole = userSnap.exists() ? (userSnap.data().role || "user") : "user";
        
        await setDoc(doc(db, tenantUsersPath, company.ownerId), {
          companyId: companyId,
          companyName: company.companyName || company.name,
          companyStatus: "approved",
          hasCompany: true,
          status: "approved",
          role: currentUserRole, // Preservar role existente
          email: generatedEmail,
          realemail: realemail
        }, { merge: true });

        enqueueSnackbar(`Empresa "${company.companyName || company.name}" aprobada correctamente`, {
          variant: 'success',
          autoHideDuration: 3000
        });
      }

      console.log('✅ [AceptCompany] Aprobación exitosa');
      setTimeout(() => window.location.reload(), 1200);
      return true;

    } catch (error) {
      console.error('❌ [AceptCompany] Error al aprobar empresa:', error);
      console.error('❌ [AceptCompany] Stack:', error.stack);
      enqueueSnackbar(`Error al aprobar: ${error.message}`, {
        variant: 'error',
        persist: true
      });
      return false;
    }
  };
  
  

  const columns = [
    { id: 'type', label: 'Tipo' },
    { id: 'companyName', label: 'Nombre Empresa' },
    { id: 'email', label: 'Email' },
    { id: 'cuit', label: 'CUIT' },
    { id: 'createdAt', label: 'Fecha Registro' }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5">Aprobación de Empresas</Typography>
      <Chip 
        label={`Pendientes: ${companies.length}`} 
        color="warning" 
        sx={{ mb: 2 }}
      />
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id}>{column.label}</TableCell>
              ))}
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell>
                  {company.type === 'client' ? (
                    <Chip label="Cliente" color="info" size="small" />
                  ) : (
                    <Chip label="Empresa Principal" color="primary" size="small" />
                  )}
                </TableCell>
                <TableCell>{company.companyName || company.name}</TableCell>
                <TableCell>{company.email || company.realemail || 'N/A'}</TableCell>
                <TableCell>{company.cuit || 'N/A'}</TableCell>
                <TableCell>
                  {company.createdAt?.toDate ? company.createdAt.toDate().toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }) : company.createdAt ? new Date(company.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  }) : 'N/A'}
                </TableCell>
                <TableCell>
                <Button 
  variant="contained" 
  color="success"
  onClick={async () => {
    await approveCompany(company.id); // ya muestra snackbar y hace reload
  }}
  sx={{ mr: 1 }}
>
  Aprobar
</Button>

                                     <Button 
                     variant="outlined" 
                     color="error"
                     onClick={() => handleDecision(company.id, "rejected")}
                   >
                     Rechazar
                   </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AdminAcceptCompanyPage;