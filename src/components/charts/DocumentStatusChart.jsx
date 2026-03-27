import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  LinearProgress,
  Card,
  CardContent
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

/**
 * Componente para mostrar el estado de documentos de una empresa
 * @param {Object} props
 * @param {Object} props.documentStats - Estadísticas de documentos
 * @param {number} props.documentStats.total - Total de documentos
 * @param {number} props.documentStats.aprobados - Documentos aprobados
 * @param {number} props.documentStats.pendientes - Documentos pendientes
 * @param {number} props.documentStats.rechazados - Documentos rechazados
 * @param {number} props.documentStats.vencidos - Documentos vencidos
 * @param {number} props.documentStats.porVencer - Documentos por vencer
 * @param {boolean} props.compact - Si mostrar versión compacta
 */
const DocumentStatusChart = ({ documentStats, compact = false }) => {
  if (!documentStats) {
    return (
      <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: "var(--paper-background)" }}>
        <Typography sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>Sin datos de documentos</Typography>
      </Paper>
    );
  }

  const { total, aprobados, pendientes, rechazados, vencidos, porVencer } = documentStats;

  const getPercentage = (value) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'aprobados': return 'success';
      case 'pendientes': return 'warning';
      case 'rechazados': return 'error';
      case 'vencidos': return 'error';
      case 'porVencer': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'aprobados': return <CheckCircleIcon />;
      case 'pendientes': return <PendingIcon />;
      case 'rechazados': return <CancelIcon />;
      case 'vencidos': return <CancelIcon />;
      case 'porVencer': return <WarningIcon />;
      default: return <ScheduleIcon />;
    }
  };

  if (compact) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, backgroundColor: "var(--paper-background)", p: 2, borderRadius: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ color: "var(--paper-background-text)" }}>
            Estado de Documentos
          </Typography>
          <Typography variant="body2" sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>
            Total: {total}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {aprobados > 0 && (
            <Chip
              icon={<CheckCircleIcon sx={{ color: "var(--success-main)" }} />}
              label={`${aprobados} Aprobados (${getPercentage(aprobados)}%)`}
              color="success"
              size="small"
              variant="outlined"
              sx={{
                borderColor: "var(--success-main)",
                color: "var(--paper-background-text)",
                backgroundColor: "var(--paper-background)",
                "& .MuiChip-label": {
                  color: "var(--paper-background-text)"
                }
              }}
            />
          )}
          {pendientes > 0 && (
            <Chip
              icon={<PendingIcon sx={{ color: "var(--warning-main)" }} />}
              label={`${pendientes} Pendientes (${getPercentage(pendientes)}%)`}
              color="warning"
              size="small"
              variant="outlined"
              sx={{
                borderColor: "var(--warning-main)",
                color: "var(--paper-background-text)",
                backgroundColor: "var(--paper-background)",
                "& .MuiChip-label": {
                  color: "var(--paper-background-text)"
                }
              }}
            />
          )}
          {rechazados > 0 && (
            <Chip
              icon={<CancelIcon sx={{ color: "var(--error-main)" }} />}
              label={`${rechazados} Rechazados (${getPercentage(rechazados)}%)`}
              color="error"
              size="small"
              variant="outlined"
              sx={{
                borderColor: "var(--error-main)",
                color: "var(--paper-background-text)",
                backgroundColor: "var(--paper-background)",
                "& .MuiChip-label": {
                  color: "var(--paper-background-text)"
                }
              }}
            />
          )}
          {vencidos > 0 && (
            <Chip
              icon={<CancelIcon sx={{ color: "white" }} />}
              label={`${vencidos} Vencidos (${getPercentage(vencidos)}%)`}
              color="error"
              size="small"
              variant="filled"
              sx={{
                bgcolor: "var(--error-main)",
                color: "white",
                "& .MuiChip-label": {
                  color: "white"
                }
              }}
            />
          )}
          {porVencer > 0 && (
            <Chip
              icon={<WarningIcon sx={{ color: "white" }} />}
              label={`${porVencer} Por Vencer (${getPercentage(porVencer)}%)`}
              color="warning"
              size="small"
              variant="filled"
              sx={{
                bgcolor: "var(--warning-main)",
                color: "white",
                "& .MuiChip-label": {
                  color: "white"
                }
              }}
            />
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3, borderRadius: 2, backgroundColor: "var(--paper-background)" }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: "var(--paper-background-text)" }}>
        <ScheduleIcon sx={{ color: "var(--primary-main)" }} />
        Estado de Documentos
      </Typography>
      
      <Grid container spacing={2}>
        {/* Resumen general */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ color: "var(--paper-background-text)" }}>Total de Documentos: {total}</Typography>
            {total > 0 && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" sx={{ color: "var(--success-main)" }} fontWeight="medium">
                  {getPercentage(aprobados)}% Aprobados
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--warning-main)" }} fontWeight="medium">
                  {getPercentage(pendientes)}% Pendientes
                </Typography>
                <Typography variant="body2" sx={{ color: "var(--error-main)" }} fontWeight="medium">
                  {getPercentage(rechazados)}% Rechazados
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>

        {/* Gráfico de barras */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { key: 'aprobados', label: 'Aprobados', value: aprobados, color: '#4caf50' },
              { key: 'pendientes', label: 'Pendientes', value: pendientes, color: '#ff9800' },
              { key: 'rechazados', label: 'Rechazados', value: rechazados, color: '#f44336' },
              { key: 'vencidos', label: 'Vencidos', value: vencidos, color: '#d32f2f' },
              { key: 'porVencer', label: 'Por Vencer', value: porVencer, color: '#ff5722' }
            ].filter(item => item.value > 0).map((item) => {
              const statusColor = getStatusColor(item.key);
              let iconColor;
              if (statusColor === 'success') iconColor = 'var(--success-main)';
              else if (statusColor === 'warning') iconColor = 'var(--warning-main)';
              else if (statusColor === 'error') iconColor = 'var(--error-main)';
              else iconColor = 'var(--primary-main)';
              
              return (
                <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ minWidth: 100, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: iconColor, display: 'flex', alignItems: 'center' }}>
                      {getStatusIcon(item.key)}
                    </Box>
                    <Typography variant="body2" sx={{ minWidth: 80, color: "var(--paper-background-text)" }}>
                      {item.label}
                    </Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={getPercentage(item.value)}
                      sx={{
                        flexGrow: 1,
                        height: 8,
                        borderRadius: 1,
                        backgroundColor: "var(--page-background)",
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: item.color,
                          borderRadius: 1
                        }
                      }}
                    />
                    <Typography variant="body2" sx={{ minWidth: 60, textAlign: 'right', color: "var(--paper-background-text)" }}>
                      {item.value} ({getPercentage(item.value)}%)
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Grid>

        {/* Tarjetas de resumen */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            {[
              { key: 'aprobados', label: 'Aprobados', value: aprobados, icon: CheckCircleIcon, color: 'success' },
              { key: 'pendientes', label: 'Pendientes', value: pendientes, icon: PendingIcon, color: 'warning' },
              { key: 'rechazados', label: 'Rechazados', value: rechazados, icon: CancelIcon, color: 'error' },
              { key: 'vencidos', label: 'Vencidos', value: vencidos, icon: CancelIcon, color: 'error' },
              { key: 'porVencer', label: 'Por Vencer', value: porVencer, icon: WarningIcon, color: 'warning' }
            ].filter(item => item.value > 0).map((item) => {
              let iconColor, borderColor;
              if (item.color === 'success') {
                iconColor = 'var(--success-main)';
                borderColor = 'var(--success-main)';
              } else if (item.color === 'warning') {
                iconColor = 'var(--warning-main)';
                borderColor = 'var(--warning-main)';
              } else if (item.color === 'error') {
                iconColor = 'var(--error-main)';
                borderColor = 'var(--error-main)';
              } else {
                iconColor = 'var(--primary-main)';
                borderColor = 'var(--divider-color)';
              }
              
              return (
                <Grid item xs={6} sm={4} md={2.4} key={item.key}>
                  <Card 
                    sx={{ 
                      textAlign: 'center',
                      backgroundColor: "var(--paper-background)",
                      border: item.key === 'vencidos' || item.key === 'porVencer' ? 2 : 1,
                      borderColor: item.key === 'vencidos' || item.key === 'porVencer' ? borderColor : 'var(--divider-color)'
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <item.icon 
                        sx={{ fontSize: 32, mb: 1, color: iconColor }} 
                      />
                      <Typography variant="h6" sx={{ color: iconColor }}>
                        {item.value}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', color: "var(--paper-background-text)", opacity: 0.7 }}>
                        {getPercentage(item.value)}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Grid>

        {/* Alertas importantes */}
        {(vencidos > 0 || porVencer > 0) && (
          <Grid item xs={12}>
            <Box sx={{ mt: 2 }}>
              {vencidos > 0 && (
                <Chip
                  icon={<CancelIcon sx={{ color: "white" }} />}
                  label={`${vencidos} documento(s) vencido(s) - Acción requerida`}
                  color="error"
                  variant="filled"
                  sx={{ 
                    mb: 1, 
                    mr: 1,
                    bgcolor: "var(--error-main)",
                    color: "white",
                    "& .MuiChip-label": {
                      color: "white"
                    }
                  }}
                />
              )}
              {porVencer > 0 && (
                <Chip
                  icon={<WarningIcon sx={{ color: "white" }} />}
                  label={`${porVencer} documento(s) por vencer - Revisar próximamente`}
                  color="warning"
                  variant="filled"
                  sx={{ 
                    mb: 1, 
                    mr: 1,
                    bgcolor: "var(--warning-main)",
                    color: "white",
                    "& .MuiChip-label": {
                      color: "white"
                    }
                  }}
                />
              )}
            </Box>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};

export default DocumentStatusChart;
