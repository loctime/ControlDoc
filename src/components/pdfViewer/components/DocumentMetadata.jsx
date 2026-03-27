import React from 'react';
import { Box, Typography, Chip, Divider } from '@mui/material';
import { Email, CalendarToday, Comment } from '@mui/icons-material';
import { parseFirestoreDate } from '../../../utils/dateHelpers';

export default function DocumentMetadata({
  uploadedAt,
  uploadedByEmail,
  companyComment,
  adminComment,
  companyName,
  status
}) {
  // Debug logs
  console.log('📊 DocumentMetadata props:', {
    uploadedAt,
    uploadedByEmail,
    companyComment,
    adminComment,
    companyName,
    status
  });
  const formatDate = (date) => {
    if (!date) return 'No disponible';
    try {
      // Si ya es una fecha válida, usarla directamente
      if (date instanceof Date && !isNaN(date)) {
        return date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // Si es string, intentar parsearlo
      if (typeof date === 'string') {
        // Si ya está formateado como "DD/MM/YYYY, HH:mm" o "DD/MM/YYYY", extraer y parsear
        const dateTimeMatch = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?/);
        if (dateTimeMatch) {
          const [, day, month, year, hour, minute] = dateTimeMatch;
          const dateObj = new Date(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day),
            hour ? parseInt(hour) : 0,
            minute ? parseInt(minute) : 0
          );
          if (!isNaN(dateObj)) {
            return dateObj.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }
        
        // Intentar parsear como fecha ISO o estándar
        const parsed = new Date(date);
        if (!isNaN(parsed)) {
          return parsed.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      }
      
      // Intentar con parseFirestoreDate como fallback
      const parsed = parseFirestoreDate(date);
      if (parsed && !isNaN(parsed)) {
        return parsed.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      return 'Fecha inválida';
    } catch (error) {
      console.error('Error formateando fecha:', error, date);
      return 'Fecha inválida';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'aprobado':
      case 'approved': return 'success';
      case 'rechazado':
      case 'rejected': return 'error';
      case 'pendiente':
      case 'pending':
      case 'subido': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'aprobado':
      case 'approved': return 'Aprobado';
      case 'rechazado':
      case 'rejected': return 'Rechazado';
      case 'pendiente':
      case 'pending': return 'Pendiente';
      case 'subido': return 'Subido';
      default: return status || 'Desconocido';
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1, 
      flexWrap: 'wrap',
      ml: 1
    }}>
      {/* Estado del documento */}
      <Chip
        label={getStatusText(status)}
        color={getStatusColor(status)}
        size="small"
        sx={{ fontWeight: 'bold', fontSize: '0.65rem', height: '20px' }}
      />

      {/* Fecha de subida */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
        <CalendarToday sx={{ fontSize: '0.8rem', color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          {formatDate(uploadedAt)}
        </Typography>
      </Box>

      {/* Email del usuario */}
      {uploadedByEmail && uploadedByEmail.trim() && uploadedByEmail !== 'undefined' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Email sx={{ fontSize: '0.8rem', color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary" sx={{ 
            maxWidth: '100px', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            fontSize: '0.65rem'
          }}>
            {uploadedByEmail}
          </Typography>
        </Box>
      )}

      {/* Comentarios */}
      {(companyComment || adminComment) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Comment sx={{ fontSize: '0.8rem', color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            {companyComment ? 'Comentario' : 'Admin'}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
