import React, { useEffect, useState } from "react";
import { db } from "../../../firebaseconfig";
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from "firebase/firestore";
import { Box, Typography, Paper, IconButton, Stack, Button } from "@mui/material";
import { CheckCircle, Info as InfoIcon, Replay as ReplayIcon } from "@mui/icons-material";
import { getTenantCollectionPath } from '../../../utils/tenantUtils';

// Componente para mostrar notificaciones administrativas
export default function AdminNotifications({ companyId = null }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      setLoading(true);
      // Usar la ruta multi-tenant correcta
      const adminNotificationsPath = getTenantCollectionPath('adminNotifications');
      let q = collection(db, adminNotificationsPath);
      if (companyId) {
        q = query(q, where("companyId", "==", companyId));
      }
      q = query(q, orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }
    fetchNotifications();
  }, [companyId]);

  const markAsRead = async (id) => {
    // Usar la ruta multi-tenant correcta
    const adminNotificationsPath = getTenantCollectionPath('adminNotifications');
    await updateDoc(doc(db, adminNotificationsPath, id), { read: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>Notificaciones de Suspensión / Reactivación</Typography>
      {loading ? (
        <Typography>Cargando notificaciones...</Typography>
      ) : notifications.length === 0 ? (
        <Typography color="text.secondary">No hay notificaciones recientes.</Typography>
      ) : (
        <Stack spacing={1}>
          {notifications.map((notif) => (
            <Box key={notif.id} sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: notif.read ? 'grey.100' : 'info.light',
              borderRadius: 2,
              p: 1.5,
              opacity: notif.read ? 0.6 : 1
            }}>
              <InfoIcon color={notif.event === 'suspendido' ? 'warning' : 'success'} sx={{ mr: 1 }} />
              <Box flex={1}>
                <Typography variant="subtitle2">
                  {notif.entityType === 'vehiculo' ? 'Vehículo' : 'Persona'}: <b>{notif.entityName}</b>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {notif.message}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {notif.timestamp && new Date(notif.timestamp.seconds ? notif.timestamp.seconds * 1000 : notif.timestamp).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </Box>
              {!notif.read && (
                <IconButton sx={{ color: "var(--success-main)", "&:hover": { bgcolor: "var(--success-dark)", color: "#fff" } }} size="small" onClick={() => markAsRead(notif.id)}>
                  <CheckCircle />
                </IconButton>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
