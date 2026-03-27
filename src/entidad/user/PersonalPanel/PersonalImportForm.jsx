import React, { useState, useContext } from "react";
import { db } from "../../../config/firebaseconfig";
import { collection, addDoc, serverTimestamp, writeBatch, doc, query, where, getDocs } from "firebase/firestore";
import { cleanFirestoreData } from "../../../utils/cleanFirestoreData";
import { getTenantCollectionPath } from '../../../utils/tenantUtils';
import { AuthContext } from '../../../context/AuthContext';

import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  Snackbar,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Stack
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  Add as AddIcon
} from "@mui/icons-material";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const PersonalImportForm = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]); // errores por fila para el modal web
  const [csvData, setCsvData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importedCount, setImportedCount] = useState(0);
  const [showWebModal, setShowWebModal] = useState(false);
  const [webFormData, setWebFormData] = useState([{ nombre: '', apellido: '', dni: '', telefono: '' }]);
  const [pasteData, setPasteData] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [nonStandardDniList, setNonStandardDniList] = useState([]);

  // Obtener información de la empresa desde contexto y localStorage
  const { activeCompanyId, mainCompanyId } = useContext(AuthContext);
  const userCompanyData = JSON.parse(localStorage.getItem('userCompany') || '{}');
  // Siempre usar mainCompanyId como companyId
  const finalCompanyId = mainCompanyId || userCompanyData?.companyId;
  // Determinar clientId: si activeCompanyId !== mainCompanyId, entonces es un cliente
  const clientId = (activeCompanyId && activeCompanyId !== mainCompanyId) ? activeCompanyId : null;

  // Helpers de normalización
  const normalizeDniInput = (value) => String(value || '').replace(/[^0-9.,]/g, '');
  const normalizeDniStore = (value) => String(value || '').replace(/\D/g, '');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Verificar que sea un archivo CSV o Excel
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const isValidFile = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) || 
                       file.type === 'text/csv' || 
                       file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                       file.type === 'application/vnd.ms-excel';
    
    if (!isValidFile) {
      setError("Por favor sube un archivo CSV o Excel (.xlsx, .xls) válido");
      return;
    }

    // Determinar el tipo de archivo y procesarlo
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    
    if (isExcel) {
      // Procesar archivo Excel
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Convertir a formato CSV para usar la misma lógica de validación
          const headers = jsonData[0];
          const rows = jsonData.slice(1);
          const csvData = rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              // Convertir a string y limpiar
              const value = row[index];
              obj[header] = value !== null && value !== undefined ? String(value) : '';
            });
            return obj;
          });
          
          console.log("Excel Parsed:", csvData);
          
          // Validar los datos
          const { data: validatedData, errors } = validateCsvData(csvData);
          setCsvData(validatedData);
          setValidationErrors(errors);
          
          if (errors.length > 0) {
            setError(`Se encontraron ${errors.length} errores en el archivo. Revisa la tabla de validación.`);
          } else if (validatedData.length === 0) {
            setError("El archivo no contiene datos válidos.");
          } else {
            setError("");
          }
        } catch (error) {
          console.error("Error parsing Excel:", error);
          setError("Error al procesar el archivo Excel");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Procesar archivo CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          console.log("CSV Parsed:", results);
          
          // Validar los datos
          const { data, errors } = validateCsvData(results.data);
          setCsvData(data);
          setValidationErrors(errors);
          
          if (errors.length > 0) {
            setError(`Se encontraron ${errors.length} errores en el archivo. Revisa la tabla de validación.`);
          } else if (data.length === 0) {
            setError("El archivo no contiene datos válidos.");
          } else {
            setError("");
          }
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
          setError("Error al procesar el archivo CSV. Verifica el formato.");
        }
      });
    }
    
    // Resetear el input de archivo
    e.target.value = null;
  };

  // Validar los datos del CSV
  const validateCsvData = (data) => {
    const validData = [];
    const errors = [];

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 porque la fila 1 es el encabezado
      
      // Filtrar filas completamente vacías
      const hasAnyData = Object.values(row).some(value => 
        value !== null && value !== undefined && String(value).trim() !== ''
      );
      
      if (!hasAnyData) {
        return; // Saltar filas completamente vacías
      }
      
      const validationResult = validatePersonalRow(row, rowNumber);
      
      if (validationResult.valid) {
        validData.push(validationResult.data);
      } else {
        errors.push(validationResult.error);
      }
    });

    return { data: validData, errors };
  };

  // Validar una fila de datos de personal
  const validatePersonalRow = (row, rowNumber) => {
    const requiredFields = ['nombre', 'apellido', 'dni'];
    const missingFields = [];
    
    // Verificar campos requeridos
    requiredFields.forEach(field => {
      const value = row[field];
      if (!value || (typeof value === 'string' && value.trim() === '') || value === null || value === undefined) {
        missingFields.push(field);
      }
    });
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        error: {
          row: rowNumber,
          message: `Campos requeridos faltantes: ${missingFields.join(', ')}`,
          data: row
        }
      };
    }
    
    // Limpiar DNI pero permitir cualquier formato
    const dniStr = String(row.dni || '').replace(/[^0-9]/g, '');
    // No validar longitud del DNI - permitir cualquier formato
    
    // Datos válidos
    return {
      valid: true,
      data: {
        nombre: String(row.nombre || '').trim(),
        apellido: String(row.apellido || '').trim(),
        dni: dniStr,
        telefono: String(row.telefono || '').trim() || null,
        companyId: finalCompanyId,
        clientId: clientId, // null si es empresa principal, ID del cliente si es subempresa
        activo: true,
        createdAt: serverTimestamp(),
        importedAt: serverTimestamp()
      }
    };
  };

  const handleImport = async () => {
    if (!finalCompanyId) {
      setError("No se encontró información de la empresa.");
      return;
    }
    
    if (csvData.length === 0) {
      setError("No hay datos válidos para importar.");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const personalCollectionPath = getTenantCollectionPath('personal');
      
      // Validar duplicados antes de importar
      const dnis = csvData.map(row => row.dni);
      const existingPersonal = [];
      
      for (const dni of dnis) {
        const q = query(
          collection(db, personalCollectionPath),
          where('dni', '==', dni),
          where('companyId', '==', finalCompanyId)
        );
        const querySnapshot = await getDocs(q);
        
        // Filtrar también por clientId si aplica
        const existingDocs = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => {
            const pClientId = p.clientId || null;
            return pClientId === clientId;
          });
        
        if (existingDocs.length > 0) {
          existingPersonal.push(dni);
        }
      }
      
      if (existingPersonal.length > 0) {
        setError(`Los siguientes DNI ya existen en la base de datos y no serán importados: ${existingPersonal.join(', ')}. Por favor, elimina esas filas e intenta nuevamente.`);
        setLoading(false);
        return;
      }
      
      // Usar batch para importar múltiples registros
      const batch = writeBatch(db);
      let count = 0;
      
      // Firebase permite hasta 500 operaciones por batch
      for (let i = 0; i < csvData.length; i++) {
        if (count >= 500) break; // Limitamos a 500 por seguridad
        
        const personalData = csvData[i];
        const newPersonalRef = doc(collection(db, personalCollectionPath));
        batch.set(newPersonalRef, cleanFirestoreData(personalData));
        count++;
      }
      
      await batch.commit();
      
      setImportedCount(count);
      setCsvData([]);
      setValidationErrors([]);
      setSuccess(true);
    } catch (err) {
      console.error("Error al importar personal:", err);
      setError("Error al importar el personal. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRow = (index) => {
    const newData = [...csvData];
    newData.splice(index, 1);
    setCsvData(newData);
  };

  const handleDownloadTemplate = () => {
    // Crear datos de ejemplo para la plantilla
    const templateData = [
      { nombre: 'Juan', apellido: 'Pérez', dni: '12345678', telefono: '0987654321' },
      { nombre: 'María', apellido: 'García', dni: '87654321', telefono: '0912345678' },
      { nombre: '', apellido: '', dni: '', telefono: '' } // Fila vacía para que el usuario complete
    ];

    // Crear workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 15 }, // nombre
      { wch: 15 }, // apellido  
      { wch: 12 }, // dni
      { wch: 15 }  // telefono
    ];

    // Proteger columnas no utilizadas (opcional)
    ws['!protect'] = {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: true,
      formatColumns: true,
      formatRows: true,
      insertRows: true,
      insertColumns: false,
      insertHyperlinks: true,
      deleteRows: true,
      deleteColumns: false,
      sort: true,
      autoFilter: true,
      pivotTables: true,
      objects: true,
      scenarios: true
    };

    XLSX.utils.book_append_sheet(wb, ws, 'Personal');
    
    // Descargar archivo
    XLSX.writeFile(wb, 'plantilla_personal.xlsx');
  };

  const handleCloseSnackbar = () => {
    setSuccess(false);
  };

  const handleAddRow = () => {
    setWebFormData([...webFormData, { nombre: '', apellido: '', dni: '', telefono: '' }]);
  };

  const handleRemoveWebRow = (index) => {
    if (webFormData.length > 1) {
      const newData = webFormData.filter((_, i) => i !== index);
      setWebFormData(newData);
    }
  };

  const handleWebFormChange = (index, field, value) => {
    const newData = [...webFormData];
    newData[index][field] = field === 'dni' ? normalizeDniInput(value) : value;
    setWebFormData(newData);
  };

  const handleWebFormSubmit = async () => {
    // Filtrar filas vacías y validar
    const validData = webFormData.filter(row => 
      row.nombre.trim() && row.apellido.trim() && row.dni.trim()
    );

    if (validData.length === 0) {
      setError("Debe agregar al menos una persona válida");
      // Construir errores por fila
      const errs = webFormData.map((row, idx) => ({
        index: idx,
        nombre: !row.nombre.trim(),
        apellido: !row.apellido.trim(),
        dni: !row.dni.trim(),
      }));
      setFieldErrors(errs);
      return;
    }

    // Validar DNI (permitir cualquier formato, pero marcar los no estándar)
    const dniRegex = /^[0-9]{7,8}$/;
    const nonStandardDni = validData.filter(row => !dniRegex.test(row.dni.trim()));
    
    if (nonStandardDni.length > 0) {
      console.warn(`${nonStandardDni.length} DNI(s) no siguen el formato estándar (7-8 dígitos):`, nonStandardDni.map(row => row.dni));
      setNonStandardDniList(nonStandardDni.map(row => row.dni));
    } else {
      setNonStandardDniList([]);
    }

    // Verificar duplicados en la lista actual
    const existingDnis = csvData.map(row => row.dni);
    const duplicateDnis = validData.filter(row => existingDnis.includes(row.dni));
    
    if (duplicateDnis.length > 0) {
      const duplicateSet = new Set(duplicateDnis.map(r => r.dni));
      setError(`Los siguientes DNI ya están en la lista: ${[...duplicateSet].join(', ')}`);
      // marcar en los campos correspondientes
      setFieldErrors(webFormData.map((row, idx) => ({
        index: idx,
        nombre: false,
        apellido: false,
        dni: duplicateSet.has(row.dni),
      })));
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Obtener información del usuario actual
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('No hay usuario autenticado');
        return;
      }

      if (!finalCompanyId) {
        setError('No tienes empresa asociada. No se pueden agregar empleados.');
        return;
      }

      const personalPath = getTenantCollectionPath('personal');
      
      // Verificar duplicados en Firebase (considerando clientId)
      const dnis = validData.map(row => row.dni.trim());
      const existingPersonal = [];
      
      for (const dni of dnis) {
        const q = query(
          collection(db, personalPath),
          where('dni', '==', dni),
          where('companyId', '==', finalCompanyId)
        );
        const querySnapshot = await getDocs(q);
        
        // Filtrar también por clientId si aplica
        const existingDocs = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => {
            const pClientId = p.clientId || null;
            return pClientId === clientId;
          });
        
        if (existingDocs.length > 0) {
          existingPersonal.push(dni);
        }
      }
      
      if (existingPersonal.length > 0) {
        setError(`Los siguientes DNI ya existen en la base de datos: ${existingPersonal.join(', ')}`);
        const existingSet = new Set(existingPersonal);
        setFieldErrors(webFormData.map((row, idx) => ({
          index: idx,
          nombre: false,
          apellido: false,
          dni: existingSet.has(row.dni),
        })));
        return;
      }

      const batch = [];

      for (const persona of validData) {
        const personaData = {
          nombre: persona.nombre.trim(),
          apellido: persona.apellido.trim(),
          dni: normalizeDniStore(persona.dni),
          telefono: persona.telefono?.trim() || '',
          activo: true,
          companyId: finalCompanyId,
          clientId: clientId, // null si es empresa principal, ID del cliente si es subempresa
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.push(personaData);
      }

      // Chequear duplicados por Nombre+Apellido con DNI distinto en base
      const conflicts = [];
      for (const persona of validData) {
        const q = query(
          collection(db, personalPath),
          where('nombre', '==', persona.nombre.trim()),
          where('apellido', '==', persona.apellido.trim()),
          where('companyId', '==', finalCompanyId)
        );
        const snap = await getDocs(q);
        const dniDigits = normalizeDniStore(persona.dni);
        
        // Filtrar también por clientId si aplica
        const matchingDocs = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(p => {
            const pClientId = p.clientId || null;
            return pClientId === clientId;
          });
        
        if (matchingDocs.length > 0) {
          const mismatch = matchingDocs.some(p => (p.dni || '') !== dniDigits);
          if (mismatch) conflicts.push(`${persona.nombre} ${persona.apellido}`);
        }
      }
      if (conflicts.length > 0) {
        const proceed = window.confirm(`Ya existen personas con el mismo Nombre y Apellido pero DNI distinto: ${conflicts.join(', ')}. ¿Agregar igualmente?`);
        if (!proceed) {
          setLoading(false);
          return;
        }
      }

      // Agregar todos los empleados
      const promises = batch.map(personaData => 
        addDoc(collection(db, personalPath), personaData)
      );

      await Promise.all(promises);
      
      setSuccess(true);
      setShowWebModal(false);
      setWebFormData([{ nombre: '', apellido: '', dni: '', telefono: '' }]);
      setNonStandardDniList([]);
      setFieldErrors([]);
      
      // Refrescar la lista de personal
      if (typeof onPersonalAdded === 'function') {
        onPersonalAdded();
      }
    } catch (err) {
      console.error('Error al agregar empleados:', err);
      setError('Error al agregar empleados: ' + err.message);
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
      
      // Agrupar de 4 en 4 (nombre, apellido, dni, telefono)
      for (let i = 0; i < values.length; i += 4) {
        if (i + 2 < values.length) { // Al menos 3 campos (nombre, apellido, dni)
          rows.push({
            nombre: values[i] || '',
            apellido: values[i + 1] || '',
            dni: normalizeDniInput(values[i + 2] || ''),
            telefono: values[i + 3] || ''
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
          nombre: parts[0].trim(),
          apellido: parts[1].trim(),
          dni: normalizeDniInput(parts[2].trim()),
          telefono: parts[3] ? parts[3].trim() : ''
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
      setError('No se pudieron detectar datos válidos. Asegúrate de que cada fila tenga al menos nombre, apellido y DNI.');
      return;
    }

    // Filtrar solo las filas con datos válidos
    const validData = parsedData.filter(row => 
      row.nombre.trim() && row.apellido.trim() && row.dni.trim()
    );

    console.log('Datos válidos:', validData);

    if (validData.length === 0) {
      setError('No se encontraron datos válidos. Verifica que cada fila tenga nombre, apellido y DNI.');
      return;
    }

    setWebFormData(validData);
    setPasteData('');
    setShowPasteArea(false);
    setShowWebModal(true);
    setError('');
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Importación Masiva de Personal
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Importación masiva de personal:</strong><br/>
            • DNI: se permiten solo dígitos y separadores . , (otros caracteres serán removidos automáticamente).<br/>
            • Recomendamos cargar datos reales para futuras funciones automáticas de ControlDoc.
          </Typography>
        </Alert>
        
        <Button
          variant="contained"
          component="label"
          startIcon={<CloudUploadIcon />}
          disabled={loading}
          sx={{ mr: 2 }}
        >
          Seleccionar Archivo Excel/CSV
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            hidden
            onChange={handleFileUpload}
          />
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadTemplate}
          sx={{ mr: 2 }}
        >
          Descargar Plantilla
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setShowWebModal(true)}
          sx={{ mr: 2 }}
        >
          Agregar en la Web
        </Button>
        
        <Button
          variant="outlined"
          onClick={() => setShowPasteArea(!showPasteArea)}
          sx={{ mr: 2 }}
        >
          {showPasteArea ? 'Ocultar' : 'Pegar desde Excel'}
        </Button>
        
        {csvData.length > 0 && (
          <Typography variant="body2" component="span">
            {csvData.length} registros válidos listos para importar
          </Typography>
        )}
      </Box>

      {/* Área para pegar datos desde Excel */}
      {showPasteArea && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Pegar datos desde Excel
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Copia y pega los datos desde Excel. El sistema detectará automáticamente el formato:
            <br/>• <strong>Formato con tabs:</strong> Juan	Pérez	12345678	123456789
            <br/>• <strong>Formato con comas:</strong> Juan,Pérez,12345678,123456789,María,García,87654321,987654321
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
      
      {validationErrors.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" color="error" gutterBottom>
            Errores de validación:
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fila</TableCell>
                  <TableCell>Error</TableCell>
                  <TableCell>Datos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {validationErrors.map((error, index) => (
                  <TableRow key={index}>
                    <TableCell>{error.row}</TableCell>
                    <TableCell>{error.message}</TableCell>
                    <TableCell>
                      {Object.entries(error.data)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
      
      {csvData.length > 0 && (
        <>
          <Typography variant="subtitle1" gutterBottom>
            Vista previa de datos a importar:
          </Typography>
          {nonStandardDniList.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Advertencia:</strong> {nonStandardDniList.length} DNI(s) no siguen el formato estándar (7-8 dígitos): {nonStandardDniList.join(', ')}
                <br/>Estos DNI se importarán normalmente, pero se recomienda verificar su formato.
              </Typography>
            </Alert>
          )}
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Apellido</TableCell>
                  <TableCell>DNI</TableCell>
                  <TableCell>Teléfono</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {csvData.slice(0, 10).map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.nombre}</TableCell>
                    <TableCell>{row.apellido}</TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: nonStandardDniList.includes(row.dni) ? '#ff9800' : 'inherit',
                          fontWeight: nonStandardDniList.includes(row.dni) ? 'bold' : 'normal'
                        }}
                      >
                        {row.dni}
                        {nonStandardDniList.includes(row.dni) && (
                          <Typography variant="caption" sx={{ ml: 1, color: '#ff9800' }}>
                            (formato no estándar)
                          </Typography>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.telefono || '-'}</TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        onClick={() => handleRemoveRow(index)}
                        disabled={loading}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {csvData.length > 10 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="textSecondary">
                        ... y {csvData.length - 10} registros más
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleImport}
            disabled={loading || csvData.length === 0}
            startIcon={loading ? <CircularProgress size={24} /> : <CloudUploadIcon />}
          >
            {loading ? "Importando..." : "Importar Personal"}
          </Button>
        </>
      )}
      
      <Snackbar
        open={success}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success">
          {importedCount} registros importados exitosamente
        </Alert>
      </Snackbar>

      {/* Modal para agregar datos en la web */}
      <Dialog 
        open={showWebModal} 
        onClose={() => setShowWebModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Agregar Personal en la Web</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Complete los datos de las personas que desea agregar. Puede agregar múltiples filas.
          </Typography>
          
          {webFormData.map((row, index) => (
            <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Nombre *"
                    value={row.nombre}
                    onChange={(e) => handleWebFormChange(index, 'nombre', e.target.value)}
                    size="small"
                    error={!!fieldErrors[index]?.nombre}
                    helperText={fieldErrors[index]?.nombre ? 'Requerido' : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Apellido *"
                    value={row.apellido}
                    onChange={(e) => handleWebFormChange(index, 'apellido', e.target.value)}
                    size="small"
                    error={!!fieldErrors[index]?.apellido}
                    helperText={fieldErrors[index]?.apellido ? 'Requerido' : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="DNI *"
                    value={row.dni}
                    onChange={(e) => handleWebFormChange(index, 'dni', e.target.value)}
                    size="small"
                    error={!!fieldErrors[index]?.dni}
                    helperText={fieldErrors[index]?.dni ? 'Duplicado o requerido' : ''}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Teléfono"
                    value={row.telefono}
                    onChange={(e) => handleWebFormChange(index, 'telefono', e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleRemoveWebRow(index)}
                    disabled={webFormData.length === 1}
                    size="small"
                  >
                    Eliminar
                  </Button>
                </Grid>
              </Grid>
            </Box>
          ))}
          
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddRow}
            sx={{ mt: 1 }}
          >
            Agregar Fila
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
            startIcon={loading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
          >
            {loading ? 'Agregando...' : 'Agregar a Lista'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default PersonalImportForm;
