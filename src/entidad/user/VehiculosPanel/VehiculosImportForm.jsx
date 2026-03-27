import React, { useState, useContext } from 'react';
import { AuthContext } from '../../../context/AuthContext';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import * as XLSX from 'xlsx';

const VehiculosImportForm = ({ onVehiculosAdded }) => {
  const { activeCompanyId, mainCompanyId } = useContext(AuthContext);
  const userCompanyData = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('userCompany') || '{}') : {};
  // Siempre usar mainCompanyId como companyId
  const finalCompanyId = mainCompanyId || userCompanyData?.companyId;
  // Determinar clientId: si activeCompanyId !== mainCompanyId, entonces es un cliente
  const clientId = (activeCompanyId && activeCompanyId !== mainCompanyId) ? activeCompanyId : null;
  
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showWebModal, setShowWebModal] = useState(false);
  const [webFormData, setWebFormData] = useState([
    {
      patente: '',
      marca: '',
      modelo: '',
      año: ''
    }
  ]);
  const [pasteData, setPasteData] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [fieldErrors, setFieldErrors] = useState([]);

  const normalizePatente = (value) => String(value || '')
    .toUpperCase()
    .replace(/[\s\-\/]/g, '');

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('Excel Parsed:', jsonData);
        
        const validatedData = validateVehiculosData(jsonData);
        setPreviewData(validatedData);
        setShowPreview(true);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        setError('Error al procesar el archivo Excel: ' + err.message);
      }
    };

    if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(selectedFile);
    } else {
      setError('Por favor selecciona un archivo Excel (.xlsx o .xls)');
    }
  };

  const validateVehiculosData = (data) => {
    const validRows = [];
    const errors = [];

    data.forEach((row, index) => {
      // Verificar si la fila está completamente vacía
      const isEmpty = Object.values(row).every(value => 
        value === null || value === undefined || String(value).trim() === ''
      );
      
      if (isEmpty) return; // Saltar filas vacías

      const patente = String(row.patente || '').trim();
      const marca = String(row.marca || '').trim();
      const modelo = String(row.modelo || '').trim();
      const año = String(row.año || row.ano || '').trim();

      if (!patente || !marca || !modelo) {
        errors.push(`Fila ${index + 1}: Faltan campos obligatorios (patente, marca, modelo)`);
        return;
      }

      validRows.push({
        patente,
        marca,
        modelo,
        año: año || '',
        activo: true
      });
    });

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    return validRows;
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      setError('No hay datos válidos para importar');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Importar la lógica de Firebase
      const { db } = await import('../../../firebaseconfig.js');
      const { collection, addDoc, serverTimestamp, query, where, getDocs } = await import('firebase/firestore');
      const { getTenantCollectionPath } = await import('../../../utils/tenantUtils');

      if (!finalCompanyId) {
        setError('No tienes empresa asociada. No se pueden agregar vehículos.');
        return;
      }

      const vehiculosPath = getTenantCollectionPath('vehiculos');
      
      // Validar duplicados antes de importar
      const patentes = previewData.map(v => v.patente.trim());
      const existingVehiculos = [];
      
      for (const patente of patentes) {
        const q = query(
          collection(db, vehiculosPath),
          where('patente', '==', patente),
          where('companyId', '==', finalCompanyId)
        );
        const querySnapshot = await getDocs(q);
        
        // Filtrar también por clientId si aplica
        const existingDocs = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(v => {
            const vClientId = v.clientId || null;
            return vClientId === clientId;
          });
        
        if (existingDocs.length > 0) {
          existingVehiculos.push(patente);
        }
      }
      
      if (existingVehiculos.length > 0) {
        setError(`Los siguientes vehículos ya existen en la base de datos y no serán importados: ${existingVehiculos.join(', ')}. Por favor, elimina esas filas e intenta nuevamente.`);
        setLoading(false);
        return;
      }
      
      const batch = [];

      for (const vehiculo of previewData) {
        const vehiculoData = {
          patente: vehiculo.patente.trim(),
          marca: vehiculo.marca.trim(),
          modelo: vehiculo.modelo.trim(),
          año: vehiculo.año.trim() || '',
          activo: true,
          companyId: finalCompanyId,
          clientId: clientId, // null si es empresa principal, ID del cliente si es subempresa
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.push(vehiculoData);
      }

      // Agregar todos los vehículos
      const promises = batch.map(vehiculoData => 
        addDoc(collection(db, vehiculosPath), vehiculoData)
      );

      await Promise.all(promises);
      
      setSuccess(true);
      setShowPreview(false);
      setPreviewData([]);
      setFile(null);
      
      if (onVehiculosAdded) {
        onVehiculosAdded();
      }
    } catch (err) {
      console.error('Error al importar vehículos:', err);
      setError('Error al importar vehículos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        patente: 'ABC123',
        marca: 'Toyota',
        modelo: 'Corolla',
        año: '2020'
      },
      {
        patente: 'XYZ789',
        marca: 'Ford',
        modelo: 'Focus',
        año: '2019'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vehículos');
    
    // Proteger columnas no utilizadas
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let col = range.e.c + 1; col < 10; col++) {
      for (let row = range.s.r; row <= range.e.r; row++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) {
          worksheet[cellAddress] = { v: '', t: 's' };
        }
      }
    }

    XLSX.writeFile(workbook, 'plantilla_vehiculos.xlsx');
  };

  const handleAddRow = () => {
    setWebFormData([...webFormData, {
      patente: '',
      marca: '',
      modelo: '',
      año: ''
    }]);
  };

  const handleRemoveWebRow = (index) => {
    if (webFormData.length > 1) {
      setWebFormData(webFormData.filter((_, i) => i !== index));
    }
  };

  const handleWebFormChange = (index, field, value) => {
    const newData = [...webFormData];
    newData[index][field] = value;
    setWebFormData(newData);
  };

  const handleWebFormSubmit = async () => {
    const validData = webFormData.filter(row => 
      row.patente.trim() && row.marca.trim() && row.modelo.trim()
    );

    if (validData.length === 0) {
      setError('Por favor completa al menos una fila con datos válidos');
      setFieldErrors(webFormData.map((row, idx) => ({
        index: idx,
        patente: !row.patente.trim(),
        marca: !row.marca.trim(),
        modelo: !row.modelo.trim(),
      })));
      return;
    }

    // Duplicados dentro del mismo lote (normalizados)
    const normalizedPatentes = validData.map(v => normalizePatente(v.patente));
    const seen = new Set();
    const dupBatch = new Set();
    normalizedPatentes.forEach(p => { if (seen.has(p)) dupBatch.add(p); else seen.add(p); });
    if (dupBatch.size > 0) {
      setError(`Patentes duplicadas en el formulario: ${[...dupBatch].join(', ')}`);
      setFieldErrors(webFormData.map((row, idx) => ({
        index: idx,
        patente: dupBatch.has(normalizePatente(row.patente)),
        marca: false,
        modelo: false,
      })));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Importar la lógica de Firebase
      const { db } = await import('../../../firebaseconfig.js');
      const { collection, addDoc, serverTimestamp, query, where, getDocs } = await import('firebase/firestore');
      const { getTenantCollectionPath } = await import('../../../utils/tenantUtils');

      if (!finalCompanyId) {
        setError('No tienes empresa asociada. No se pueden agregar vehículos.');
        return;
      }

      const vehiculosPath = getTenantCollectionPath('vehiculos');
      
      // Verificar duplicados en Firebase (normalizadas, considerando clientId)
      const patentes = validData.map(row => normalizePatente(row.patente));
      const existingVehiculos = [];
      
      for (const patente of patentes) {
        const q = query(
          collection(db, vehiculosPath),
          where('patente', '==', patente),
          where('companyId', '==', finalCompanyId)
        );
        const querySnapshot = await getDocs(q);
        
        // Filtrar también por clientId si aplica
        const existingDocs = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(v => {
            const vClientId = v.clientId || null;
            return vClientId === clientId;
          });
        
        if (existingDocs.length > 0) {
          existingVehiculos.push(patente);
        }
      }
      
      if (existingVehiculos.length > 0) {
        setError(`Los siguientes vehículos ya existen: ${existingVehiculos.join(', ')}`);
        const existSet = new Set(existingVehiculos);
        setFieldErrors(webFormData.map((row, idx) => ({
          index: idx,
          patente: existSet.has(normalizePatente(row.patente)),
          marca: false,
          modelo: false,
        })));
        return;
      }

      const batch = [];

      for (const vehiculo of validData) {
        const vehiculoData = {
          patente: normalizePatente(vehiculo.patente),
          marca: vehiculo.marca.trim(),
          modelo: vehiculo.modelo.trim(),
          año: vehiculo.año?.trim() || '',
          activo: true,
          companyId: finalCompanyId,
          clientId: clientId, // null si es empresa principal, ID del cliente si es subempresa
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.push(vehiculoData);
      }

      // Agregar todos los vehículos
      const promises = batch.map(vehiculoData => 
        addDoc(collection(db, vehiculosPath), vehiculoData)
      );

      await Promise.all(promises);
      
      setSuccess(true);
      setShowWebModal(false);
      setWebFormData([{ patente: '', marca: '', modelo: '', año: '' }]);
      setFieldErrors([]);
      
      if (onVehiculosAdded) {
        onVehiculosAdded();
      }
    } catch (err) {
      setError('Error al agregar vehículos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const parsePastedData = (data) => {
    if (!data.trim()) return [];

    console.log('Parseando datos:', data);

    // Detectar si es formato separado por comas (una sola línea)
    if (data.includes(',') && !data.includes('\n') && !data.includes('\t')) {
      console.log('Formato detectado: comas en una línea');
      const values = data.split(',').map(v => v.trim());
      const rows = [];
      
      // Agrupar de 4 en 4 (patente, marca, modelo, año)
      for (let i = 0; i < values.length; i += 4) {
        if (i + 2 < values.length) { // Al menos 3 campos (patente, marca, modelo)
          rows.push({
            patente: values[i] || '',
            marca: values[i + 1] || '',
            modelo: values[i + 2] || '',
            año: values[i + 3] || ''
          });
        }
      }
      console.log('Filas generadas desde comas:', rows);
      return rows;
    }

    // Detectar si es formato separado por tabs o espacios múltiples
    const lines = data.split('\n').filter(line => line.trim());
    const rows = [];

    console.log('Líneas detectadas:', lines);

    lines.forEach((line, index) => {
      console.log(`Procesando línea ${index + 1}:`, line);
      
      // Intentar separar por tab primero
      let parts = line.split('\t');
      console.log('Partes por tab:', parts);
      
      // Si no hay tabs, intentar por espacios múltiples
      if (parts.length < 3) {
        parts = line.split(/\s{2,}/);
        console.log('Partes por espacios múltiples:', parts);
      }
      
      // Si aún no funciona, intentar por espacios simples
      if (parts.length < 3) {
        parts = line.split(/\s+/);
        console.log('Partes por espacios simples:', parts);
      }

      if (parts.length >= 3) {
        const row = {
          patente: parts[0].trim(),
          marca: parts[1].trim(),
          modelo: parts[2].trim(),
          año: parts[3] ? parts[3].trim() : ''
        };
        console.log('Fila creada:', row);
        rows.push(row);
      } else {
        console.log('Línea ignorada por falta de campos:', line);
      }
    });

    console.log('Total de filas parseadas:', rows);
    return rows;
  };

  const handlePasteData = () => {
    if (!pasteData.trim()) {
      setError('Por favor pega los datos primero');
      return;
    }

    console.log('Datos pegados:', pasteData);
    const parsedData = parsePastedData(pasteData);
    console.log('Datos parseados:', parsedData);
    
    if (parsedData.length === 0) {
      setError('No se pudieron detectar datos válidos. Asegúrate de que cada fila tenga al menos patente, marca y modelo.');
      return;
    }

    // Filtrar solo las filas con datos válidos
    const validData = parsedData.filter(row => 
      row.patente.trim() && row.marca.trim() && row.modelo.trim()
    );

    console.log('Datos válidos:', validData);

    if (validData.length === 0) {
      setError('No se encontraron datos válidos. Verifica que cada fila tenga patente, marca y modelo.');
      return;
    }

    setWebFormData(validData);
    setPasteData('');
    setShowPasteArea(false);
    setShowWebModal(true);
    setError('');
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Importación masiva de vehículos:</strong><br/>
          • Sube un archivo Excel (.xlsx) con las columnas: patente, marca, modelo, año<br/>
          • El campo "año" es opcional<br/>
          • Las filas vacías serán ignoradas automáticamente
        </Typography>
      </Alert>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Subir archivo Excel
            </Typography>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                fullWidth
              >
                Seleccionar archivo Excel
              </Button>
            </label>
            {file && (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                Archivo seleccionado: {file.name}
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Plantilla y entrada manual
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadTemplate}
                fullWidth
              >
                Descargar plantilla
              </Button>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setShowWebModal(true)}
                fullWidth
              >
                Agregar en web
              </Button>
            </Stack>
            <Button
              variant="outlined"
              onClick={() => setShowPasteArea(!showPasteArea)}
              fullWidth
              sx={{ mt: 1 }}
            >
              {showPasteArea ? 'Ocultar' : 'Pegar desde Excel'}
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Área para pegar datos desde Excel */}
      {showPasteArea && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Pegar datos desde Excel
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Copia y pega los datos desde Excel. El sistema detectará automáticamente el formato:
            <br/>• <strong>Formato con tabs:</strong> ABC123	Toyota	Corolla	2020
            <br/>• <strong>Formato con comas:</strong> ABC123,Toyota,Corolla,2020,XYZ789,Ford,Focus,2019
          </Typography>
          <TextField
            multiline
            rows={6}
            fullWidth
            placeholder="Pega aquí los datos copiados desde Excel..."
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={handlePasteData}
              disabled={!pasteData.trim()}
            >
              Procesar datos
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setPasteData('');
                setShowPasteArea(false);
              }}
            >
              Cancelar
            </Button>
          </Stack>
        </Paper>
      )}

      {showPreview && (
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Vista previa ({previewData.length} vehículos)
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><b>Patente</b></TableCell>
                  <TableCell><b>Marca</b></TableCell>
                  <TableCell><b>Modelo</b></TableCell>
                  <TableCell><b>Año</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewData.slice(0, 10).map((vehiculo, index) => (
                  <TableRow key={index}>
                    <TableCell>{vehiculo.patente}</TableCell>
                    <TableCell>{vehiculo.marca}</TableCell>
                    <TableCell>{vehiculo.modelo}</TableCell>
                    <TableCell>{vehiculo.año}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {previewData.length > 10 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              ... y {previewData.length - 10} vehículos más
            </Typography>
          )}
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Importando...' : 'Importar vehículos'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setShowPreview(false);
                setPreviewData([]);
                setFile(null);
              }}
            >
              Cancelar
            </Button>
          </Box>
        </Paper>
      )}

      {/* Modal para entrada manual */}
      <Dialog
        open={showWebModal}
        onClose={() => setShowWebModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Agregar vehículos manualmente</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Completa los datos de los vehículos. Los campos marcados con * son obligatorios.
          </Typography>
          {webFormData.map((row, index) => (
            <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Vehículo {index + 1}</Typography>
                {webFormData.length > 1 && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleRemoveWebRow(index)}
                  >
                    Eliminar
                  </Button>
                )}
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Patente *"
                    value={row.patente}
                    onChange={(e) => handleWebFormChange(index, 'patente', e.target.value)}
                    fullWidth
                    size="small"
                    error={!!fieldErrors[index]?.patente}
                    helperText={fieldErrors[index]?.patente ? 'Duplicada o requerida' : ''}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Marca *"
                    value={row.marca}
                    onChange={(e) => handleWebFormChange(index, 'marca', e.target.value)}
                    fullWidth
                    size="small"
                    error={!!fieldErrors[index]?.marca}
                    helperText={fieldErrors[index]?.marca ? 'Requerida' : ''}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Modelo *"
                    value={row.modelo}
                    onChange={(e) => handleWebFormChange(index, 'modelo', e.target.value)}
                    fullWidth
                    size="small"
                    error={!!fieldErrors[index]?.modelo}
                    helperText={fieldErrors[index]?.modelo ? 'Requerido' : ''}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Año"
                    value={row.año}
                    onChange={(e) => handleWebFormChange(index, 'año', e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>
            </Box>
          ))}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddRow}
            sx={{ mb: 2 }}
          >
            Agregar otro vehículo
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWebModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleWebFormSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Agregando...' : 'Agregar vehículos'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={() => setSuccess(false)}
        message="Vehículos agregados exitosamente"
      />

      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError('')}
        message={error}
      />
    </Box>
  );
};

export default VehiculosImportForm;
