// src/entidad/adm/components/ClassificationAnalytics.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Assessment as AssessmentIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import { useAuth } from '../../../context/AuthContext';
import { getAuth } from 'firebase/auth';

export default function ClassificationAnalytics({ companyId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [byDocument, setByDocument] = useState([]);
  const [byEntity, setByEntity] = useState([]);
  const [errorPatterns, setErrorPatterns] = useState(null);
  const [needsImprovement, setNeedsImprovement] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const { token, mainCompanyId } = useAuth();
  const auth = getAuth();
  const finalCompanyId = companyId || mainCompanyId;

  useEffect(() => {
    if (finalCompanyId && token) {
      loadAnalytics();
    }
  }, [finalCompanyId, token]);

  const loadAnalytics = async () => {
    if (!token || !finalCompanyId) return;

    setLoading(true);
    setError(null);

    try {
      const baseURL = import.meta.env.VITE_API_URL || '';

      // Cargar todas las métricas en paralelo
      const [overviewRes, byDocumentRes, byEntityRes, errorsRes, improvementRes] = await Promise.all([
        fetch(`${baseURL}/api/feedback/analytics/overview?companyId=${finalCompanyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${baseURL}/api/feedback/analytics/by-document?companyId=${finalCompanyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${baseURL}/api/feedback/analytics/by-entity?companyId=${finalCompanyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${baseURL}/api/feedback/analytics/errors?companyId=${finalCompanyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${baseURL}/api/feedback/analytics/needs-improvement?companyId=${finalCompanyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [overviewData, byDocumentData, byEntityData, errorsData, improvementData] = await Promise.all([
        overviewRes.json(),
        byDocumentRes.json(),
        byEntityRes.json(),
        errorsRes.json(),
        improvementRes.json()
      ]);

      if (overviewData.success) setOverview(overviewData.overview);
      if (byDocumentData.success) setByDocument(byDocumentData.byDocument || []);
      if (byEntityData.success) setByEntity(byEntityData.byEntity || []);
      if (errorsData.success) setErrorPatterns(errorsData.errorPatterns);
      if (improvementData.success) setNeedsImprovement(improvementData.needsImprovement || []);

    } catch (err) {
      console.error('[Analytics] Error cargando métricas:', err);
      setError(err.message || 'Error al cargar métricas');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMetadata = async (documentId) => {
    if (!token || !documentId) return;

    try {
      const baseURL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseURL}/api/feedback/update-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          requiredDocumentId: documentId,
          companyId: finalCompanyId
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(`Metadata actualizada exitosamente para ${documentId}`);
        loadAnalytics(); // Recargar métricas
      } else {
        alert(`Error: ${result.error || 'Error al actualizar metadata'}`);
      }
    } catch (err) {
      console.error('[Analytics] Error actualizando metadata:', err);
      alert('Error al actualizar metadata');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!overview) {
    return <Alert severity="info">No hay datos de clasificación disponibles</Alert>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" gutterBottom>
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Analítica de Clasificación
        </Typography>
        <Button variant="outlined" onClick={loadAnalytics}>
          Actualizar
        </Button>
      </Box>

      {/* Métricas generales */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total de Correcciones
              </Typography>
              <Typography variant="h4">{overview.totalFeedbacks || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Confianza Alta
              </Typography>
              <Typography variant="h4" color="success.main">
                {overview.confidenceDistribution?.high || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Confianza Media
              </Typography>
              <Typography variant="h4" color="warning.main">
                {overview.confidenceDistribution?.medium || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Confianza Baja
              </Typography>
              <Typography variant="h4" color="error.main">
                {overview.confidenceDistribution?.low || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Documentos que necesitan mejora */}
      {needsImprovement.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" alignItems="center" mb={2}>
            <WarningIcon color="warning" sx={{ mr: 1 }} />
            <Typography variant="h6">Documentos que Necesitan Mejora</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Documento</TableCell>
                  <TableCell align="right">Correcciones</TableCell>
                  <TableCell align="right">Confianza Promedio</TableCell>
                  <TableCell>Example Image</TableCell>
                  <TableCell>Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {needsImprovement.map((doc) => (
                  <TableRow key={doc.documentId}>
                    <TableCell>{doc.documentName || doc.documentId}</TableCell>
                    <TableCell align="right">{doc.totalCorrections}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${(doc.averageConfidence * 100).toFixed(1)}%`}
                        color={doc.averageConfidence >= 0.7 ? 'success' : doc.averageConfidence >= 0.4 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={doc.hasExampleImage ? 'Sí' : 'No'}
                        color={doc.hasExampleImage ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleUpdateMetadata(doc.documentId)}
                      >
                        Actualizar Metadata
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Métricas por documento */}
      {byDocument.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            <BarChartIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Métricas por Documento
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Documento</TableCell>
                  <TableCell align="right">Correcciones</TableCell>
                  <TableCell align="right">Confianza Promedio</TableCell>
                  <TableCell>Tipos de Corrección</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byDocument.map((doc) => (
                  <TableRow key={doc.documentId} hover>
                    <TableCell>
                      <Button
                        variant="text"
                        onClick={() => setSelectedDocument(doc)}
                      >
                        {doc.documentName || doc.documentId}
                      </Button>
                    </TableCell>
                    <TableCell align="right">{doc.totalCorrections}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${(doc.averageConfidence * 100).toFixed(1)}%`}
                        color={doc.averageConfidence >= 0.7 ? 'success' : doc.averageConfidence >= 0.4 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {Object.entries(doc.correctionTypes || {}).map(([type, count]) => (
                          <Chip
                            key={type}
                            label={`${type}: ${count}`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Tipos de errores */}
      {errorPatterns && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Tipos de Errores Comunes
          </Typography>
          <Grid container spacing={2}>
            {errorPatterns.document_type_errors && Object.keys(errorPatterns.document_type_errors).length > 0 && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Errores de Tipo de Documento
                    </Typography>
                    {Object.entries(errorPatterns.document_type_errors)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([pattern, count]) => (
                        <Box key={pattern} display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="body2">{pattern}</Typography>
                          <Chip label={count} size="small" />
                        </Box>
                      ))}
                  </CardContent>
                </Card>
              </Grid>
            )}
            {errorPatterns.entity_errors && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Errores de Entidad
                    </Typography>
                    <Typography variant="h6">
                      {errorPatterns.entity_errors.total || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {errorPatterns.field_errors && (
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Errores de Campos
                    </Typography>
                    <Typography variant="h6">
                      {errorPatterns.field_errors.total || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Métricas por entidad */}
      {byEntity.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Métricas por Empleado/Vehículo
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Entidad</TableCell>
                  <TableCell align="right">Correcciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byEntity.slice(0, 10).map((entity) => (
                  <TableRow key={entity.entityId}>
                    <TableCell>{entity.entityName || entity.entityId}</TableCell>
                    <TableCell align="right">{entity.totalCorrections}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Dialog de detalle de documento */}
      <Dialog
        open={!!selectedDocument}
        onClose={() => setSelectedDocument(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedDocument && (
          <>
            <DialogTitle>{selectedDocument.documentName}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" gutterBottom>
                <strong>Documento ID:</strong> {selectedDocument.documentId}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Total de Correcciones:</strong> {selectedDocument.totalCorrections}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Confianza Promedio:</strong> {(selectedDocument.averageConfidence * 100).toFixed(1)}%
              </Typography>
              {selectedDocument.entities && Object.keys(selectedDocument.entities).length > 0 && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Entidades:
                  </Typography>
                  {Object.entries(selectedDocument.entities)
                    .sort((a, b) => b[1] - a[1])
                    .map(([entityKey, count]) => (
                      <Chip
                        key={entityKey}
                        label={`${entityKey}: ${count}`}
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleUpdateMetadata(selectedDocument.documentId)}>
                Actualizar Metadata
              </Button>
              <Button onClick={() => setSelectedDocument(null)}>Cerrar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

