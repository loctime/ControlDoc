import React, { useState, useEffect, useMemo } from "react"
import { Box, Typography, CircularProgress, IconButton, Tooltip, Button, Alert, Chip, Divider, List, ListItem, ListItemText } from "@mui/material"
import { Business as BusinessIcon, Edit as EditIcon, Delete as DeleteIcon, Replay as ReplayIcon, People as PeopleIcon, DirectionsCar as CarIcon, AccountTree as ClientIcon } from "@mui/icons-material"
import { useCompanyList } from "../../../context/CompaniesContext"
import { useAuth } from "../../../context/AuthContext"
import { getFreshToken } from "../../../utils/getFreshToken"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../../../firebaseconfig"
import SuperTable from "../../../components/common/superTable"
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import EditCompanyModal from './EditCompanyModal';
import { useMultipleCompanyStats } from '../../../hooks/useCompanyStats';
import DocumentStatusChart from '../../../components/charts/DocumentStatusChart';

const CompanyDel = ({ tabValue, setCompanyCount, setPendingCompanyCount }) => {
  const { companies, refresh, loading: companiesLoading } = useCompanyList()
  const { user } = useAuth()
  
  // Obtener estadísticas de todas las empresas
  const companyIds = useMemo(() => companies?.map(c => c.id) || [], [companies]);
  const { allStats, loading: statsLoading } = useMultipleCompanyStats(companyIds);
  
  // Estado para almacenar clientes de cada empresa
  const [companyClients, setCompanyClients] = useState({});
  const [loadingClients, setLoadingClients] = useState({});
  
  // Log para ver el rol del usuario
  useEffect(() => {
    console.log('🔍 [CompanyDel] Información del usuario:', {
      role: user?.role,
      email: user?.email,
      uid: user?.uid,
      displayName: user?.displayName
    });
  }, [user]);
  const [deleting, setDeleting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [actioningId, setActioningId] = useState(null)
  const [pendingDeletions, setPendingDeletions] = useState([])
  const [error, setError] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  
  const fetchPendingDeletions = async () => {
    try {
      setError(null)
      // Usar la ruta multi-tenant correcta
      const companiesCollectionPath = getTenantCollectionPath('companies');
      const q = query(
        collection(db, companiesCollectionPath),
        where("deletionScheduled", "==", true)
      )
      const snapshot = await getDocs(q)
      const now = new Date()
      const list = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        const deletionDate = data.deletionDate?.toDate()
        const hoursDiff = (now - deletionDate) / 1000 / 60 / 60
        if (hoursDiff < 24) {
          list.push({
            id: doc.id,
            ...data,
            hoursRemaining: Math.max(0, 24 - hoursDiff)
          })
        }
      })
      setPendingDeletions(list)
    } catch (err) {
      setError("Error al cargar eliminaciones pendientes de empresas")
    }
  }

  useEffect(() => {
    fetchPendingDeletions()
  }, [companies])

  // Función para cargar clientes de una empresa
  const loadCompanyClients = async (companyId) => {
    if (loadingClients[companyId] || companyClients[companyId]) return; // Ya cargado o cargando
    
    setLoadingClients(prev => ({ ...prev, [companyId]: true }));
    try {
      const companiesPath = getTenantCollectionPath('companies');
      const clientsQuery = query(
        collection(db, companiesPath),
        where('parentCompanyId', '==', companyId),
        where('active', '==', true)
      );
      const snapshot = await getDocs(clientsQuery);
      const clients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCompanyClients(prev => ({ ...prev, [companyId]: clients }));
    } catch (error) {
      console.error('Error cargando clientes:', error);
      setCompanyClients(prev => ({ ...prev, [companyId]: [] }));
    } finally {
      setLoadingClients(prev => ({ ...prev, [companyId]: false }));
    }
  };
  

  // Notifica al padre el conteo de empresas activas
  useEffect(() => {
    if (setCompanyCount) setCompanyCount(companies?.length ?? 0)
  }, [companies, setCompanyCount])

  // Notifica al padre el conteo de empresas pendientes de eliminación
  useEffect(() => {
    if (setPendingCompanyCount) setPendingCompanyCount(pendingDeletions?.length ?? 0)
  }, [pendingDeletions, setPendingCompanyCount])

  const handleDeleteCompanyImmediately = async (empresa) => {
    if (!["admin", "max"].includes(user?.role)) {
      return alert("Solo administradores pueden eliminar empresas.");
    }
  
    const confirmed = window.confirm(
      `⚠️ La empresa "${empresa.companyName}" será ELIMINADA PERMANENTEMENTE.\n\n` +
      `Esta acción no se puede deshacer.\n\n¿Continuar con la eliminación inmediata?`
    );
    if (!confirmed) return;
  
    try {
      setDeleting(true);
      setActioningId(empresa.id);
      const token = await getFreshToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/delete-company-immediately`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId: empresa.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      if (refresh) await refresh();
      setCompanyCount((prev) => prev - 1);
    } catch (err) {
      alert("Error eliminando empresa: " + err.message);
    } finally {
      setDeleting(false);
      setActioningId(null);
    }
  };
  

  const handleRevertCompanyDeletion = async (company) => {
    const confirmed = window.confirm(
      `¿Confirmas revertir la eliminación de "${company.companyName}"?\n\n` +
      `La empresa volverá a estar activa inmediatamente.`
    );
    if (!confirmed) return;
    try {
      setUpdating(true);
      setActioningId(company.id);
      const token = await getFreshToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/revert-delete-company`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId: company.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      if (refresh) await refresh();
      await fetchPendingDeletions();
      setSuccess(`Eliminación de "${company.companyName}" deshecha correctamente.`);
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      alert("Error revirtiendo eliminación: " + err.message);
    } finally {
      setUpdating(false);
      setActioningId(null);
    }
  };

  const companyColumns = [
    {
      key: "companyName",
      label: "Empresa",
      render: (c) => (
        <Box display="flex" alignItems="center">
          <BusinessIcon sx={{ mr: 1, color: "var(--icon-color)" }} />
          <Typography sx={{ color: "var(--paper-background-text)" }}>
            {c.companyName}
          </Typography>
        </Box>
      )
    },
    {
      key: "cuit",
      label: "CUIT",
      render: (c) => (
        <Typography sx={{ color: "var(--paper-background-text)" }}>
          {c.cuit || "No especificado"}
        </Typography>
      )
    },
    {
      key: "empleados",
      label: "Empleados",
      render: (c) => {
        const stats = allStats[c.id];
        if (statsLoading || !stats) {
          return <CircularProgress size={16} sx={{ color: "var(--icon-color)" }} />;
        }
        return (
          <Box display="flex" alignItems="center">
            <PeopleIcon sx={{ mr: 1, fontSize: 16, color: "var(--icon-color)" }} />
            <Typography variant="body2" sx={{ color: "var(--paper-background-text)" }}>
              {stats.empleados.activos}/{stats.empleados.total}
            </Typography>
          </Box>
        );
      }
    },
    {
      key: "vehiculos",
      label: "Vehículos",
      render: (c) => {
        const stats = allStats[c.id];
        if (statsLoading || !stats) {
          return <CircularProgress size={16} sx={{ color: "var(--icon-color)" }} />;
        }
        return (
          <Box display="flex" alignItems="center">
            <CarIcon sx={{ mr: 1, fontSize: 16, color: "var(--icon-color)" }} />
            <Typography variant="body2" sx={{ color: "var(--paper-background-text)" }}>
              {stats.vehiculos.activos}/{stats.vehiculos.total}
            </Typography>
          </Box>
        );
      }
    },
    {
      key: "status",
      label: "Estado",
      render: (c) => (
        <Chip
          label={c.status === "approved" ? "Aprobado" : (c.status === "active" ? "Activo" : (c.status || "Sin estado"))}
          size="small"
          sx={{
            backgroundColor: c.status === "approved" || c.status === "active" ? "var(--success-main)" : "transparent",
            color: c.status === "approved" || c.status === "active" ? "#fff" : "var(--paper-background-text)",
            border: c.status === "approved" || c.status === "active" ? "none" : `1px solid var(--divider-color)`,
            opacity: c.status === "approved" || c.status === "active" ? 1 : 0.7,
            fontWeight: c.status === "approved" || c.status === "active" ? 600 : 400,
            "& .MuiChip-label": {
              padding: "4px 8px"
            }
          }}
        />
      )
    }
  ]

  const pendingColumns = [
    {
      key: "companyName",
      label: "Empresa",
      render: (c) => <Typography sx={{ color: "var(--error-main)" }}>{c.companyName}</Typography>
    },
    {
      key: "hoursRemaining",
      label: "Tiempo",
      render: (c) => (
        <Typography sx={{ color: "var(--warning-main)" }}>
          {Math.round(c.hoursRemaining)}h restantes
        </Typography>
      )
    }
  ]

  const handleEditCompany = (company) => {
    setSelectedCompany(company);
    setEditModalOpen(true);
  };

  const handleCompanyUpdated = () => {
    if (refresh) {
      refresh();
    }
  };

  const companyActions = (company) => (
    <>
      <Tooltip title="Editar">
        <IconButton onClick={() => handleEditCompany(company)} sx={{ color: "var(--icon-color)" }}>
          <EditIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Eliminar permanentemente">
  <IconButton
    onClick={() => handleDeleteCompanyImmediately(company)}
    disabled={!["admin", "max"].includes(user?.role) || actioningId === company.id}
    sx={{ color: "var(--error-main)", "&:disabled": { opacity: 0.5 } }}
  >
    {actioningId === company.id && deleting
      ? <CircularProgress size={24} />
      : <DeleteIcon />}
  </IconButton>
</Tooltip>

    </>
  )

  const [success, setSuccess] = useState(null);

  const pendingActions = (company) => (
    <Tooltip title="Deshacer eliminación">
      <IconButton
        onClick={() => handleRevertCompanyDeletion(company)}
        disabled={updating && actioningId === company.id}
        sx={{ color: "var(--primary-main)", "&:disabled": { opacity: 0.5 } }}
      >
        {actioningId === company.id && updating
          ? <CircularProgress size={24} />
          : <ReplayIcon />}
      </IconButton>
    </Tooltip>
  );

  // Modifica el handler para mostrar feedback visual
 

  if (companiesLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px"><CircularProgress /></Box>
  }
  if (tabValue === 0) {
    return (
      <>
        <SuperTable
          rows={companies}
          columns={companyColumns}
          rowActions={companyActions}
          onRowExpand={(row) => {
            // Cargar clientes cuando se expande la fila
            if (row.id) {
              loadCompanyClients(row.id);
            }
          }}
          expandableRender={(row) => {
            const stats = allStats[row.id];
            const clients = companyClients[row.id] || [];
            const isLoadingClients = loadingClients[row.id];
            
            return (
              <Box sx={{ p: 2, bgcolor: 'var(--paper-background)' }}>
                <Typography variant="subtitle1" gutterBottom sx={{ color: "var(--paper-background-text)" }}>
                  <b>Teléfono:</b> {row.telefono || 'No especificado'}
                </Typography>
                <Typography variant="subtitle1" gutterBottom sx={{ color: "var(--paper-background-text)" }}>
                  <b>Dirección:</b> {row.direccion || 'No especificada'}
                </Typography>
                
                {stats && (
                  <Box sx={{ mt: 2 }}>
                    <DocumentStatusChart 
                      documentStats={stats.documentos} 
                      compact={true}
                    />
                  </Box>
                )}
                
                <Divider sx={{ my: 2 }} />
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: "var(--paper-background-text)", display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ClientIcon fontSize="small" />
                    <b>Clientes ({clients.length})</b>
                  </Typography>
                  {isLoadingClients ? (
                    <CircularProgress size={20} sx={{ mt: 1 }} />
                  ) : clients.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "var(--paper-background-text)", opacity: 0.7, mt: 1 }}>
                      No hay clientes registrados para esta empresa.
                    </Typography>
                  ) : (
                    <List dense sx={{ mt: 1 }}>
                      {clients.map((client) => (
                        <ListItem 
                          key={client.id}
                          sx={{ 
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 1,
                            bgcolor: 'background.paper'
                          }}
                        >
                          <ClientIcon sx={{ mr: 1, fontSize: 18, color: 'info.main' }} />
                          <ListItemText
                            primary={
                              <Typography sx={{ color: "var(--paper-background-text)" }}>
                                {client.companyName || client.name || 'Sin nombre'}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>
                                ID: {client.id} • Status: {client.status || 'N/A'}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </Box>
            );
          }}
          emptyText="No hay empresas activas para mostrar."
        />
        
        <EditCompanyModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedCompany(null);
          }}
          company={selectedCompany}
          onCompanyUpdated={handleCompanyUpdated}
        />
      </>
    )
  }
  if (tabValue === 2) {
    return (
      <>
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>
        )}
        <SuperTable
          rows={pendingDeletions}
          columns={pendingColumns}
          rowActions={pendingActions}
        />
      </>
    )
  }
  return null
}

export default CompanyDel