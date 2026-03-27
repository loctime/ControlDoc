import React from 'react';
import { Typography, Box } from '@mui/material';
import { useClientName } from '../../../../utils/getClientName';

const DocumentMetadataTable = ({ document, title, compact = false }) => {
  const { clientName, isLoading: isLoadingClientName } = useClientName(document?.clientId);
  return (
    <Box sx={{ mt: compact ? 1 : 3, mb: compact ? 1 : 2 }}>
      {title && (
        <Typography variant={compact ? "h6" : "subtitle2"} gutterBottom sx={{ fontWeight: 'bold' }}>
          {title}
        </Typography>
      )}
      <Box sx={{ 
        backgroundColor: 'white',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'grey.300',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        {/* Header de la tabla */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: '1.5fr 1.2fr 1.5fr 2fr 1fr 1fr 1.5fr 1.5fr',
          backgroundColor: 'primary.main',
          color: 'white',
          p: compact ? 0.3 : 2,
          gap: 1
        }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            Empresa
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            Cliente
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            Archivo
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            Entidad
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            Tamaño
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            Versión
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            Aprobado
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
            Expira
          </Typography>
        </Box>
        
        {/* Datos de la tabla */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: '1.5fr 1.2fr 1.5fr 2fr 1fr 1fr 1.5fr 1.5fr',
          p: 2,
          gap: 1,
          backgroundColor: 'grey.50',
          '& > *': {
            borderBottom: '1px solid',
            borderColor: 'grey.200',
            pb: 1
          }
        }}>
          <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500 }}>
            {document?.companyName || 'Sin empresa'}
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500 }}>
            {isLoadingClientName ? '...' : (clientName || '-')}
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500 }}>
            {document?.documentName || document?.name || 'Sin nombre'}
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500 }}>
            {document?.entityType} - {document?.entityName || 'Sin entidad'}
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500 }}>
            {(() => {
              const sizeInBytes = document?.size || document?.fileSize;
              if (sizeInBytes) {
                const sizeInKB = (sizeInBytes / 1024).toFixed(1);
                return `${sizeInKB} KB`;
              }
              return 'Desconocido';
            })()}
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500 }}>
            {document?.version || 'Sin versión'}
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500 }}>
            {document?.reviewedAt ? new Date(document.reviewedAt).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }) : 'Sin fecha'}
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500 }}>
            {document?.expirationDate ? new Date(document.expirationDate).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }) : 'Sin vencimiento'}
          </Typography>
        </Box>
        
        {/* Comentario en fila completa si existe */}
        {document?.comentario && (
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'grey.300' }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
              Comentario:
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block' }}>
              {document.comentario}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DocumentMetadataTable;
