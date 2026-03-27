// src/component/adm/DocumentoRequerido/FormularioNuevoDocumento.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
  CircularProgress,
  Typography,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Tooltip,
  Autocomplete,
  Checkbox,
  FormControlLabel,
  FormGroup,
  OutlinedInput,
  Chip,
  ListItemText
} from "@mui/material";
import ExampleUploader from "./dialogs/ExampleUploader";
import { useAuth } from '../../../context/AuthContext';
import { Dialog as MuiDialog } from '@mui/material'; // Para evitar conflicto de nombres
import { useDocumentEntityTypes } from "../../../utils/useDocumentEntityTypes";
import BulkAddDocumentNamesDialog from './dialogs/BulkAddDocumentNamesDialog';
import { db } from '../../../config/firebaseconfig';
import VistaPrevia from '../../../components/common/VistaPrevia';
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, limit } from 'firebase/firestore';
import { orderBy } from 'firebase/firestore';
import { getTenantCollectionPath } from '../../../utils/tenantUtils';

function getFileTypeFromUrl(url) {
  if (!url) return "";
  if (url.match(/\.pdf$/i)) return "application/pdf";
  if (url.match(/\.(jpg|jpeg)$/i)) return "image/jpeg";
  if (url.match(/\.png$/i)) return "image/png";
  if (url.match(/\.gif$/i)) return "image/gif";
  // Puedes agregar más tipos según tus necesidades
  return "";
}

