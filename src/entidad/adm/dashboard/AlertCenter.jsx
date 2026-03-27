// AlertCenter.jsx - Actualizado con agrupación por fecha, botón "Ir", y alertas personalizadas agrupadas

import React, { useState, useEffect } from "react";
import {
  Box, Typography, Paper, Button, Stack, IconButton, Divider
} from "@mui/material";
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore,
  ExpandLess,
  ArrowForward,
  CheckCircle,
  Undo as UndoIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "alertCenterReadState";

function formatDateGroup(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Hoy";
  if (isYesterday) return "Ayer";
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export default function AlertCenter({ alerts = [], setAlerts, compact = false }) {
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedReadState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const updated = alerts.map(alert => ({
      ...alert,
      isRead: savedReadState[alert.id] ?? (alert.isRead || false)
    }));
    setAlerts(updated);
  }, []);

  const toggleExpand = (id) => {
    setExpandedAlertId(expandedAlertId === id ? null : id);
  };

  const updateReadStatus = (id, isRead) => {
    const updated = alerts.map(alert =>
      alert.id === id ? { ...alert, isRead } : alert
    );
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, [id]: isRead }));
    setAlerts(updated);
  };

  const unread = alerts.filter(a => !a.isRead);
  const read = alerts.filter(a => a.isRead);
  const groupedAlerts = [...unread, ...(!compact ? read : [])].reduce((acc, alert) => {
    const key = formatDateGroup(alert.timestamp);
    if (!acc[key]) acc[key] = [];
    acc[key].push(alert);
    return acc;
  }, {});

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Object.entries(groupedAlerts).map(([dateLabel, alerts]) => (
        <Box key={dateLabel}>
          <Typography variant="subtitle2" sx={{ pl: 1, mb: 1 }}>{dateLabel}</Typography>
          {alerts.map((alert) => (
            <React.Fragment key={alert.id}>
              <Paper
                variant="outlined"
                sx={{
                  p: compact ? 1 : 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  bgcolor: alert.isRead ? 'grey.100' : 'background.paper',
                  opacity: alert.isRead ? 0.7 : 1
                }}
                onClick={() => toggleExpand(alert.id)}
              >
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {alert.icon || <WarningIcon color="warning" fontSize="small" />}
                  <Typography fontSize={compact ? 12 : 14}>{alert.text}</Typography>
                </Box>

                {!compact && (
                  alert.isRead ? (
                    <IconButton size="small" onClick={(e) => {
                      e.stopPropagation();
                      updateReadStatus(alert.id, false);
                    }}>
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  ) : (
                    <IconButton size="small" onClick={(e) => {
                      e.stopPropagation();
                      updateReadStatus(alert.id, true);
                    }}>
                      <CheckCircle color="success" fontSize="small" />
                    </IconButton>
                  )
                )}

                <IconButton size="small">
                  {expandedAlertId === alert.id ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Paper>

              {expandedAlertId === alert.id && (
                <Box sx={{ mt: 1, mb: 2, pl: 4 }}>
                  <Stack spacing={1}>
                    {alert.relatedDocuments?.length > 0 ? (
                      alert.relatedDocuments.map((doc) => (
                        <Box key={doc.id} sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <Box>
                            <Typography><strong>Documento:</strong> {doc.name}</Typography>
                            <Typography variant="body2"><strong>Empresa:</strong> {doc.company}</Typography>
                            {(doc.tipo || doc.tipoEntidad) && (
                              <Typography variant="body2"><strong>Tipo:</strong> {doc.tipo || doc.tipoEntidad}</Typography>
                            )}
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            endIcon={<ArrowForward />}
                            onClick={() => navigate(`/admin/uploaded-documents?id=${doc.id}`)}
                          >
                            Ir
                          </Button>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No hay documentos relacionados
                      </Typography>
                    )}
                  </Stack>
                </Box>
              )}
            </React.Fragment>
          ))}
        </Box>
      ))}
    </Box>
  );
}

AlertCenter.getUnreadCount = (alerts = []) =>
  alerts.filter(a => !a.isRead).length;
