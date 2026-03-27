import { useState } from 'react';
import { 
  Box, Button, Typography, Table, TableHead, TableBody, TableRow, TableCell, 
  Paper, CircularProgress, Autocomplete, TextField, LinearProgress, Alert, Snackbar
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import axios from 'axios';
import { useDocumentEntityTypes } from '../../utils/useDocumentEntityTypes';
import { uploadFile } from '../../utils/FileUploadService';
import VistaPrevia from './VistaPrevia';
import { useUploadMutations } from '../../hooks/mutations/useUploadMutations';

/**
 * Subida masiva inteligente con sugerencias de categoría, entidad y documento.
 */
export default function SubirMasivoPagePro() {
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [resultados, setResultados] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const { entityTypes, loading: loadingEntityTypes } = useDocumentEntityTypes();
  
  // Usar hook Query para subida masiva
  const { massiveUpload, isMassiveUploading, massiveUploadError } = useUploadMutations();

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Maneja selección de archivos
  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
    setResultados([]); // Resetear resultados anteriores
  };

  // Envia archivos al backend para convertir y clasificar
  const handleProcesarArchivos = async () => {
    massiveUpload(
      { files },
      {
        onSuccess: (data) => {
          setResultados(data);
          setSnackbar({ open: true, message: 'Archivos procesados correctamente', severity: 'success' });
        },
        onError: (error) => {
          console.error('Error al procesar archivos:', error);
          setSnackbar({ open: true, message: error.response?.data?.message || 'Error al procesar archivos', severity: 'error' });
        }
      }
    );
  };

  // Confirmación final de subida a Firestore
  const handleConfirmarSubida = async () => {
    setLoading(true);
    setUploadProgress({});
    
    try {
      await Promise.all(resultados.map(async (doc, index) => {
        try {
          // Descargar el archivo convertido
          const response = await fetch(doc.convertedFileURL);
          const archivo = await response.blob();
          
          const file = new File([archivo], doc.suggestedFileName || doc.originalFileName, { type: 'application/pdf' });
          
          // Configurar progreso
          setUploadProgress(prev => ({ ...prev, [index]: 0 }));
          
          await uploadFile(file, `${doc.entityType}/${doc.entityId || ''}`, {
            documentName: doc.documentName,
            entityName: doc.entityName,
            entityType: doc.entityType,
          }, (progress) => {
            setUploadProgress(prev => ({ ...prev, [index]: progress }));
          });
          
          setUploadProgress(prev => ({ ...prev, [index]: 100 }));
        } catch (err) {
          console.error(`Error en archivo ${index}:`, err);
          throw err;
        }
      }));
      
      setSnackbar({ open: true, message: 'Archivos subidos correctamente', severity: 'success' });
      setFiles([]);
      setResultados([]);
    } catch (err) {
      console.error('Error al confirmar subida:', err);
      setSnackbar({ open: true, message: err.message || 'Error al subir archivos', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>
        Subida Masiva Inteligente
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          component="label"
          variant="contained"
          startIcon={<CloudUploadIcon />}
          disabled={isMassiveUploading}
        >
          Seleccionar Archivos
          <input 
            type="file" 
            hidden 
            multiple 
            onChange={handleFileChange} 
            disabled={isMassiveUploading}
          />
        </Button>

        {files.length > 0 && (
          <Button
            variant="outlined"
            onClick={handleProcesarArchivos}
            disabled={isMassiveUploading || files.length === 0}
          >
            Procesar {files.length} Archivo{files.length !== 1 ? 's' : ''}
          </Button>
        )}
      </Box>

      {isMassiveUploading && <LinearProgress />}

      {files.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}
        </Typography>
      )}

      {resultados.length > 0 && (
        <Paper sx={{ mt: 4, p: 2 }}>
          <Typography variant="h6" gutterBottom>Revisión de Archivos</Typography>
          
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Vista Previa</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Entidad</TableCell>
                <TableCell>Categoría</TableCell>
                <TableCell>Progreso</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resultados.map((doc, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <VistaPrevia 
                      url={doc.convertedFileURL} 
                      titulo={doc.documentName} 
                      width={100} 
                      height={80}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={doc.documentName}
                      onChange={(e) => {
                        const nuevos = [...resultados];
                        nuevos[idx].documentName = e.target.value;
                        setResultados(nuevos);
                      }}
                      fullWidth
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={doc.entityName}
                      onChange={(e) => {
                        const nuevos = [...resultados];
                        nuevos[idx].entityName = e.target.value;
                        setResultados(nuevos);
                      }}
                      fullWidth
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      options={entityTypes.map((et) => et.value)}
                      loading={loadingEntityTypes}
                      value={doc.entityType}
                      onChange={(e, val) => {
                        const nuevos = [...resultados];
                        nuevos[idx].entityType = val;
                        setResultados(nuevos);
                      }}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label="Categoría" 
                          size="small" 
                        />
                      )}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    {uploadProgress[idx] !== undefined && (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={uploadProgress[idx]} 
                          />
                        </Box>
                        <Typography variant="body2">
                          {uploadProgress[idx]}%
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleConfirmarSubida}
              disabled={isMassiveUploading}
              sx={{ minWidth: 200 }}
            >
              {isMassiveUploading ? 'Subiendo...' : 'Confirmar Subida'}
            </Button>
          </Box>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
