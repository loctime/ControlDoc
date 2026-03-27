import { useState } from 'react';
// import { getControlFileIdToken, getControlFileUser } from '../../utils/ControlFileAuth'; // SDK deshabilitado temporalmente para debug
import { Box, Button, TextField, Typography, Paper, Alert, CircularProgress } from '@mui/material';

const ControlFileSdkTest = () => {
  // SDK deshabilitado temporalmente para debug
  throw new Error("SDK deshabilitado temporalmente para debug");
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setError(null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor selecciona un archivo');
      return;
    }

    const cfUser = getControlFileUser();
    if (!cfUser?.uid) {
      setError('Debes estar conectado a ControlFile primero');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Construir path: ['controldoc', 'pruebas', userId]
      const path = ['controldoc', 'pruebas', cfUser.uid];

      // El SDK solo tiene upload() con parentId, no uploadFile() con path
      // Hacemos llamada directa a la API para usar paths
      const token = await getControlFileIdToken();
      const baseUrl = import.meta.env.VITE_CONTROLFILE_BACKEND_URL;
      
      // Paso 1: Presign con path
      const presignResponse = await fetch(`${baseUrl}/api/uploads/presign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          path: path,
          userId: cfUser.uid,
        }),
      });

      if (!presignResponse.ok) {
        const errorText = await presignResponse.text();
        throw new Error(`Error en presign: ${presignResponse.status} - ${errorText}`);
      }

      const presignData = await presignResponse.json();

      // Paso 2: Upload al storage
      const uploadUrl = presignData.uploadUrl;
      const method = presignData.method || 'PUT';
      const headers = presignData.headers || {};

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            console.log(`Progreso: ${progress.toFixed(0)}%`);
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed due to network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload was aborted')));
        xhr.open(method, uploadUrl);
        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
        xhr.send(file);
      });

      // Paso 3: Confirmar upload
      const confirmResponse = await fetch(`${baseUrl}/api/uploads/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadSessionId: presignData.uploadSessionId,
          key: presignData.fileKey,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          name: file.name,
          path: path,
          userId: cfUser.uid,
        }),
      });

      if (!confirmResponse.ok) {
        const errorText = await confirmResponse.text();
        throw new Error(`Error en confirm: ${confirmResponse.status} - ${errorText}`);
      }

      const confirmData = await confirmResponse.json();

      if (!confirmData.fileId) {
        throw new Error('La respuesta de confirmación no incluye fileId');
      }

      const uploadResult = {
        fileId: confirmData.fileId,
        fileName: file.name,
        fileSize: file.size,
      };

      // Mostrar resultado
      setResult({
        fileId: uploadResult.fileId || uploadResult.id || 'N/A',
        fileName: uploadResult.fileName || file.name,
        fileSize: uploadResult.fileSize || file.size,
      });
    } catch (err) {
      console.error('Error en subida:', err);
      
      // Detectar error de autenticación
      if (
        err.message?.includes('No conectado') ||
        err.message?.includes('401') ||
        err.message?.includes('autenticación') ||
        err.message?.includes('token')
      ) {
        setError('Error de autenticación: Debes estar conectado a ControlFile. Verifica tu conexión.');
      } else {
        setError(`Error al subir archivo: ${err.message || 'Error desconocido'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Prueba SDK ControlFile
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Página de prueba aislada para validar el SDK de ControlFile
      </Typography>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ mb: 2 }}>
          <input
            type="file"
            onChange={handleFileChange}
            style={{ marginBottom: '16px' }}
            disabled={loading}
          />
        </Box>

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!file || loading}
          sx={{ mb: 2 }}
        >
          {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          Subir a ControlFile (SDK)
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Paper sx={{ p: 3, bgcolor: 'success.light', color: 'success.contrastText' }}>
          <Typography variant="h6" gutterBottom>
            Archivo subido exitosamente
          </Typography>
          <Typography variant="body1">
            <strong>File ID:</strong> {result.fileId}
          </Typography>
          <Typography variant="body1">
            <strong>File Name:</strong> {result.fileName}
          </Typography>
          <Typography variant="body1">
            <strong>File Size:</strong> {result.fileSize} bytes
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default ControlFileSdkTest;
