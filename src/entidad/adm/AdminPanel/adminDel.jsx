import React, { useState, useEffect } from "react"
import {
  Box, Typography, CircularProgress, IconButton, Tooltip, Alert, Chip
} from "@mui/material"
import {
  Person as PersonIcon,
  Delete as DeleteIcon,
  Replay as ReplayIcon
} from "@mui/icons-material"
import { useAuth } from "../../../context/AuthContext"
import { getFreshToken } from "../../../utils/getFreshToken"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../../../config/firebaseconfig"
import { getTenantCollectionPath } from "../../../utils/tenantUtils"
import SuperTable from "../../../components/common/superTable"
import AdminAdd from "./adminAdd"
import { Dialog, Button } from "@mui/material"

const AdminDel = ({ tabValue, setAdminCount, setPendingAdminCount }) => {
  const { user, getUserTenantCollectionPath } = useAuth()
  
  // Log para ver el rol del usuario
  useEffect(() => {
    console.log('🔍 [AdminDel] Información del usuario:', {
      role: user?.role,
      email: user?.email,
      uid: user?.uid,
      displayName: user?.displayName
    });
  }, [user]);
  
  const [deleting, setDeleting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [actioningId, setActioningId] = useState(null)
  const [administrators, setAdministrators] = useState([])
  const [administratorsPendingDeletion, setAdministratorsPendingDeletion] = useState([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Estado para modal de alta de admin
  const [addOpen, setAddOpen] = useState(false)

  // Notifica al padre el conteo de administradores activos
  useEffect(() => {
    if (setAdminCount) setAdminCount(administrators?.length ?? 0)
  }, [administrators, setAdminCount])

  // Notifica al padre el conteo de administradores pendientes de eliminación
  useEffect(() => {
    if (setPendingAdminCount) setPendingAdminCount(administratorsPendingDeletion?.length ?? 0)
  }, [administratorsPendingDeletion, setPendingAdminCount])

  const fetchAdministrators = async () => {
    try {
      setAdminsLoading(true)
      setError(null)
      // Usar la colección de usuarios del tenant del usuario (donde están los admins)
      const tenantUsersPath = getUserTenantCollectionPath('users');
      if (!tenantUsersPath) {
        setError("No se pudo determinar el tenant del usuario");
        return;
      }
      // Obtener administradores (role in admin | max) en el tenant
      const adminsQuery = query(
        collection(db, tenantUsersPath),
        where("role", "in", ["admin", "max"])
      );
      const adminsSnapshot = await getDocs(adminsQuery);
      const list = [];
      adminsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.deletionScheduled) {
          list.push({ id: docSnap.id, ...data });
        }
      });
      // Cada admin ve solo sus colaboradores (createdBy.uid === yo) y a sí mismo
      const filtered = list.filter(
        (a) => a.id === user?.uid || a.createdBy?.uid === user?.uid
      );
      setAdministrators(filtered)
    } catch (err) {
      setError("Error al cargar la lista de administradores")
    } finally {
      setAdminsLoading(false)
    }
  }

  const fetchAdminsPendingDeletion = async () => {
    try {
      // Usar la colección de usuarios del tenant del usuario (donde están los admins)
      const tenantUsersPath = getUserTenantCollectionPath('users');
      if (!tenantUsersPath) {
        setError("No se pudo determinar el tenant del usuario");
        return;
      }
      
      // Obtener admins y superadmins pendientes de eliminación (role in admin | max)
      const pendingQuery = query(
        collection(db, tenantUsersPath),
        where("role", "in", ["admin", "max"]),
        where("deletionScheduled", "==", true)
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      const now = new Date();
      const list = [];
      pendingSnapshot.forEach((doc) => {
        const data = doc.data();
        const deletionDate = data.deletionDate?.toDate();
        const hoursDiff = (now - deletionDate) / 1000 / 60 / 60;
        if (hoursDiff < 24) {
          list.push({
            id: doc.id,
            ...data,
            hoursRemaining: Math.max(0, 24 - hoursDiff)
          });
        }
      });
      
      setAdministratorsPendingDeletion(list)
    } catch (err) {
      setError("Error al cargar administradores eliminados")
    }
  }

  useEffect(() => {
    if (["admin", "max"].includes(user?.role)) {
      fetchAdministrators();
      if (user?.role === "max") {
        fetchAdminsPendingDeletion();
      }
    }
  }, [user]);

  const handleDeleteAdmin = async (admin) => {
    if (user?.role !== "max") return alert("Solo el superadministrador puede eliminar administradores.")
    const confirmed = window.confirm(`¿Eliminar al administrador "${admin.realemail, admin.email, admin.displayName}"?`)
    if (!confirmed) return

    try {
      setDeleting(true)
      setActioningId(admin.id)
      const token = await getFreshToken()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/delete-admin-immediately`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: admin.id, userUid: admin.uid || admin.firebaseUid })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message)

      await fetchAdministrators()
      setSuccess(`Administrador "${admin.realemail, admin.email, admin.displayName}" eliminado exitosamente`)
      setTimeout(() => setSuccess(null), 3500)
    } catch (err) {
      alert("Error eliminando administrador: " + err.message)
    } finally {
      setDeleting(false)
      setActioningId(null)
    }
  }

  const handleRevertAdminDeletion = async (admin) => {
    const confirmed = window.confirm(`¿Deshacer la eliminación de "${admin.email, admin.realemail, admin.displayName}"?`)

    if (!confirmed) return
    try {
      setUpdating(true)
      setActioningId(admin.id)
      const token = await getFreshToken()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/revert-delete-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: admin.id, userUid: admin.uid || admin.firebaseUid })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message)

      await fetchAdministrators()
      await fetchAdminsPendingDeletion()
      setSuccess(`Eliminación deshecha para "${admin.email, admin.realemail, admin.displayName}"`)
      setTimeout(() => setSuccess(null), 3500)
    } catch (err) {
      alert("Error al deshacer eliminación: " + err.message)
    } finally {
      setUpdating(false)
      setActioningId(null)
    }
  }

  const adminColumns = [
    {
      key: "displayName",
      label: "Nombre",
      render: (a) => (
        <Box display="flex" alignItems="center">
          <PersonIcon sx={{ mr: 1, color: "var(--icon-color)" }} />
          <Typography sx={{ color: "var(--paper-background-text)" }}>
            {a.displayName || a.email}
          </Typography>
        </Box>
      )
    },
    { 
      key: "email", 
      label: "Email",
      render: (a) => (
        <Typography sx={{ color: "var(--paper-background-text)" }}>
          {a.email || "Sin email"}
        </Typography>
      )
    },
    {
      key: "status",
      label: "Estado",
      render: (a) => (
        <Chip
          label={a.status === "active" ? "Activo" : (a.status || "Sin estado")}
          size="small"
          sx={{
            backgroundColor: a.status === "active" ? "var(--success-main)" : "transparent",
            color: a.status === "active" ? "#fff" : "var(--paper-background-text)",
            border: a.status === "active" ? "none" : `1px solid var(--divider-color)`,
            opacity: a.status === "active" ? 1 : 0.7,
            fontWeight: a.status === "active" ? 600 : 400,
            "& .MuiChip-label": {
              padding: "4px 8px"
            }
          }}
        />
      )
    }
  ]

  const adminPendingColumns = [
    {
      key: "displayName",
      label: "Nombre",
      render: (a) => (
        <Box display="flex" alignItems="center">
          <PersonIcon sx={{ mr: 1, color: "var(--icon-color)" }} />
          <Typography sx={{ color: "var(--paper-background-text)" }}>
            {a.displayName || a.email || a.realemail}
          </Typography>
        </Box>
      )
    },
    { 
      key: "email", 
      label: "Email",
      render: (a) => (
        <Typography sx={{ color: "var(--paper-background-text)" }}>
          {a.email || "Sin email"}
        </Typography>
      )
    },
    {
      key: "hoursRemaining",
      label: "Tiempo",
      render: (a) => (
        <Typography sx={{ color: "var(--warning-main)" }}>
          {Math.round(a.hoursRemaining)}h restantes
        </Typography>
      )
    }
  ]

  if (adminsLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px"><CircularProgress /></Box>
  }

  return (
    <>
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 2,
            backgroundColor: "var(--paper-background)",
            color: "var(--paper-background-text)",
            borderColor: "var(--error-main)"
          }}
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert 
          severity="success" 
          sx={{ 
            mb: 2,
            backgroundColor: "var(--paper-background)",
            color: "var(--paper-background-text)",
            borderColor: "var(--success-main)"
          }}
        >
          {success}
        </Alert>
      )}

      {/* Mostrar administradores activos - se renderiza solo cuando tabValue es 2 desde AdminCompaniesPage */}
      {tabValue !== 3 && (
        <>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setAddOpen(true)}
              sx={{
                bgcolor: "var(--primary-main)",
                color: "var(--primary-text)",
                "&:hover": {
                  bgcolor: "var(--primary-dark)"
                }
              }}
            >
              Agregar administrador
            </Button>
          </Box>
          <SuperTable
            rows={administrators}
            columns={adminColumns}
            rowActions={(admin) => (
              <Tooltip title="Eliminar administrador">
                <IconButton
                  onClick={() => handleDeleteAdmin(admin)}
                  disabled={actioningId === admin.id}
                  sx={{
                    color: "var(--error-main)",
                    "&:hover": {
                      backgroundColor: "var(--error-main)",
                      color: "white"
                    },
                    "&:disabled": {
                      color: "var(--error-main)",
                      opacity: 0.5
                    }
                  }}
                >
                  {actioningId === admin.id && deleting
                    ? <CircularProgress size={24} />
                    : <DeleteIcon />}
                </IconButton>
              </Tooltip>
            )}
          />
          <AdminAdd
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onSuccess={fetchAdministrators}
          />
        </>
      )}

      {tabValue === 3 && (
        <SuperTable
          rows={administratorsPendingDeletion}
          columns={adminPendingColumns}
          rowActions={(admin) => (
            <Tooltip title="Deshacer eliminación">
              <IconButton
                onClick={() => handleRevertAdminDeletion(admin)}
                disabled={actioningId === admin.id}
                sx={{
                  color: "var(--primary-main)",
                  "&:hover": {
                    backgroundColor: "var(--primary-main)",
                    color: "var(--primary-text)"
                  },
                  "&:disabled": {
                    color: "var(--primary-main)",
                    opacity: 0.5
                  }
                }}
              >
                {actioningId === admin.id && deleting
                  ? <CircularProgress size={24} />
                  : <ReplayIcon />}
              </IconButton>
            </Tooltip>
          )}
        />
      )}
    </>
  )
}

export default AdminDel
