// React import removed - using JSX runtime
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Stack
} from '@mui/material';
import DownloadButton from '../../components/common/DownloadButton';
import TextViewerCanvas from '../../components/common/TextViewerCanvas';
import useDocumentStatus from '../../hooks/useDocumentStatus';
import { parseFirestoreDate } from '../../utils/dateHelpers';
import { useCompanies } from '../../context/CompaniesContext';
import { getDeadlineColor, getDeadlineStatus, getStatusIconComponent } from '../../utils/getDeadlineUtils';
import { buildDownloadName } from '../../utils/buildDownloadName';
import ResultadoAnalisisArchivo from '../../components/common/scanResult';
import axios from 'axios';
import DownloadAsPdfButton from '../../components/common/DownloadAsPdfButton.jsx';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SimpleImageProgress from '../../components/common/SimpleImageProgress';
import ImageViewerWithSearch from '../../components/common/ImageViewerWithSearch';
import ImageControlPanel from '../../components/common/ImageControlPanel';

function SimplePDFViewer({ fileURL, onDownload }) {
  return (
    <Box>
      <Box sx={{ width: '100%', height: { xs: '60vh', md: '75vh' }, border: '1px solid var(--info-main)', borderRadius: 1 }}>
        <iframe
          src={fileURL}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '4px'
          }}
          title="Visor PDF"
          onError={(e) => {
            console.error('Error cargando PDF en iframe:', e);
          }}
        />
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button
          variant="outlined"
          onClick={() => window.open(fileURL, '_blank')}
        >
          Abrir en nueva pestaña
        </Button>
        <Button
          variant="outlined"
          onClick={() => onDownload(fileURL)}
        >
          Descargar PDF
        </Button>
      </Stack>
    </Box>
  );
}

