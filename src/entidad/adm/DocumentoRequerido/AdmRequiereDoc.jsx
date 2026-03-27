//adm/DocumentoRequerido/AdmRequiereDoc.jsx
"use client";

import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../../config/firebaseconfig";
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, updateDoc } from "firebase/firestore";
import { useCompanies } from "../../../context/CompaniesContext";
import DocumentTemplateManager from "./DocumentTemplateManager";
import DocumentList from "./DocumentList";
import FormularioNuevoDocumento from "./FormularioNuevoDocumento";
import ExampleUploader from "./dialogs/ExampleUploader"; // Importar el nuevo componente
import RequiredDocumentDialog from "./dialogs/RequiredDocumentDialog";
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Alert,
  AlertTitle,
  IconButton,
  Tooltip,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  useTheme,
  Snackbar
} from "@mui/material";

import SelectFromAdminStoreDialog from "./dialogs/SelectFromAdminStoreDialog";
import { createRequiredDocument } from '../../../utils/MetadataService'; // Importar el servicio

import { useAuth } from '../../../context/AuthContext';
import TourVirtual from '../../../components/common/TourVirtual';
import pasosTour from './requiredTour';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';

export default function AdminRequiredDocumentsPage() {
  const { user } = useAuth();
  // Robust, case-insensitive role check for admin/superadmin
  const privilegedRoles = ['admin', 'max', 'dhhkvja'];
  const userRole = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : 'user';
  const isPrivileged = privilegedRoles.includes(userRole);

  const [documents, setDocuments] = useState([]);
  const [newDocName, setNewDocName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteDialogState, setDeleteDialogState] = useState({ open: false, documentId: null });
  const [exampleImage, setExampleImage] = useState(null);
  const [expirationDate, setExpirationDate] = useState("");
  const [exampleComment, setExampleComment] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showExampleSnackbar, setShowExampleSnackbar] = useState(false);
  const [refreshDocs, setRefreshDocs] = useState(false);
  const { selectedCompany, companies } = useCompanies();

  
  const selectedCompanyId =
  selectedCompany === null
    ? 'todas'
    : typeof selectedCompany === 'string'
    ? selectedCompany
    : selectedCompany?.id || '';
  const theme = useTheme();
  const triggerRefresh = () => setRefreshDocs(prev => !prev);
  const [validationErrors, setValidationErrors] = useState({
    name: '',
    entityType: '',
    deadline: ''
  });

  // === Estados para explorador de almacenamiento ===
  const [selectFromAdminStoreOpen, setSelectFromAdminStoreOpen] = useState(false);
  const [selectingFromAdminStore, setSelectingFromAdminStore] = useState(false);

  // === Estados para appliesTo ===
  const [appliesToAllClients, setAppliesToAllClients] = useState(true);
  const [selectedClientIds, setSelectedClientIds] = useState([]);


  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[AdmRequiereDoc] useEffect - selectedCompanyId cambió:', {
        selectedCompanyId,
        tipo: typeof selectedCompanyId,
        esTodas: selectedCompanyId === 'todas'
      });
    }
    
    if (selectedCompanyId) {
      loadDocuments();
    } else {
      if (import.meta.env.DEV) {
        console.log('[AdmRequiereDoc] useEffect: No hay selectedCompanyId, limpiando documentos');
      }
      setDocuments([]);
      setLoading(false);
    }
  }, [selectedCompanyId]);

  // Handler para agregar documentos seleccionados desde almacenamiento
  const handleAddFromAdminStore = async (selectedFiles) => {
    console.log('[AdmRequiereDoc] Archivos seleccionados desde almacenamiento:', selectedFiles);
    if (!selectedFiles?.length) return;
    const file = selectedFiles[0];
    console.log('[AdmRequiereDoc] Procesando archivo:', file);
    
    // Solo actualizar si el campo actual está vacío o null/undefined
    setExampleImage(prev => prev || file.fileURL);
    setNewDocName(prev => (prev === '' || prev === null || prev === undefined) ? (file.name || file.nombreOriginal || '') : prev);
    setExpirationDate(prev => (prev === '' || prev === null || prev === undefined) ? (file.expirationDate || '') : prev);
    setExampleComment(prev => (prev === '' || prev === null || prev === undefined) ? (file.exampleComment || '') : prev);
    
    setShowExampleSnackbar(true);
    setSelectFromAdminStoreOpen(false);
  };
  

  const loadDocuments = async () => {
    if (!selectedCompanyId) {
      if (import.meta.env.DEV) {
        console.log('[AdmRequiereDoc] loadDocuments: No hay selectedCompanyId, retornando');
      }
      return;
    }
    
    if (import.meta.env.DEV) {
      console.log('[AdmRequiereDoc] loadDocuments: Iniciando carga para empresa:', {
        selectedCompanyId,
        tipo: typeof selectedCompanyId
      });
    }
    
    setLoading(true);
    setError("");
    try {
      // Usar la ruta multi-tenant correcta
      const tenantCollectionPath = 'requiredDocuments';
      const normalizedCompanyId = String(selectedCompanyId).trim();
      
      if (import.meta.env.DEV) {
        console.log('[AdmRequiereDoc] loadDocuments: Consultando Firestore:', {
          tenantCollectionPath,
          normalizedCompanyId,
          originalCompanyId: selectedCompanyId,
          esTodas: normalizedCompanyId === 'todas'
        });
      }
      
      // Si es 'todas', no filtrar por companyId
      const q = normalizedCompanyId === 'todas'
        ? query(collection(db, tenantCollectionPath))
        : query(
            collection(db, tenantCollectionPath),
            where("companyId", "==", normalizedCompanyId)
          );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (import.meta.env.DEV) {
        console.log('[AdmRequiereDoc] loadDocuments: Documentos encontrados:', {
          cantidad: list.length,
          companyId: normalizedCompanyId,
          documentos: list.map(d => ({ id: d.id, name: d.name, companyId: d.companyId, entityType: d.entityType }))
        });
      }
      
      setDocuments(list);
    } catch (error) {
      console.error("[AdmRequiereDoc] Error loading documents:", error);
      setError("Error al cargar los documentos.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async () => {
    // ✅ Eliminamos e.preventDefault()

    if (expirationDate) {
      const today = new Date();
      const oneYearTwoMonthsLater = new Date(today);
      oneYearTwoMonthsLater.setFullYear(today.getFullYear() + 1);
      oneYearTwoMonthsLater.setMonth(today.getMonth() + 2);

      const selectedDate = new Date(expirationDate);
      if (selectedDate > oneYearTwoMonthsLater) {
        if (!window.confirm('ATENCIÓN: Estás estableciendo una fecha de vencimiento muy lejana (más de 1 año y 2 meses). ¿Deseas continuar?')) {
          return { success: false, error: 'Fecha de vencimiento demasiado lejana.' };
        }
      }
    }

    if (!validateForm()) return { success: false, error: 'Validación de formulario fallida.' };

    setLoading(true);
    setError("");

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      // Buscar empresa/cliente actual
      const empresaActual = companies.find(c => c.id === selectedCompanyId);
      
      // Validación defensiva: Si es un cliente (tiene parentCompanyId), usar parentCompanyId como companyId
      // Si es una empresa principal, usar su ID directamente
      // companyId en Firestore SIEMPRE debe ser la empresa principal
      const finalCompanyId = empresaActual?.parentCompanyId || empresaActual?.id || "";
      const isClient = empresaActual?.parentCompanyId ? true : false;
      
      if (import.meta.env.DEV) {
        console.log('[AdmRequiereDoc] Determinar companyId:', {
          selectedCompanyId,
          empresaActual: empresaActual ? {
            id: empresaActual.id,
            name: empresaActual.name,
            type: empresaActual.type,
            parentCompanyId: empresaActual.parentCompanyId
          } : null,
          isClient,
          finalCompanyId
        });
      }
      
      const empresa = {
        realemail: empresaActual?.realemail || "",
        companyId: finalCompanyId, // ✅ Siempre empresa principal
        companyName: empresaActual?.name || "",
        email: empresaActual?.email || "" // @controldoc.app
      };
      // Construir appliesTo: si estamos creando para un cliente concreto, NUNCA guardar clients=null
      let appliesToData;
      if (isClient) {
        // Creación desde vista cliente: solo este cliente (id del cliente = selectedCompanyId)
        appliesToData = { main: false, clients: [selectedCompanyId] };
      } else {
        appliesToData = {
          main: false,
          clients: appliesToAllClients ? null : (selectedClientIds.length > 0 ? selectedClientIds : [])
        };
      }

      console.log('[AdmRequiereDoc] appliesToData (payload final):', {
        isClient,
        selectedCompanyId,
        appliesToAllClients,
        selectedClientIds,
        appliesToData
      });

      const docData = {
        name: newDocName.trim(),
        entityType,
        companyId: empresa.companyId,
        realemail: empresa.realemail,
        email: empresa.email,
        expirationDate: expirationDate || null,
        exampleImage: exampleImage || "",
        adminComment: "",
        companyComment: "",
        exampleComment: exampleComment || "",
        allowedFileTypes: [".pdf", ".jpg", ".jpeg", ".png"],
        version: 1,
        subversion: 0,
        versionString: "1.0",
        appliesTo: appliesToData,
        createdFor: {
          companyId: empresa.companyId,
          companyName: empresa.companyName,
          realemail: empresa.realemail,
          email: empresa.email
        },
        createdBy: {
          uid: user?.uid || "",
          realemail: user?.realemail || user?.email || "",
          email: user?.email || ""
        },
        uploadedBy: {
          uid: user?.uid || "",
          realemail: user?.realemail || user?.email || "",
          email: user?.email || ""
        }
      };
      
      if (selectedCompanyId === 'todas') {
        // Usar la ruta multi-tenant correcta para companies
        const companiesCollectionPath = getTenantCollectionPath('companies');
        const snapshot = await getDocs(collection(db, companiesCollectionPath));
        const todasLasEmpresas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtrar solo empresas principales (no clientes)
        const empresasPrincipales = todasLasEmpresas.filter(emp => 
          !emp.parentCompanyId && (emp.type !== 'client' || !emp.type)
        );

        if (empresasPrincipales.length === 0) {
          setError("No se encontraron empresas principales en la base de datos.");
          return { success: false, error: 'No se encontraron empresas principales en la base de datos.' };
        }

        await Promise.all(empresasPrincipales.map((empresa) => {
          return createRequiredDocument({
            user,
            data: {
              ...docData,
              companyId: empresa.id, // ✅ Siempre empresa principal
              realemail: empresa.realemail,
              email: empresa.email,
              createdFor: {
                companyId: empresa.id,
                realemail: empresa.realemail,
                email: empresa.email,
                companyName: empresa.companyName || empresa.name
              },
              uploadedBy: {
                uid: user?.uid || "",
                realemail: user?.realemail || user?.email || "",
                email: user?.email || ""
              }
            },
            companyId: empresa.id
          });
        }));

        alert(`✅ Documento creado para ${empresasPrincipales.length} empresas principales.`);
      } else {
        // Usar finalCompanyId (ya calculado arriba) en lugar de selectedCompanyId
        console.log('[AdmRequiereDoc] createRequiredDocument payload final:', {
          companyId: finalCompanyId,
          appliesTo: docData.appliesTo,
          name: docData.name,
          entityType: docData.entityType
        });
        await createRequiredDocument({ user, data: docData, companyId: finalCompanyId });
      }
      triggerRefresh(); 
      await loadDocuments();
      resetForm();
      return { success: true };
    } catch (error) {
      setError("Error al crear documento: " + error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  


  const validateForm = () => {
    const errors = {
      name: !newDocName.trim() ? 'El nombre es requerido' : '',
      entityType: !entityType ? 'Selecciona un tipo' : '',
      deadline: !expirationDate ? 'Fecha requerida' : ''
    };
    setValidationErrors(errors);
    return !Object.values(errors).some(error => error);
  };

  const resetForm = () => {
    setNewDocName("");
    setEntityType("");
    setExpirationDate("");
    setExampleImage(null);
    setExampleComment("");
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogState({ open: false, documentId: null });
  };

  const handleDeleteDocument = async () => {
    const documentIdToDelete = deleteDialogState.documentId;
    if (!documentIdToDelete) return;
  
    setDeleteDialogState({ open: false, documentId: null });
  
    setTimeout(async () => {
      try {
        setLoading(true);
        const tenantCollectionPath = 'requiredDocuments';
        await deleteDoc(doc(db, tenantCollectionPath, documentIdToDelete));
        triggerRefresh(); // ✅ Actualiza la lista reactivamente
      } catch (error) {
        console.error("Error deleting document:", error);
        setError("Error al eliminar el documento.");
      } finally {
        setLoading(false);
      }
    }, 100);
  };
  
  const handleDeleteMultipleDocuments = async (ids) => {
    if (!ids || ids.length === 0) return;
  
    const confirm = window.confirm(`¿Seguro que querés eliminar ${ids.length} documentos seleccionados?`);
    if (!confirm) return;
  
    try {
      setLoading(true);
      const tenantCollectionPath = 'requiredDocuments';
      await Promise.all(
        ids.map((id) => deleteDoc(doc(db, tenantCollectionPath, id)))
      );
      triggerRefresh(); // ✅ Actualiza la lista reactivamente
    } catch (error) {
      console.error("Error eliminando múltiples documentos:", error);
      setError("Ocurrió un error al eliminar los documentos seleccionados.");
    } finally {
      setLoading(false);
    }
  };
  
  

  const handleExpirationDateChange = (e) => {
    const selectedDate = e.target.value;
  
    // Si la fecha es incompleta, simplemente guardarla sin validar aún
    if (!selectedDate || selectedDate.length < 10) {
      setExpirationDate(selectedDate);
      return;
    }
  
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    const dateObj = new Date(selectedDate);
  
    // Si la fecha es inválida, no continuar (opcionalmente podrías mostrar error)
    if (isNaN(dateObj.getTime())) {
      return;
    }
  
    // Validación de rango de años
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 100;
    
    if (dateObj.getFullYear() < currentYear || dateObj.getFullYear() > maxYear) {
      setValidationErrors(prev => ({
        ...prev,
        deadline: `El año debe estar entre ${currentYear} y ${maxYear}`
      }));
    } else if (dateObj < today) {
      setValidationErrors(prev => ({
        ...prev,
        deadline: 'La fecha no puede ser anterior al día actual'
      }));
    } else {
      setValidationErrors(prev => ({
        ...prev,
        deadline: ''
      }));
    }
  
    setExpirationDate(selectedDate);
  };
  

  return (
    <Box>
      {/* Cabecera con botón de tour */}
      <Box display="flex" alignItems="center" gap={2}>
        <Typography id="tour-titulo-docs" variant="h4" gutterBottom fontWeight="bold">
          Documentos Requeridos
        </Typography>
        <TourVirtual
          steps={pasosTour}
          buttonLabel="Ver tour"
          driverOptions={{ showProgress: true }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* UI indicator for role and access */}
      
      {/* Privileged roles can always create required documents */}
      {isPrivileged && (
        <div id="tour-form-nuevo-doc">
          <FormularioNuevoDocumento
            loading={loading}
            validationErrors={validationErrors}
            newDocName={newDocName}
            setNewDocName={setNewDocName}
            entityType={entityType}
            setEntityType={setEntityType}
            expirationDate={expirationDate}
            handleExpirationDateChange={handleExpirationDateChange}
            exampleComment={exampleComment}
            setExampleComment={setExampleComment}
            exampleImage={exampleImage} 
            setExampleImage={setExampleImage}
            setExpirationDate={setExpirationDate}
            setSelectFromAdminStoreOpen={setSelectFromAdminStoreOpen}
            onSubmit={handleCreateDocument}
            selectedCompanyId={selectedCompanyId}
            selectedCompanyNameDisplay={
              selectedCompanyId === 'todas'
                ? 'TODAS LAS EMPRESAS'
                : companies.find(c => c.id === selectedCompanyId)?.name || 'Empresa desconocida'
            }
            appliesToAllClients={appliesToAllClients}
            setAppliesToAllClients={setAppliesToAllClients}
            selectedClientIds={selectedClientIds}
            setSelectedClientIds={setSelectedClientIds}
          />
        </div>
      )}

      {/* Diálogo para seleccionar archivos desde almacenamiento */}
      <SelectFromAdminStoreDialog
        open={selectFromAdminStoreOpen}
        onClose={() => setSelectFromAdminStoreOpen(false)}
        onConfirm={handleAddFromAdminStore}
      />
{/* Gestor de plantillas de documentos requeridos */}
<DocumentTemplateManager
        currentDocuments={documents}
        triggerRefresh={() => setRefreshDocs(prev => !prev)}
        onApplyTemplate={async (docsFromTemplate) => {
          if (!selectedCompanyId) return;
        
          const confirmReplace = window.confirm(
            "¿Deseas REEMPLAZAR todos los documentos requeridos actuales por los de la plantilla?\n\n" +
            "Selecciona 'Aceptar' para reemplazar o 'Cancelar' para AGREGAR los documentos sin borrar los existentes."
          );
        
          setLoading(true);
          setError("");
          let successMsg = "";
        
          try {
            if (confirmReplace) {
              // 🔥 BORRAR los documentos existentes
              const tenantCollectionPath = 'requiredDocuments';
              const q = query(collection(db, tenantCollectionPath), where("companyId", "==", selectedCompanyId));
              const snapshot = await getDocs(q);
              const batchDeletes = snapshot.docs.map((docSnap) =>
                deleteDoc(doc(db, tenantCollectionPath, docSnap.id))
              );
              await Promise.all(batchDeletes);
            }
        
            // ➕ AGREGAR los documentos de la plantilla
            const addOps = docsFromTemplate.map(async (docTmpl) => {
              const { id, ...docData } = docTmpl; // Evitar conflicto con id
              const tenantCollectionPath = 'requiredDocuments';
              await addDoc(collection(db, tenantCollectionPath), {
                ...docData,
                companyId: selectedCompanyId,
                createdAt: new Date().toISOString(),
                subidoDesde: "plantilla",
              });
            });
            await Promise.all(addOps);
        
            await loadDocuments();              // Esto actualiza el listado inmediato
            setRefreshDocs(prev => !prev);     // 👈 Esto actualiza DocumentList también
        
            successMsg = confirmReplace
              ? "Plantilla aplicada correctamente. Se reemplazaron los documentos requeridos."
              : "Plantilla aplicada correctamente. Se agregaron los documentos a los existentes.";
        
          } catch (err) {
            setError("Error al aplicar plantilla: " + (err.message || err));
          } finally {
            setLoading(false);
            if (successMsg) alert(successMsg);
          }
        }}
        
      />
<div id="tour-lista-docs">
  <DocumentList
    mode="requeridos"
    companyId={selectedCompanyId}
    refreshTrigger={refreshDocs}
    requiredDocuments={documents} // ← Pasar documentos requeridos como prop
    onDeleteDocument={(idOrIds) => {
      if (Array.isArray(idOrIds)) {
        handleDeleteMultipleDocuments(idOrIds);
      } else {
        setDeleteDialogState({ open: true, documentId: idOrIds });
      }
    }}
    onEditDocument={(doc) => {
      setSelectedDoc(doc);
      setDialogOpen(true);
    }}
    user={user} // ← Prop user agregada
  />
</div>
    {/* Diálogo de confirmación */}
    <Dialog
      open={deleteDialogState.open}
      onClose={handleCloseDeleteDialog}
    >
      <DialogTitle>Confirmar eliminación</DialogTitle>
      <DialogContent>
        <DialogContentText>
          ¿Estás seguro que deseas eliminar este documento?
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseDeleteDialog}>
          Cancelar
        </Button>
        <Button color="error" onClick={handleDeleteDocument} variant="contained">
          Eliminar
        </Button>
      </DialogActions>
    </Dialog>

    {selectedDoc && (
      <RequiredDocumentDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedDoc(null);
        }}
        document={selectedDoc}
        onSave={async (updatedDoc) => {
          try {
            const tenantCollectionPath = 'requiredDocuments';
            const docRef = doc(db, tenantCollectionPath, selectedDoc.id);
            await updateDoc(docRef, updatedDoc);
            
            // Si cambió el exampleImage, analizarlo y guardar metadata
            if (updatedDoc.exampleImage && updatedDoc.exampleImage !== selectedDoc.exampleImage) {
              try {
                const { analyzeExampleImage } = await import('../../../utils/MetadataService');
                await analyzeExampleImage(
                  selectedDoc.id, 
                  updatedDoc.exampleImage, 
                  updatedDoc.companyId || selectedDoc.companyId
                );
                console.log(`✅ Metadata del exampleImage guardada después de actualizar documento ${selectedDoc.id}`);
              } catch (error) {
                console.warn("Error analizando exampleImage después de actualizar:", error);
                // No fallar la actualización si el análisis falla
              }
            }
            
            await loadDocuments();
          } catch (error) {
            console.error("Error updating document:", error);
            setError("Error al actualizar el documento");
          }
        }}
      />
    )}

   
  </Box>
  )
}