export default function FormularioNuevoDocumento({
  loading,
  validationErrors,
  newDocName,
  setNewDocName,
  entityType,
  setEntityType,
  expirationDate,
  handleExpirationDateChange,
  exampleComment,
  setExampleComment,
  exampleImage,
  setExampleImage,
  setExpirationDate,
  setSelectFromAdminStoreOpen,
  onSubmit,
  selectedCompanyId,
  selectedCompanyNameDisplay,
  appliesToAllClients,
  setAppliesToAllClients,
  selectedClientIds,
  setSelectedClientIds,
}) {
  const { user, getUserTenantCollectionPath } = useAuth();
  // Control estricto: solo 'max' (sin espacios, case-insensitive), NUNCA 'DhHkVja'
  let isSuperAdmin = false;
  let roleNorm = '';
  if (typeof user?.role === 'string') {
    // Si el rol es exactamente 'max' (case-insensitive, sin espacios) y NO es 'dhhkvja'
    roleNorm = user.role.trim().toLowerCase();
    isSuperAdmin = roleNorm === 'max';
    if (roleNorm === 'dhhkvja') isSuperAdmin = false;
  }
  
  // Estado para clientes de la empresa seleccionada
  const [companyClients, setCompanyClients] = useState([]);
  
  // Cargar clientes cuando se selecciona una empresa
  useEffect(() => {
    const fetchCompanyClients = async () => {
      if (selectedCompanyId && selectedCompanyId !== 'todas' && user?.uid) {
        try {
          const companiesPath = getUserTenantCollectionPath('companies');
          if (!companiesPath) return;
          
          const q = query(
            collection(db, companiesPath),
            where('parentCompanyId', '==', selectedCompanyId),
            where('active', '==', true),
            where('status', '==', 'approved')
          );
          const snapshot = await getDocs(q);
          const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCompanyClients(clientsData);
        } catch (error) {
          console.error("Error fetching company clients:", error);
          setCompanyClients([]);
        }
      } else {
        setCompanyClients([]);
      }
    };
    fetchCompanyClients();
  }, [selectedCompanyId, user, getUserTenantCollectionPath]);

  // Estado local editable solo para superadmin (en memoria)
  const [editableOptions, setEditableOptions] = useState([]); // Inicialmente vacío hasta cargar desde Firestore
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [dbLoading, setDbLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [editCategoriesOpen, setEditCategoriesOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  // Cargar nombres desde Firestore al montar - USANDO ESTRUCTURA MULTI-TENANT
  useEffect(() => {
    const fetchDocumentNames = async () => {
      setDbLoading(true);
      try {
        const names = [];
        // Usar la ruta multi-tenant correcta
        const tenantCollectionPath = getTenantCollectionPath('documentNames');
        
        // Determinar el createdBy a filtrar
        let filterCreatedBy = null;
        if (isSuperAdmin) {
          filterCreatedBy = user?.uid;
        } else if (user?.createdBy?.uid) {
          // Administrador: usar el superadmin que lo creó
          filterCreatedBy = user.createdBy.uid;
        }
        
        let q;
        if (filterCreatedBy) {
          q = query(
            collection(db, tenantCollectionPath),
            where('createdBy', '==', filterCreatedBy),
            orderBy('name')
          );
        } else {
          q = query(collection(db, tenantCollectionPath), orderBy('name'));
        }
        
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          names.push(doc.data().name);
        });
        // Ordenar alfabéticamente (por si acaso)
        const sortedNames = names.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        setEditableOptions(sortedNames);
      } catch (error) {
        console.error("Error loading documents: ", error);
        setErrorMsg("Error al cargar nombres de documentos");
      } finally {
        setDbLoading(false);
      }
    };

    fetchDocumentNames();
  }, [user, isSuperAdmin]);


  // Buscar ejemplo para el documento seleccionado - USANDO ESTRUCTURA MULTI-TENANT
  const fetchExampleForDocument = async (docName) => {
    try {
      // Usar la ruta multi-tenant correcta para requiredDocuments
      const tenantCollectionPath = 'requiredDocuments';
      const q = query(
        collection(db, tenantCollectionPath),
        where('name', '==', docName),
        limit(1)
      );
      const snapshot = await getDocs(q);
  
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setExampleImage(data?.exampleImage || "");
        setExampleComment(data?.exampleComment || "");
      } else {
        // Si no se encontró ningún documento, limpiar
        setExampleImage("");
        setExampleComment("");
      }
    } catch (error) {
      console.error('Error al buscar el ejemplo:', error);
      setExampleImage("");
      setExampleComment("");
    }
  };
  
  



  // Funciones para superadmin - USANDO ESTRUCTURA MULTI-TENANT
  const handleAddOption = async () => {
    const trimmedOption = newOption.trim();
    
    if (!trimmedOption) return;
    
    // Validar duplicados (case-sensitive exacto)
    if (editableOptions.some(opt => opt === trimmedOption)) {
      setErrorMsg("Ya existe un documento con ese nombre exacto");
      setShowSuccess(false);
      return;
    }
    
    try {
      setDbLoading(true);
      // Usar la ruta multi-tenant correcta
      const tenantCollectionPath = getTenantCollectionPath('documentNames');
      await addDoc(collection(db, tenantCollectionPath), {
        name: trimmedOption,
        createdAt: new Date(),
        createdBy: user?.uid || 'unknown',
      });
      setEditableOptions([...editableOptions, trimmedOption]);
      setNewOption("");
      setSuccessMsg("Nombre de documento agregado");
      setShowSuccess(true);
    } catch (error) {
      console.error("Error adding document: ", error);
      setErrorMsg("Error al agregar nombre");
      setShowSuccess(false);
    } finally {
      setDbLoading(false);
    }
  };

  const handleRemoveOption = async (option) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${option}"?\nEsta acción no se puede deshacer.`)) {
      return;
    }
    
    try {
      setDbLoading(true);
      // Usar la ruta multi-tenant correcta
      const tenantCollectionPath = getTenantCollectionPath('documentNames');
      const q = query(collection(db, tenantCollectionPath), where('name', '==', option));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = [];
      querySnapshot.forEach((document) => {
        deletePromises.push(deleteDoc(doc(db, tenantCollectionPath, document.id)));
      });
      
      await Promise.all(deletePromises);
      
      setEditableOptions(editableOptions.filter(o => o !== option));
      if (newDocName === option) setNewDocName("");
      
      setSuccessMsg(`Documento "${option}" eliminado`);
      setShowSuccess(true);
    } catch (error) {
      console.error("Error removing document: ", error);
      setErrorMsg("Error al eliminar nombre");
      setShowSuccess(false);
    } finally {
      setDbLoading(false);
    }
  };

  const isFormDisabled = loading || !(selectedCompanyId || selectedCompanyId === 'todas');
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const { entityTypes, addNewEntityType, removeEntityType, isProtectedType } = useDocumentEntityTypes(user);

  const validateForm = () => {
    const errors = {
      name: !newDocName.trim() ? 'El nombre es requerido' : '',
      entityType: !entityType ? 'Selecciona un tipo' : '',
      deadline: !expirationDate ? 'Fecha requerida' : ''
    };
    return !Object.values(errors).some(error => error);
  };

  const handleOpenPreview = (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    setShowPreviewDialog(true);
  };

  // Estado para evitar creación múltiple
  const [creating, setCreating] = useState(false);

  // Ahora el mensaje de éxito solo se muestra si la creación fue exitosa
  const handleConfirmCreate = async () => {
    if (creating) return; // Evita múltiples envíos
    setCreating(true);
    try {
      const result = await onSubmit();
      if (result && result.success) {
        setSuccessMsg("Documento creado exitosamente");
        setShowSuccess(true);
        setShowPreviewDialog(false);
      } else {
        setShowSuccess(false);
        setSuccessMsg("");
        // Aquí podrías mostrar un mensaje de error adicional si lo deseas
      }
    } finally {
      setCreating(false);
    }
  };


  const handleClosePreview = () => {
    setShowPreviewDialog(false);
  };

  const entityLabel = entityTypes.find(t => t.value === entityType)?.label || entityType;

  return (
    <>
      <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2, maxWidth: 800, backgroundColor: "var(--paper-background)" }} id="adm-required-docs-form-paper">
        <Typography variant="h6" gutterBottom sx={{ color: "var(--paper-background-text)" }} id="tour-subtitulo-nuevo-doc">
          Agregar Nuevo Documento
        </Typography>
        <Box component="form" onSubmit={handleOpenPreview} sx={{ mt: 3, display: 'flex', gap: 3 }} id="adm-required-docs-form">
          <Box sx={{ flex: 1 }} id="adm-required-docs-form-left">
            {/* Selector de nombre de documento con búsqueda, editable solo por superadmin */}
            <Autocomplete
              id="adm-required-docs-select-nombre"
              options={editableOptions}
              value={newDocName || null}
              onChange={async (event, newValue) => {
                setNewDocName(newValue || "");
                if (newValue) {
                  await fetchExampleForDocument(newValue); // ← cargar ejemplo si existe
                }
              }}
              disabled={isFormDisabled || editableOptions.length === 0}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Nombre del documento *"
                  error={!!validationErrors.name}
                  helperText={validationErrors.name}
                  size="small"
                  required
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderColor: "var(--divider-color)"
                      },
                      "&:hover fieldset": {
                        borderColor: "var(--primary-main)"
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "var(--primary-main)"
                      }
                    }
                  }}
                />
              )}
              filterOptions={(options, { inputValue }) => {
                // Filtro personalizado para búsqueda más flexible
                const filtered = options.filter(option =>
                  option.toLowerCase().includes(inputValue.toLowerCase())
                );
                return filtered;
              }}
              noOptionsText="No se encontraron documentos"
              clearOnEscape
              selectOnFocus
              handleHomeEndKeys
              sx={{ mb: 1 }}
            />

            {/* Solo superadmin (role === 'max') puede editar la lista */}
            {isSuperAdmin && (
              <>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }} id="adm-required-docs-form-nombre-edit-btns">
                  <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => setEditDialogOpen(true)} 
                  id="adm-required-docs-btn-editar-nombres"
                  sx={{
                    borderColor: "var(--divider-color)",
                    color: "var(--paper-background-text)",
                    "&:hover": {
                      borderColor: "var(--primary-main)",
                      backgroundColor: "var(--primary-main)",
                      color: "var(--primary-text)"
                    }
                  }}
                >
                    Editar lista de nombres
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    color="secondary" 
                    onClick={() => setBulkDialogOpen(true)} 
                    id="adm-required-docs-btn-bulk-nombres"
                    sx={{
                      borderColor: "var(--secondary-main)",
                      color: "var(--secondary-main)",
                      "&:hover": {
                        borderColor: "var(--secondary-dark)",
                        backgroundColor: "var(--secondary-main)",
                        color: "white"
                      }
                    }}
                  >
                    Agregar en lote
                  </Button>
                </Box>
                <MuiDialog 
                  open={editDialogOpen} 
                  onClose={() => setEditDialogOpen(false)} 
                  maxWidth="xs" 
                  fullWidth 
                  id="adm-required-docs-dialog-editar-nombres"
                  PaperProps={{
                    sx: {
                      backgroundColor: "var(--paper-background)",
                      color: "var(--paper-background-text)"
                    }
                  }}
                >
                  <DialogTitle sx={{ color: "var(--paper-background-text)" }}>Editar nombres de documentos</DialogTitle>
                  <DialogContent>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }} id="adm-required-docs-dialog-nuevo-nombre-box">
                      <TextField
                        label="Nuevo nombre"
                        value={newOption}
                        onChange={e => setNewOption(e.target.value)}
                        size="small"
                        fullWidth
                        id="adm-required-docs-dialog-nuevo-nombre"
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            "& fieldset": {
                              borderColor: "var(--divider-color)"
                            },
                            "&:hover fieldset": {
                              borderColor: "var(--primary-main)"
                            },
                            "&.Mui-focused fieldset": {
                              borderColor: "var(--primary-main)"
                            }
                          }
                        }}
                      />
                      <Button 
                        onClick={handleAddOption} 
                        variant="contained" 
                        size="small" 
                        id="adm-required-docs-dialog-btn-agregar-nombre"
                        sx={{
                          bgcolor: "var(--primary-main)",
                          color: "var(--primary-text)",
                          "&:hover": {
                            bgcolor: "var(--primary-dark)"
                          }
                        }}
                      >
                        Agregar
                      </Button>
                    </Box>
                    <Box id="adm-required-docs-dialog-lista-nombres">
                      {editableOptions.length === 0 && <Typography variant="body2" sx={{ color: "var(--paper-background-text)" }}>No hay nombres en la lista.</Typography>}
                      {editableOptions.map((option, index) => (
                        <Box key={`${option}-${index}`} sx={{ display: 'flex', alignItems: 'center', mb: 1 }} id={`adm-required-docs-dialog-nombre-row-${option.replace(/\s+/g, '-').toLowerCase()}`}>
                          <Typography sx={{ flex: 1, color: "var(--paper-background-text)" }}>{option}</Typography>
                          <Button 
                            onClick={() => handleRemoveOption(option)} 
                            color="error" 
                            size="small" 
                            id={`adm-required-docs-dialog-btn-eliminar-nombre-${option.replace(/\s+/g, '-').toLowerCase()}`}
                            sx={{
                              bgcolor: "var(--error-main)",
                              color: "white",
                              "&:hover": {
                                bgcolor: "var(--error-dark)"
                              }
                            }}
                          >
                            Eliminar
                          </Button>
                        </Box>
                      ))}
                    </Box>
                  </DialogContent>
                  <DialogActions>
                    <Button 
                      onClick={() => setEditDialogOpen(false)} 
                      id="adm-required-docs-dialog-btn-cerrar-editar-nombres"
                      sx={{
                        color: "var(--paper-background-text)"
                      }}
                    >
                      Cerrar
                    </Button>
                  </DialogActions>
                </MuiDialog>
                <BulkAddDocumentNamesDialog
                  open={bulkDialogOpen}
                  onClose={() => setBulkDialogOpen(false)}
                  loading={dbLoading}
                  onBulkAdd={async (namesArray) => {
                    setDbLoading(true);
                    let added = [];
                    let skipped = [];
                    try {
                      // Get current names (case-insensitive set)
                      const lowerExisting = new Set(editableOptions.map(opt => opt.trim().toLowerCase()));
                      const uniqueNames = Array.from(new Set(namesArray.map(n => n.trim()))).filter(Boolean);
                      const toAdd = uniqueNames.filter(n => !lowerExisting.has(n.trim().toLowerCase()));
                      skipped = uniqueNames.filter(n => lowerExisting.has(n.trim().toLowerCase()));
                      for (const name of toAdd) {
                        // Usar la ruta multi-tenant correcta
                        const tenantCollectionPath = getTenantCollectionPath('documentNames');
                        await addDoc(collection(db, tenantCollectionPath), {
                          name: name,
                          createdAt: new Date(),
                          createdBy: user?.uid || 'unknown',
                        });
                        added.push(name);
                      }
                      if (added.length > 0) {
                        setEditableOptions(prev => [...prev, ...added]);
                      }
                      return { added, skipped };
                    } catch (err) {
                      return { added, skipped, error: err.message || String(err) };
                    } finally {
                      setDbLoading(false);
                    }
                  }}
                  id="adm-required-docs-dialog-bulk-nombres"
                />
              </>
            )}
            <FormControl fullWidth error={!!validationErrors.entityType} sx={{ mb: 1 }} size="small" id="adm-required-docs-form-entitytype-ctrl">
              <InputLabel id="adm-required-docs-label-entitytype" sx={{ color: "var(--paper-background-text)" }}>Aplicable a</InputLabel>
              <Select
                id="adm-required-docs-select-entitytype"
                value={entityType || ""}
                onChange={async (e) => {
                  const value = e.target.value;
                  if (value === "__add__") {
                    const newLabel = prompt("Nombre de la nueva categoría:");
                    if (newLabel) {
                      const newValue = newLabel.toLowerCase().replace(/\s+/g, '_');
                      await addNewEntityType(newLabel);
                      setEntityType(newValue);
                    }
                  } else {
                    setEntityType(value);
                  }
                }}
                label="Aplicable a"
                disabled={isFormDisabled}
                size="small"
                sx={{
                  color: "var(--paper-background-text)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--divider-color)"
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--primary-main)"
                  },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "var(--primary-main)"
                  }
                }}
              >
                {entityTypes.map((type) => (
                  <MenuItem key={type.value} value={type.value} id={`adm-required-docs-entitytype-opcion-${type.value}`}>{type.label}</MenuItem>
                ))}
                {isSuperAdmin && (
                  <MenuItem value="__add__" sx={{ fontStyle: "italic", color: "primary.main" }} id="adm-required-docs-entitytype-opcion-add">
                    ➕ Agregar categoría personalizada
                  </MenuItem>
                )}
              </Select>
              {validationErrors.entityType && (
                <FormHelperText id="adm-required-docs-error-entitytype">{validationErrors.entityType}</FormHelperText>
              )}
            </FormControl>

            {isSuperAdmin && (
              <Button 
                variant="outlined" 
                size="small" 
                sx={{ 
                  mb: 2,
                  borderColor: "var(--divider-color)",
                  color: "var(--paper-background-text)",
                  "&:hover": {
                    borderColor: "var(--primary-main)",
                    backgroundColor: "var(--primary-main)",
                    color: "var(--primary-text)"
                  }
                }} 
                onClick={() => setEditCategoriesOpen(true)} 
                id="adm-required-docs-btn-editar-categorias"
              >
                Editar categorías
              </Button>
            )}
            <MuiDialog 
              open={editCategoriesOpen} 
              onClose={() => setEditCategoriesOpen(false)} 
              maxWidth="xs" 
              fullWidth 
              id="adm-required-docs-dialog-editar-categorias"
              PaperProps={{
                sx: {
                  backgroundColor: "var(--paper-background)",
                  color: "var(--paper-background-text)"
                }
              }}
            >
              <DialogTitle sx={{ color: "var(--paper-background-text)" }}>Editar categorías de documentos</DialogTitle>
              <DialogContent>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }} id="adm-required-docs-dialog-nueva-categoria-box">
                  <TextField
                    label="Nueva categoría"
                    value={newCategoryLabel}
                    onChange={(e) => setNewCategoryLabel(e.target.value)}
                    size="small"
                    fullWidth
                    id="adm-required-docs-dialog-nueva-categoria"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": {
                          borderColor: "var(--divider-color)"
                        },
                        "&:hover fieldset": {
                          borderColor: "var(--primary-main)"
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "var(--primary-main)"
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={async () => {
                      if (!newCategoryLabel.trim()) return;
                      
                      // Validar duplicados (case-insensitive)
                      if (entityTypes.some(t => t.label.toLowerCase() === newCategoryLabel.trim().toLowerCase())) {
                        setErrorMsg("Ya existe una categoría con ese nombre");
                        setShowSuccess(false);
                        return;
                      }
                      
                      try {
                        const createdByUid = isSuperAdmin ? user?.uid : (user?.createdBy?.uid || user?.uid);
                        await addNewEntityType(newCategoryLabel, createdByUid);
                        setNewCategoryLabel("");
                        setSuccessMsg("Categoría agregada exitosamente");
                        setShowSuccess(true);
                      } catch (error) {
                        console.error("Error al agregar categoría:", error);
                        setErrorMsg("Error al agregar categoría");
                        setShowSuccess(false);
                      }
                    }}
                    variant="contained"
                    size="small"
                    disabled={!newCategoryLabel.trim()}
                    id="adm-required-docs-dialog-btn-agregar-categoria"
                    sx={{
                      bgcolor: "var(--primary-main)",
                      color: "var(--primary-text)",
                      "&:hover": {
                        bgcolor: "var(--primary-dark)"
                      },
                      "&:disabled": {
                        bgcolor: "var(--primary-main)",
                        color: "var(--primary-text)",
                        opacity: 0.5
                      }
                    }}
                  >
                    Agregar
                  </Button>
                </Box>
                <Box id="adm-required-docs-dialog-lista-categorias">
                  {entityTypes.length === 0 && (
                    <Typography variant="body2" sx={{ color: "var(--paper-background-text)" }}>No hay categorías registradas.</Typography>
                  )}
                  {entityTypes.map((type) => {
                    const isProtected = isProtectedType(type.value);
                    return (
                      <Box key={type.value} sx={{ display: 'flex', alignItems: 'center', mb: 1 }} id={`adm-required-docs-dialog-categoria-row-${type.value}`}>
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ color: "var(--paper-background-text)" }}>{type.label}</Typography>
                          {isProtected && (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontWeight: 'bold',
                                backgroundColor: 'primary.light',
                                color: 'primary.contrastText',
                                px: 1,
                                py: 0.5,
                                borderRadius: 1,
                                fontSize: '0.7rem'
                              }}
                            >
                              PROTEGIDA
                            </Typography>
                          )}
                        </Box>
                        <Button
                          onClick={async () => {
                            if (isProtected) {
                              setErrorMsg(`No se puede eliminar "${type.label}" porque es una categoría principal del sistema`);
                              setShowSuccess(false);
                              return;
                            }
                            
                            if (window.confirm(`¿Estás seguro de eliminar la categoría "${type.label}"?\nEsta acción no se puede deshacer.`)) {
                              try {
                                await removeEntityType(type.value);
                                setSuccessMsg(`Categoría "${type.label}" eliminada`);
                                setShowSuccess(true);
                              } catch (error) {
                                console.error("Error al eliminar categoría:", error);
                                setErrorMsg(error.message || "Error al eliminar categoría");
                                setShowSuccess(false);
                              }
                            }
                          }}
                          color={isProtected ? "inherit" : "error"}
                          size="small"
                          disabled={isProtected}
                          sx={{ 
                            opacity: isProtected ? 0.5 : 1,
                            cursor: isProtected ? 'not-allowed' : 'pointer'
                          }}
                          id={`adm-required-docs-dialog-btn-eliminar-categoria-${type.value}`}
                        >
                          {isProtected ? 'Protegida' : 'Eliminar'}
                        </Button>
                      </Box>
                    );
                  })}
                </Box>
              </DialogContent>
              <DialogActions>
                <Button 
                  onClick={() => setEditCategoriesOpen(false)} 
                  id="adm-required-docs-dialog-btn-cerrar-editar-categorias"
                  sx={{
                    color: "var(--paper-background-text)"
                  }}
                >
                  Cerrar
                </Button>
              </DialogActions>
            </MuiDialog>

            <TextField
              label="Fecha de vencimiento (DD/MM/AAAA)"
              type="date"
              value={expirationDate}
              onChange={handleExpirationDateChange}
              disabled={isFormDisabled}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
              error={!!validationErrors.deadline}
              helperText={validationErrors.deadline || "Formato: DD/MM/AAAA"}
              size="small"
              sx={{ 
                mb: 1,
                "& .MuiOutlinedInput-root": {
                  "& fieldset": {
                    borderColor: "var(--divider-color)"
                  },
                  "&:hover fieldset": {
                    borderColor: "var(--primary-main)"
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "var(--primary-main)"
                  }
                }
              }}
              inputProps={{
                min: `${new Date().getFullYear()}-01-01`,
                max: `${new Date().getFullYear() + 100}-12-31`
              }}
              id="adm-required-docs-expiration"
            />
            <TextField
              label="Comentario (opcional)"
              value={exampleComment}
              onChange={(e) => setExampleComment(e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
              id="adm-required-docs-comment"
              sx={{
                "& .MuiOutlinedInput-root": {
                  "& fieldset": {
                    borderColor: "var(--divider-color)"
                  },
                  "&:hover fieldset": {
                    borderColor: "var(--primary-main)"
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "var(--primary-main)"
                  }
                }
              }}
            />
            
            {/* Selector de clientes - solo aparece si hay clientes */}
            {selectedCompanyId !== 'todas' && companyClients.length > 0 && (
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom sx={{ color: "var(--paper-background-text)", mb: 1 }}>
                  Aplicar a:
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={appliesToAllClients}
                        onChange={(e) => {
                          setAppliesToAllClients(e.target.checked);
                          if (e.target.checked) {
                            setSelectedClientIds([]); // Limpiar clientes específicos si "Todos los clientes" está marcado
                          }
                        }}
                        disabled={isFormDisabled}
                      />
                    }
                    label="Todos los clientes"
                    sx={{ color: "var(--paper-background-text)", mb: 1 }}
                  />
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" gutterBottom sx={{ color: "var(--paper-background-text)", mb: 1, fontSize: '0.875rem' }}>
                      Clientes específicos:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {companyClients.map((client) => {
                        const isSelected = appliesToAllClients || selectedClientIds.includes(client.id);
                        return (
                          <Button
                            key={client.id}
                            variant={isSelected ? "contained" : "outlined"}
                            size="small"
                            onClick={() => {
                              if (appliesToAllClients) {
                                // Si "Todos los clientes" está marcado, desmarcarlo y seleccionar solo este cliente
                                setAppliesToAllClients(false);
                                setSelectedClientIds([client.id]);
                              } else {
                                // Toggle del cliente individual
                                if (selectedClientIds.includes(client.id)) {
                                  setSelectedClientIds(prev => prev.filter(id => id !== client.id));
                                } else {
                                  setSelectedClientIds(prev => [...prev, client.id]);
                                }
                              }
                            }}
                            disabled={isFormDisabled}
                            sx={{
                              minWidth: 'auto',
                              px: 2,
                              py: 0.5,
                              borderRadius: 2,
                              textTransform: 'none',
                              ...(isSelected ? {
                                bgcolor: "var(--primary-main)",
                                color: "var(--primary-text)",
                                "&:hover": {
                                  bgcolor: "var(--primary-dark)"
                                }
                              } : {
                                borderColor: "var(--divider-color)",
                                color: "var(--paper-background-text)",
                                "&:hover": {
                                  borderColor: "var(--primary-main)",
                                  bgcolor: "var(--paper-background)"
                                }
                              })
                            }}
                          >
                            {client.companyName || client.name}
                          </Button>
                        );
                      })}
                    </Box>
                  </Box>
                </FormGroup>
              </Box>
            )}
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }} id="adm-required-docs-form-right">
            <ExampleUploader
              exampleImage={exampleImage}
              setExampleImage={setExampleImage}
              setExampleComment={setExampleComment}
              setExpirationDate={setExpirationDate}
              setNewDocName={setNewDocName}
              setSelectFromAdminStoreOpen={setSelectFromAdminStoreOpen}
              id="adm-required-docs-example-uploader"
            />
{exampleImage && (
  <Box sx={{ mt: 2 }} id="adm-required-docs-preview-box">
    <Typography variant="subtitle2" gutterBottom id="adm-required-docs-preview-label">
      Vista previa del ejemplo seleccionado:
    </Typography>
    <VistaPrevia
      url={exampleImage}
      width="100%"
      height={200}
      tipo="ejemplo"
      fileType={getFileTypeFromUrl(exampleImage)}
      id="adm-required-docs-preview"
    />
  </Box>
)}


            {/* Solo superadmin puede ver la advertencia y subir para todas las empresas */}
            {isSuperAdmin && selectedCompanyId === 'todas' && (
              <Box sx={{ mt: 1 }} id="adm-required-docs-warning-todas">
                <Alert 
                  severity="warning" 
                  variant="outlined" 
                  id="adm-required-docs-warning-alert"
                  sx={{
                    borderColor: "var(--warning-main)",
                    backgroundColor: "var(--paper-background)",
                    color: "var(--paper-background-text)",
                    "& .MuiAlert-icon": {
                      color: "var(--warning-main)"
                    }
                  }}
                >
                  ⚠ Este documento se aplicará a <strong>todas las empresas</strong> del sistema. 
                  Asegúrese de que los campos sean válidos para todas ellas.
                </Alert>
              </Box>
            )}

            {/* Tooltip de advertencia si no es superadmin y seleccionó 'todas' */}
            <Tooltip
              title={(!isSuperAdmin && selectedCompanyId === 'todas') ? 'Debe seleccionar una empresa para continuar' : ''}
              arrow
              disableHoverListener={isSuperAdmin || selectedCompanyId !== 'todas'}
              id="adm-required-docs-tooltip-todas"
            >
              <span>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={
                    loading ||
                    !newDocName.trim() ||
                    !entityType ||
                    !expirationDate ||
                    (!isSuperAdmin && selectedCompanyId === 'todas')
                  }
                  size="small"
                  id="adm-required-docs-submit"
                  sx={{
                    bgcolor: "var(--primary-main)",
                    color: "var(--primary-text)",
                    "&:hover": {
                      bgcolor: "var(--primary-dark)"
                    },
                    "&:disabled": {
                      bgcolor: "var(--primary-main)",
                      color: "var(--primary-text)",
                      opacity: 0.5
                    }
                  }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Crear'}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>

        <Dialog
          open={showPreviewDialog}
          onClose={handleClosePreview}
          maxWidth="sm"
          fullWidth
          id="adm-required-docs-dialog-preview"
          PaperProps={{
            sx: {
              backgroundColor: "var(--paper-background)",
              color: "var(--paper-background-text)"
            }
          }}
        >
          <DialogTitle sx={{ color: "var(--paper-background-text)" }} id="adm-required-docs-dialog-preview-title">Confirmar creación de Documento Requerido</DialogTitle>
          <DialogContent dividers id="adm-required-docs-dialog-preview-content">
            <Typography variant="subtitle1" gutterBottom sx={{ color: "var(--paper-background-text)" }} id="adm-required-docs-dialog-preview-empresa">
              Empresa: <strong>{selectedCompanyNameDisplay}</strong>
            </Typography>
            <Typography variant="subtitle1" gutterBottom sx={{ color: "var(--paper-background-text)" }} id="adm-required-docs-dialog-preview-detalles-label">Detalles del documento:</Typography>
            <Box sx={{ pl: 2 }} id="adm-required-docs-dialog-preview-detalles">
              <Typography sx={{ color: "var(--paper-background-text)" }} id="adm-required-docs-dialog-preview-nombre"><strong>Nombre:</strong> {newDocName}</Typography>
              <Typography sx={{ color: "var(--paper-background-text)" }} id="adm-required-docs-dialog-preview-entitytype"><strong>Aplicable a:</strong> {entityLabel}</Typography>
              <Typography sx={{ color: "var(--paper-background-text)" }} id="adm-required-docs-dialog-preview-expiration"><strong>Fecha de vencimiento:</strong> {expirationDate || "Sin especificar"}</Typography>
              <Typography sx={{ color: "var(--paper-background-text)" }} id="adm-required-docs-dialog-preview-comment"><strong>Comentario:</strong> {exampleComment || "-"}</Typography>
              <Typography sx={{ mt: 2, color: "var(--paper-background-text)" }} id="adm-required-docs-dialog-preview-ejemplo-label"><strong>Vista previa de ejemplo:</strong></Typography>
              {exampleImage ? (
               <VistaPrevia 
               url={exampleImage}
               width="100%"
               height={200}
               tipo="ejemplo"
               fileType={getFileTypeFromUrl(exampleImage)}
              sx={{ 
                border: `1px solid var(--divider-color)`,
                backgroundColor: "var(--page-background)"
              }}
               id="adm-required-docs-dialog-preview-ejemplo"
             />
              ) : (
                <Typography sx={{ color: "var(--paper-background-text)", opacity: 0.7 }} id="adm-required-docs-dialog-preview-no-ejemplo">No hay archivo de ejemplo seleccionado.</Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions id="adm-required-docs-dialog-preview-actions">
            <Button 
              onClick={handleClosePreview} 
              id="adm-required-docs-dialog-preview-btn-cerrar"
              sx={{
                color: "var(--paper-background-text)"
              }}
            >
              Cerrar
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleConfirmCreate} 
              disabled={creating} 
              id="adm-required-docs-dialog-preview-btn-confirmar"
              sx={{
                bgcolor: "var(--primary-main)",
                color: "var(--primary-text)",
                "&:hover": {
                  bgcolor: "var(--primary-dark)"
                },
                "&:disabled": {
                  bgcolor: "rgba(0, 0, 0, 0.12)",
                  color: "rgba(0, 0, 0, 0.26)"
                }
              }}
            >
              {creating ? <CircularProgress size={20} color="inherit" /> : 'Confirmar Creación'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>

      <Snackbar
        open={showSuccess}
        autoHideDuration={4000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        id="adm-required-docs-snackbar-success"
      >
        <Alert 
          onClose={() => setShowSuccess(false)} 
          severity="success" 
          sx={{ width: '100%' }}
          id="adm-required-docs-alert-success"
        >
          {successMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