export default function VistaDocumentoSubido({
  documentId,
  name,
  fileURL,
  fileName,
  companyComment,
  adminComment,
  exampleComment,
  email,
  uploadedByEmail,
  documentDescription,
  expirationDate,
  status,
  uploadedAt,
  companyId,
  companyName: initialCompanyName,
  entityType,
  entityName,
  metadata,
  onDateSelect, // Callback para actualizar fecha en PendientesPage
  onApproveClick, // Callback para abrir diálogo de aprobación
  onRejectClick, // Callback para abrir diálogo de rechazo
  onSetInProcessClick, // Callback para abrir diálogo de poner en proceso
  selectedDate: propSelectedDate, // Fecha ya seleccionada desde PendientesPage
}) {
  const { getDocumentStatus, getStatusColor } = useDocumentStatus();
  const { companies } = useCompanies();

  const parsedExpiration = parseFirestoreDate(expirationDate);
  const parsedUploadDate = typeof uploadedAt === 'string'
    ? uploadedAt
    : parseFirestoreDate(uploadedAt)?.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) || 'N/A';
  
  const companyName = companyId 
    ? companies.find(c => c.id === companyId)?.name || initialCompanyName || 'Empresa no especificada'
    : initialCompanyName || 'Empresa no especificada';

  // Estados para análisis de archivo
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [highlight, setHighlight] = useState('');
  const [selectedDate, setSelectedDate] = useState(propSelectedDate || null);

  // Sincronizar selectedDate cuando cambie propSelectedDate
  useEffect(() => {
    if (propSelectedDate !== undefined) {
      setSelectedDate(propSelectedDate);
    }
  }, [propSelectedDate]);

  // Handler para cuando se selecciona una fecha en la imagen
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    // Actualizar en PendientesPage
    if (onDateSelect) {
      onDateSelect(documentId, date);
    }
  };

  // Handler para aprobar (abre diálogo)
  const handleApprove = () => {
    if (onApproveClick) {
      onApproveClick(documentId, selectedDate);
    }
  };

  // Handler para rechazar (abre diálogo)
  const handleReject = () => {
    if (onRejectClick) {
      onRejectClick(documentId);
    }
  };

  // Handler para poner en proceso (abre diálogo)
  const handleSetInProcess = () => {
    if (onSetInProcessClick) {
      onSetInProcessClick(documentId);
    }
  };

  // Handler para descargar
  const handleDownload = (url) => {
    window.open(url, '_blank');
  };

  const analyzeFile = async (fileURL) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/analyze-file`,
        { fileURL },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setResult(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.detalle ||
        err.message ||
        'Error al analizar el archivo'
      );
    } finally {
      setLoading(false);
    }
  };

  // Detectar tipo de archivo basado en extensión
  const getFileType = (fileName) => {
    if (!fileName) return null;
    const ext = fileName.toLowerCase().split('.').pop();
    const mimeTypes = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp'
    };
    return mimeTypes[ext] || null;
  };

  const fileType = getFileType(fileName);
  
  // Debug: mostrar información del archivo
  console.log('🔍 Debug archivo:', {
    fileName,
    fileType,
    isPDF: fileName.match(/\.pdf$/i),
    isImage: fileType?.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
  });

  return (
    <Box sx={{ p: 2 }}>
      {/* Encabezado con información del documento */}
      <Box sx={{ mb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="h5" fontWeight="bold">
            {name || documentDescription || fileName?.split('.')[0] || 'Documento sin nombre'}
          </Typography>
          <Typography variant="body2">
            Entidad: {entityName || 'N/A'} ({entityType || 'N/A'})
          </Typography>
          {expirationDate && (
            <Chip 
              label={`Vence: ${parsedExpiration?.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }) || ''}`}
              color={getDeadlineStatus(expirationDate).color}
              size="small"
            />
          )}
          <Typography variant="body2" color="text.secondary">
            Subido por: {uploadedByEmail || email || 'N/A'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fecha: {parsedUploadDate}
          </Typography>
        </Stack>
      </Box>

      {/* Visor de documentos */}
      <Box sx={{ mb: 3 }}>
        {/* Mostrar progreso de carga para imágenes */}
        {fileURL && !fileName.match(/\.pdf$/i) && (
          <SimpleImageProgress 
            fileURL={fileURL}
            onComplete={() => console.log('Progreso de imagen completado')}
          />
        )}
        
        {/* Si es PDF, usa visor simple. Si es imagen, usa SimpleImageViewer. Si no, usa TextViewerCanvas */}
        {fileURL && fileName.match(/\.pdf$/i) ? (
          <SimplePDFViewer 
            fileURL={fileURL}
            onDownload={handleDownload}
          />
        ) : fileType?.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i) ? (
          <>
            {/* ControlPanel para imágenes */}
            <ImageControlPanel
              selectedDate={selectedDate}
              onApprove={handleApprove}
              onReject={handleReject}
              onSetInProcess={handleSetInProcess}
              onDownload={handleDownload}
              documentId={documentId}
              fileURL={fileURL}
            />
            <ImageViewerWithSearch 
              fileURL={fileURL}
              fileName={fileName}
              maxHeight={{ xs: '60vh', md: '75vh' }}
              onDateSelect={handleDateSelect}
            />
          </>
        ) : (
          <TextViewerCanvas 
            fileURL={fileURL}
            fileType={fileType}
            sx={{ 
              width: '100%', 
              height: { xs: '60vh', md: '75vh' },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              overflow: 'hidden'
            }}
          />
        )}
        
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <DownloadButton
            url={fileURL}
            currentDocument={{
              fileURL,
              fileName,
              companyName,
              name: name || documentDescription || fileName?.split('.')[0] || 'Documento',
              entityType,
              entityName
            }}
            label="Descargar original"
            variant="outlined"
            size="small"
          />
          
          {fileURL && fileName.match(/\.(jpg|jpeg|png)$/i) && (
            <Box>
              <DownloadAsPdfButton
                imageUrl={fileURL}
                filename={buildDownloadName({
                  fileURL,
                  fileName,
                  companyName,
                  name: name || documentDescription || fileName?.split('.')[0] || 'Documento',
                  entityType,
                  entityName
                }).replace(/\.[^.]+$/, '.pdf')}
                label="Convertir a PDF"
                variant="outlined"
                size="small"
              />
              <Typography variant="caption" color="info.main" sx={{ mt: 0.5, display: 'block' }}>
                Al aprobar un documento será convertido a PDF automáticamente
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      
        
        {/* Comentarios */}
        {(companyComment || adminComment) && (
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>Comentarios</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {companyComment && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Comentario de la empresa:
                  </Typography>
                  <Typography>{companyComment}</Typography>
                </Box>
              )}
              {adminComment && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Comentario de revisión:
                  </Typography>
                  <Typography>{adminComment}</Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        )}
    </Box>
  );
}
