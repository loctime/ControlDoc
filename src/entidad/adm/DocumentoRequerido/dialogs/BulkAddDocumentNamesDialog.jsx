import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';

/**
 * Dialog for bulk adding document names to Firestore
 * @param {boolean} open
 * @param {function} onClose
 * @param {function} onBulkAdd (namesArray) => Promise<{added: string[], skipped: string[], error?: string}>
 * @param {boolean} loading
 */
export default function BulkAddDocumentNamesDialog({ open, onClose, onBulkAdd, loading }) {
  const [inputValue, setInputValue] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleBulkAdd = async () => {
    setError('');
    setResult(null);
    const names = inputValue
      .split(/\r?\n|,|;/)
      .map(s => s.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setError('Debes ingresar al menos un nombre.');
      return;
    }
    try {
      const res = await onBulkAdd(names);
      setResult(res);
      if (res.error) setError(res.error);
      if (!res.error) setInputValue('');
    } catch (e) {
      setError('Error al agregar nombres: ' + (e.message || e));
    }
  };

  const handleClose = () => {
    setInputValue('');
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Agregar nombres de documentos en lote</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Ingresa varios nombres de documentos, uno por línea, separados por coma o punto y coma. Los nombres duplicados serán ignorados.
        </Typography>
        <TextField
          label="Nombres de documentos"
          placeholder="Ejemplo: Documento A\nDocumento B\nDocumento C"
          multiline
          minRows={4}
          fullWidth
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          disabled={loading}
        />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {result && (
          <Box sx={{ mt: 2 }}>
            {result.added?.length > 0 && <Alert severity="success">Agregados: {result.added.join(', ')}</Alert>}
            {result.skipped?.length > 0 && <Alert severity="info">Ignorados (ya existían): {result.skipped.join(', ')}</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cerrar</Button>
        <Button onClick={handleBulkAdd} variant="contained" disabled={loading || !inputValue.trim()}>
          {loading ? <CircularProgress size={22} /> : 'Agregar en lote'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
