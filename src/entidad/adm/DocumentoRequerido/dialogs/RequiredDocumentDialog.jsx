//administrador/dialogs/RequiredDocumentDialog.jsx
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  TextField,
  Box,
  Typography,
  Divider,
  Checkbox,
  FormControlLabel,
  FormGroup,
  CircularProgress
} from "@mui/material";
import { useCompanies } from "../../../../context/CompaniesContext";
import { useAuth } from "../../../../context/AuthContext";
import { db } from "../../../../firebaseconfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getTenantCollectionPath } from "../../../../utils/tenantUtils";
import ExampleUploader from "./ExampleUploader";
import VistaPrevia from '../../../../components/common/VistaPrevia';

const normalizeAppliesTo = (appliesTo) => {
  const normalized = {
    main: appliesTo?.main !== false
  };

  if (appliesTo?.clients === null) {
    normalized.clients = null; // null = todos los clientes
  } else if (Array.isArray(appliesTo?.clients)) {
    normalized.clients = appliesTo.clients;
  } else {
    normalized.clients = [];
  }

  return normalized;
};

export default function RequiredDocumentDialog({
  open,
  onClose,
  document,
  onSave
}) {
  // Validación inicial estricta
  if (!open || !document?.name) {
    console.error('Documento inválido: falta propiedad name');
    return null;
  }

  const { companies } = useCompanies();
  const { user, getUserTenantCollectionPath } = useAuth();
  const companyName = companies.find(c => c.id === document?.companyId)?.name || "";

  // Verificar si es superadmin (solo superadmin puede editar appliesTo)
  const isSuperAdmin = typeof user?.role === 'string' && user.role.trim().toLowerCase() === 'max';
  const canEditAppliesTo = isSuperAdmin;

  // Normalizar appliesTo inicial
  const initialAppliesTo = normalizeAppliesTo(document?.appliesTo || {});
  
  const [tab, setTab] = useState(0);
  const [editValues, setEditValues] = useState({
    name: document.name,
    comentario: document.comentario || '',
    expirationDate: document.expirationDate || '',
    entityType: document.entityType || 'company',
    exampleImage: document.exampleImage || '',
    fileURL: document.fileURL || '',
    status: document.status || 'active',
    version: document.version || '1.0'
  });

  // Estados para appliesTo
  const [appliesToAllClients, setAppliesToAllClients] = useState(
    initialAppliesTo.clients === null
  );
  const [selectedClientIds, setSelectedClientIds] = useState(
    Array.isArray(initialAppliesTo.clients) ? initialAppliesTo.clients : []
  );
  const [companyClients, setCompanyClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Cargar clientes cuando se abre el diálogo
  useEffect(() => {
    const fetchCompanyClients = async () => {
      const companyId = document?.companyId;
      if (!companyId || !canEditAppliesTo || !open) {
        setCompanyClients([]);
        return;
      }

      setLoadingClients(true);
      try {
        const companiesPath = getUserTenantCollectionPath('companies');
        if (!companiesPath) return;
        
        const q = query(
          collection(db, companiesPath),
          where('parentCompanyId', '==', companyId),
          where('active', '==', true),
          where('status', '==', 'approved')
        );
        const snapshot = await getDocs(q);
        const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCompanyClients(clientsData);
      } catch (error) {
        console.error("Error fetching company clients:", error);
        setCompanyClients([]);
      } finally {
        setLoadingClients(false);
      }
    };

    if (open) {
      fetchCompanyClients();
      // Resetear estados cuando cambia el documento
      const appliesTo = normalizeAppliesTo(document?.appliesTo || {});
      setAppliesToAllClients(appliesTo.clients === null);
      setSelectedClientIds(Array.isArray(appliesTo.clients) ? appliesTo.clients : []);
    }
  }, [document?.companyId, document?.appliesTo, canEditAppliesTo, open, getUserTenantCollectionPath]);

  const handleSave = () => {
    if (!editValues.name.trim()) {
      alert('El nombre del documento es obligatorio');
      return;
    }

    // Construir appliesTo basado en los estados (solo si puede editar)
    const appliesToData = canEditAppliesTo ? {
      main: false, // La empresa principal siempre ve todo
      clients: appliesToAllClients ? null : (selectedClientIds.length > 0 ? selectedClientIds : [])
    } : document?.appliesTo;

    // Validar y limpiar campos innecesarios
    const updatedDoc = {
      ...document,
      ...editValues,
      exampleImage: editValues.exampleImage || "",
      fileURL: editValues.fileURL || "",
      appliesTo: appliesToData, // Incluir appliesTo actualizado
      lastModified: new Date().toISOString()
    };

    // Eliminar campos undefined
    Object.keys(updatedDoc).forEach(key => {
      if (updatedDoc[key] === undefined) {
        delete updatedDoc[key];
      }
    });

    console.log("Documento actualizado:", updatedDoc);

    onSave(updatedDoc);
    onClose();
  };

  const handleChange = (field, value) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {document?.name || "Documento"} - {document?.entityType || "tipo"} - {companyName}
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Detalles" />
        <Tab label="Editar" />
      </Tabs>
      <DialogContent dividers>
        {tab === 0 && (
          <Box>
            <Typography><strong>Nombre:</strong> {document.name}</Typography>
            <Typography><strong>Tipo:</strong> {document.entityType}</Typography>
            <Typography><strong>Vencimiento:</strong> {document.expirationDate || "Sin fecha"}</Typography>
            <Typography><strong>Comentario:</strong> {document.comentario || "-"}</Typography>
            {document?.appliesTo && (
              <>
                <Typography><strong>Aplica a:</strong> </Typography>
                <Box sx={{ ml: 2, mb: 1 }}>
                  {(() => {
                    const appliesTo = normalizeAppliesTo(document.appliesTo);
                    if (appliesTo.clients === null) {
                      return <Typography variant="body2">Todos los clientes</Typography>;
                    } else if (Array.isArray(appliesTo.clients) && appliesTo.clients.length > 0) {
                      return <Typography variant="body2">Clientes específicos ({appliesTo.clients.length})</Typography>;
                    } else {
                      return <Typography variant="body2">Solo empresa principal</Typography>;
                    }
                  })()}
                </Box>
              </>
            )}
            <Typography><strong>Subido por:</strong> {document.subidoPorEmail || "-"}</Typography>
            <Typography><strong>Creado:</strong> {document.createdAt ? new Date(document.createdAt).toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : "-"}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1">Vista previa actual:</Typography>
<VistaPrevia
  url={document.exampleImage || document.fileURL || ""}
  titulo="Vista previa actual"
  tipo="ejemplo"
/>
          </Box>
        )}
        {tab === 1 && (
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Nombre*"
              value={editValues.name}
              onChange={e => setEditValues({...editValues, name: e.target.value})}
              fullWidth
              size="small"
              error={!editValues.name.trim()}
              helperText={!editValues.name.trim() ? "Campo obligatorio" : ""}
            />
            <TextField
              label="Comentario"
              value={editValues.comentario}
              onChange={e => handleChange("comentario", e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
            />
            <TextField
              label="Fecha de vencimiento (DD/MM/AAAA)"
              type="date"
              value={editValues.expirationDate}
              onChange={e => handleChange("expirationDate", e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              helperText="Formato: DD/MM/AAAA"
            />
            <TextField
              label="Tipo"
              value={editValues.entityType}
              onChange={e => handleChange("entityType", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Estado"
              value={editValues.status}
              onChange={e => handleChange("status", e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Versión"
              value={editValues.version}
              onChange={e => handleChange("version", e.target.value)}
              fullWidth
              size="small"
            />
            <ExampleUploader
              exampleImage={editValues.exampleImage}
              fileURL={editValues.fileURL}
              setExampleImage={(url) => 
                setEditValues({...editValues, exampleImage: url})
              }
              setFileURL={(url) => 
                setEditValues({...editValues, fileURL: url})
              }
            />
            {editValues.exampleImage && (
              <>
                <Typography variant="subtitle2">Vista previa del cambio:</Typography>
                <VistaPrevia
                  url={editValues.exampleImage}
                  titulo="Vista previa del cambio"
                  tipo="ejemplo"
                />
              </>
            )}

            {/* Edición de appliesTo - Solo para superadmin */}
            {canEditAppliesTo && document?.companyId && companyClients.length > 0 && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
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
                            setSelectedClientIds([]);
                          }
                        }}
                      />
                    }
                    label="Todos los clientes"
                    sx={{ mb: 1 }}
                  />
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" gutterBottom sx={{ mb: 1, fontSize: '0.875rem' }}>
                      Clientes específicos:
                    </Typography>
                    {loadingClients ? (
                      <CircularProgress size={20} />
                    ) : (
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
                                  setAppliesToAllClients(false);
                                  setSelectedClientIds([client.id]);
                                } else {
                                  if (selectedClientIds.includes(client.id)) {
                                    setSelectedClientIds(prev => prev.filter(id => id !== client.id));
                                  } else {
                                    setSelectedClientIds(prev => [...prev, client.id]);
                                  }
                                }
                              }}
                              sx={{
                                minWidth: 'auto',
                                px: 2,
                                py: 0.5,
                                borderRadius: 2,
                                textTransform: 'none'
                              }}
                            >
                              {client.companyName || client.name}
                            </Button>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </FormGroup>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        {tab === 1 && (
          <Button 
            variant="contained" 
            onClick={handleSave}
            disabled={!editValues.name.trim()}
          >
            Guardar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}