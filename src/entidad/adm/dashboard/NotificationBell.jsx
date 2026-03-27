import React, { useEffect, useState } from "react";
import { Badge, IconButton, Tooltip, Popover, List, ListItem, ListItemText, Typography, Button, Box, Chip } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { db, auth } from "../../../firebaseconfig";
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import { useCompanies } from '../../../context/CompaniesContext';

export default function NotificationBell() {
  const [pendingDocs, setPendingDocs] = useState([]);
  const [pendingCompanies, setPendingCompanies] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const { selectedCompany, companies } = useCompanies();

  // Listener para empresas pendientes de aprobación (status == "pending")
  useEffect(() => {
    // Usar la ruta multi-tenant correcta
    const companiesCollectionPath = getTenantCollectionPath('companies');
    
    // Obtener el ID del admin actual
    const currentAdminId = auth.currentUser?.uid;
    
    if (!currentAdminId) {
      setPendingCompanies([]);
      return;
    }
    
    // Obtener empresas aprobadas asignadas al admin para filtrar clientes
    let assignedCompanyIds = new Set();
    const loadAssignedCompanies = async () => {
      try {
        const [newFormatSnapshot, oldFormatSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, companiesCollectionPath),
            where("assignedAdminIds", "array-contains", currentAdminId),
            where("status", "==", "approved")
          )),
          getDocs(query(
            collection(db, companiesCollectionPath),
            where("assignedAdminId", "==", currentAdminId),
            where("status", "==", "approved")
          ))
        ]);
        
        [...newFormatSnapshot.docs, ...oldFormatSnapshot.docs].forEach(doc => {
          assignedCompanyIds.add(doc.id);
        });
      } catch (error) {
        console.error('Error cargando empresas asignadas:', error);
      }
    };
    
    loadAssignedCompanies();
    
    const q = query(
      collection(db, companiesCollectionPath),
      where("status", "==", "pending")
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Recargar empresas asignadas en cada actualización
      await loadAssignedCompanies();
      
      const allCompanies = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          let parentCompanyName = null;
          let parentAssignedAdminIds = [];
          
          // Si es un cliente, obtener el nombre y admins de la empresa padre
          if (data.type === 'client' && data.parentCompanyId) {
            try {
              const parentCompanyRef = doc(db, companiesCollectionPath, data.parentCompanyId);
              const parentCompanySnap = await getDoc(parentCompanyRef);
              if (parentCompanySnap.exists()) {
                const parentData = parentCompanySnap.data();
                parentCompanyName = parentData.companyName || parentData.name || data.parentCompanyId;
                parentAssignedAdminIds = parentData.assignedAdminIds || 
                                       (parentData.assignedAdminId ? [parentData.assignedAdminId] : []);
              }
            } catch (error) {
              console.error('Error obteniendo empresa padre:', error);
              parentCompanyName = data.parentCompanyId;
            }
          }
          
          return { 
            id: docSnap.id, 
            ...data,
            parentCompanyName,
            parentAssignedAdminIds
          };
        })
      );
      
      // Filtrar: solo empresas principales asignadas o clientes de empresas asignadas
      const filteredCompanies = allCompanies.filter(company => {
        // Si es empresa principal: mostrar si está asignada o sin asignar aún
        if (company.type !== 'client') {
          const hasAssignedAdmins = (company.assignedAdminIds && company.assignedAdminIds.length > 0) || company.assignedAdminId;
          return !hasAssignedAdmins || assignedCompanyIds.has(company.id);
        } 
        // Si es cliente: mostrar solo si la empresa padre está asignada al admin
        else if (company.parentCompanyId) {
          return assignedCompanyIds.has(company.parentCompanyId);
        }
        return false;
      });
      
      setPendingCompanies(filteredCompanies);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listener reactivo para documentos pendientes de revisión (excluir documentos en proceso)
    // Usar la ruta multi-tenant correcta
    const uploadedDocumentsPath = 'uploadedDocuments';
    
    // Construir query con filtro por empresa si está seleccionada
    let q = query(
      collection(db, uploadedDocumentsPath),
      where("status", "==", "Pendiente de revisión")
    );
    
    // Si hay una empresa seleccionada, filtrar por esa empresa
    if (selectedCompany?.id) {
      q = query(
        collection(db, uploadedDocumentsPath),
        where("status", "==", "Pendiente de revisión"),
        where("companyId", "==", selectedCompany.id)
      );
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Filtrar documentos válidos
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(doc =>
          doc.companyId &&
          (doc.name || doc.nombre) &&
          (doc.deleted === undefined || doc.deleted === false)
        );
      setPendingDocs(docs);
    });
    return () => unsubscribe();
  }, [selectedCompany?.id]); // ← Dependencia para reaccionar a cambios de empresa

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const open = Boolean(anchorEl);
  
  // Función para obtener nombre de empresa usando CompaniesContext
  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || company?.companyName || 'Empresa no encontrada';
  };
  
  // Sumar empresas pendientes y documentos pendientes al badge
  const totalAlerts = pendingDocs.length + pendingCompanies.length;

  return (
    <>
      <Tooltip title="Empresas y documentos pendientes de aprobación">
        <IconButton onClick={handleOpen} size="large" sx={{ color: "var(--navbar-background-text)" }}>
          <Badge 
            badgeContent={totalAlerts} 
            color={totalAlerts === 0 ? "success" : "error"} 
            max={99}
            showZero
          >
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 320, maxWidth: 400 } }}
      >
        {/* Sección empresas pendientes */}
        <Box sx={{ p: 2, pb: 0 }}>
          <Typography variant="h6" gutterBottom>Empresas pendientes de aprobación</Typography>
          {pendingCompanies.length === 0 ? (
            <Typography color="success.main">No hay empresas pendientes</Typography>
          ) : (
            <List dense>
              {pendingCompanies.map((company) => (
                <ListItem key={company.id} alignItems="flex-start" sx={{ borderBottom: '1px solid #eee' }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{company.companyName || 'Empresa sin nombre'}</span>
                        {company.type === 'client' && (
                          <Chip label="Cliente" color="info" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        )}
                      </Box>
                    }
                    secondary={
                      <>
                        {company.type === 'client' && company.parentCompanyName && (
                          <>
                            <Typography component="span" variant="body2" sx={{ color: "var(--page-background-text)" }}>
                              Cliente de: {company.parentCompanyName}
                            </Typography><br />
                          </>
                        )}
                        {company.cuit && (
                          <>
                            <Typography component="span" variant="body2" sx={{ color: "var(--page-background-text)" }}>
                              CUIT: {company.cuit}
                            </Typography><br />
                          </>
                        )}
                        {company.realemail && (
                          <>
                            <Typography component="span" variant="body2" sx={{ color: "var(--page-background-text)" }}>
                              Email: {company.realemail}
                            </Typography><br />
                          </>
                        )}
                        {company.createdAt && (
                          <Typography component="span" variant="caption" sx={{ color: "var(--page-background-text)", opacity: 0.7 }}>
                            Fecha: {company.createdAt.seconds ? new Date(company.createdAt.seconds * 1000).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : company.createdAt}
                          </Typography>
                        )}
                      </>
                    }
                  />
                  <Button size="small" variant="contained" color="primary" sx={{ ml: 1 }}
                    onClick={() => {
                      navigate('/admin/company-approvals');
                      handleClose();
                    }}>
                    Aprobar
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
        {/* Sección documentos pendientes */}
        <Box sx={{ p: 2, pt: 0 }}>
          <Typography variant="h6" gutterBottom>
            Documentos pendientes
            {selectedCompany && (
              <Typography component="span" variant="caption" sx={{ ml: 1, color: "var(--page-background-text)", opacity: 0.7 }}>
                (Empresa: {selectedCompany.name})
              </Typography>
            )}
          </Typography>
          {pendingDocs.length === 0 ? (
            <Typography color="success.main">
              {selectedCompany ? `No hay documentos pendientes para ${selectedCompany.name}` : 'No hay documentos pendientes'}
            </Typography>
          ) : (
            <List dense>
              {pendingDocs.map((doc) => (
                <ListItem key={doc.id} alignItems="flex-start" sx={{ borderBottom: '1px solid #eee' }}>
                  <ListItemText
                    primary={doc.name || 'Documento sin nombre'}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" sx={{ color: "var(--page-background-text)" }}>
                          Empresa: {getCompanyName(doc.companyId)}
                        </Typography><br />
                        {doc.createdAt && (
                          <Typography component="span" variant="caption" sx={{ color: "var(--page-background-text)", opacity: 0.7 }}>
                            Fecha: {doc.createdAt.seconds ? new Date(doc.createdAt.seconds * 1000).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : doc.createdAt}
                          </Typography>
                        )}
                      </>
                    }
                  />
                  <Button size="small" variant="contained" color="primary" sx={{ ml: 1 }}
                    onClick={() => {
                      navigate(`/admin/uploaded-documents?empresa=${doc.companyId}&docId=${doc.id}`);
                      handleClose();
                    }}>
                    Revisar
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}

