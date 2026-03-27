import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import useDashboardDataQuery from '../../entidad/user/components/hooks/useDashboardDataQuery';
import {
  createJob,
  getJob,
  getJobFiles,
  uploadJobFile,
  startJob,
  patchFileDecision,
  commitJob
} from '../../entidad/user/services/bulkV2VehicleService';

const CONFIDENCE_LABEL = { high: 'Alta', med: 'Media', low: 'Baja' };
const STATUS_LABEL = {
  uploaded: 'Subido',
  analyzed: 'Listo',
  needs_review: 'Revisar',
  confirmed: 'Confirmado',
  committed: 'Completado',
  error: 'Error'
};

export default function BulkVehiclesPage() {
  const [searchParams] = useSearchParams();
  const clientIdParam = searchParams.get('clientId') || null;
  const { token, mainCompanyId, activeCompanyId } = useAuth();
  const companyId = mainCompanyId;

  const { vehiculos = [], requiredDocuments = [] } = useDashboardDataQuery(
    companyId,
    0,
    0,
    activeCompanyId,
    mainCompanyId
  ) || {};
  const vehicleDocs = (requiredDocuments || []).filter(
    (d) => d.entityType === 'vehicle' || d.entityType === 'vehiculo'
  );

  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all | low_confidence | no_required | no_vehicle
  const [searchText, setSearchText] = useState('');

  const clientId = clientIdParam || (job?.clientId ?? null);

  const refreshJob = useCallback(async () => {
    if (!token || !jobId) return;
    try {
      const j = await getJob(token, jobId);
      setJob(j);
    } catch (e) {
      setError(e.message);
    }
  }, [token, jobId]);

  const refreshFiles = useCallback(async () => {
    if (!token || !jobId) return;
    try {
      const { files: list } = await getJobFiles(token, jobId);
      setFiles(list || []);
    } catch (e) {
      setError(e.message);
    }
  }, [token, jobId]);

  useEffect(() => {
    if (!token || !companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { jobId: id } = await createJob(token, clientIdParam || undefined);
        if (!cancelled) setJobId(id);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, companyId, clientIdParam]);

  useEffect(() => {
    if (!jobId || !token) return;
    refreshJob();
  }, [jobId, token, refreshJob]);

  useEffect(() => {
    if (!jobId || !token) return;
    refreshFiles();
    const t = setInterval(refreshFiles, 3000);
    return () => clearInterval(t);
  }, [jobId, token, refreshFiles]);

  const handleFiles = async (selectedFiles) => {
    if (!token || !jobId || !selectedFiles?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(selectedFiles)) {
        await uploadJobFile(token, jobId, file);
      }
      await refreshFiles();
      await refreshJob();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!token || !jobId) return;
    setStarting(true);
    setError(null);
    try {
      await startJob(token, jobId);
      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 2000));
        const j = await getJob(token, jobId);
        setJob(j);
        if (j.status === 'review') break;
        attempts++;
      }
      await refreshFiles();
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  const handleDecision = async (fileId, updates) => {
    if (!token || !jobId) return;
    const f = files.find((x) => x.id === fileId);
    const base = f?.decision ?? {};
    const decision = {
      finalVehicleId: updates.finalVehicleId !== undefined ? updates.finalVehicleId : (base.finalVehicleId ?? f?.analysis?.suggestions?.suggestedVehicleId ?? null),
      finalRequiredId: updates.finalRequiredId !== undefined ? updates.finalRequiredId : (base.finalRequiredId ?? f?.analysis?.suggestions?.suggestedRequiredId ?? null),
      finalExpirationDate: updates.finalExpirationDate !== undefined ? updates.finalExpirationDate : (base.finalExpirationDate ?? null)
    };
    try {
      await patchFileDecision(token, jobId, fileId, decision);
      await refreshFiles();
      await refreshJob();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleCommit = async () => {
    if (!token || !jobId) return;
    setCommitting(true);
    setError(null);
    try {
      await commitJob(token, jobId);
      await refreshJob();
      await refreshFiles();
    } catch (e) {
      setError(e.message);
    } finally {
      setCommitting(false);
    }
  };

  const filteredFiles = files.filter((f) => {
    if (filter === 'low_confidence') {
      const v = f.analysis?.suggestions?.confidenceVehicle;
      const r = f.analysis?.suggestions?.confidenceRequired ?? 0;
      if (v !== 'low' && r >= 0.2) return false;
    }
    if (filter === 'no_required' && (f.decision?.finalRequiredId || f.analysis?.suggestions?.suggestedRequiredId)) return false;
    if (filter === 'no_vehicle' && (f.decision?.finalVehicleId || f.analysis?.suggestions?.suggestedVehicleId)) return false;
    if (searchText) {
      const text = searchText.toLowerCase();
      const name = (f.originalName || '').toLowerCase();
      const pat = (f.analysis?.detected?.patentes?.[0] || '').toLowerCase();
      if (!name.includes(text) && !pat.includes(text)) return false;
    }
    return true;
  });

  const confirmedCount = files.filter((f) => f.status === 'confirmed').length;
  const canCommit = confirmedCount > 0 && job?.status === 'review';

  if (!token) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Debes iniciar sesión para usar la subida masiva.</Alert>
      </Box>
    );
  }

  if (loading && !jobId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Subida masiva V2 — Vehículos
      </Typography>
      {clientIdParam && (
        <Typography variant="body2" color="text.secondary">
          Cliente: {clientIdParam}
        </Typography>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Estado del job: {job?.status ?? '—'} · Archivos: {files.length}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
          <Button
            variant="outlined"
            component="label"
            disabled={uploading || job?.status !== 'uploading' && job?.status !== 'review'}
          >
            {uploading ? 'Subiendo…' : 'Seleccionar archivos'}
            <input
              type="file"
              hidden
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </Button>
          <Button
            variant="contained"
            onClick={handleStartAnalysis}
            disabled={starting || files.length === 0 || job?.status !== 'uploading'}
          >
            {starting ? 'Analizando…' : 'Iniciar análisis'}
          </Button>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Filtro</InputLabel>
          <Select value={filter} label="Filtro" onChange={(e) => setFilter(e.target.value)}>
            <MenuItem value="all">Todo</MenuItem>
            <MenuItem value="low_confidence">Solo baja confianza</MenuItem>
            <MenuItem value="no_required">Sin requerido</MenuItem>
            <MenuItem value="no_vehicle">Sin vehículo</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          placeholder="Buscar por patente o nombre..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start">🔍</InputAdornment>
          }}
          sx={{ minWidth: 220 }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Archivo</TableCell>
              <TableCell>Patente</TableCell>
              <TableCell>Vehículo</TableCell>
              <TableCell>Documento requerido</TableCell>
              <TableCell>Confianza</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFiles.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <a href={f.staging?.url} target="_blank" rel="noopener noreferrer">
                    {f.originalName || f.id}
                  </a>
                </TableCell>
                <TableCell>
                  {(f.analysis?.detected?.patentes || [])[0] && (
                    <Chip size="small" label={f.analysis.detected.patentes[0]} />
                  )}
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={f.decision?.finalVehicleId ?? f.analysis?.suggestions?.suggestedVehicleId ?? ''}
                      onChange={(e) => handleDecision(f.id, { finalVehicleId: e.target.value || null })}
                      displayEmpty
                    >
                      <MenuItem value="">—</MenuItem>
                      {(vehiculos || []).map((v) => (
                        <MenuItem key={v.id} value={v.id}>
                          {v.patente || v.marca || v.id}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={f.decision?.finalRequiredId ?? f.analysis?.suggestions?.suggestedRequiredId ?? ''}
                      onChange={(e) => handleDecision(f.id, { finalRequiredId: e.target.value || null })}
                      displayEmpty
                    >
                      <MenuItem value="">—</MenuItem>
                      {(vehicleDocs || []).map((d) => (
                        <MenuItem key={d.id} value={d.id}>
                          {d.name || d.id}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  {f.analysis?.suggestions && (
                    <>
                      <Chip size="small" label={CONFIDENCE_LABEL[f.analysis.suggestions.confidenceVehicle] || f.analysis.suggestions.confidenceVehicle} sx={{ mr: 0.5 }} />
                      <Chip size="small" label={`Req: ${Math.round((f.analysis.suggestions.confidenceRequired || 0) * 100)}%`} />
                    </>
                  )}
                </TableCell>
                <TableCell>{STATUS_LABEL[f.status] || f.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Paper sx={{ p: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCommit}
          disabled={!canCommit || committing}
        >
          {committing ? 'Procesando…' : `Confirmar asignaciones (${confirmedCount})`}
        </Button>
      </Paper>
    </Box>
  );
}
