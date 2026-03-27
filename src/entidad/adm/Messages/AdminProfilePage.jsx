// src/entidad/adm/AdminProfilePage.jsx
import React, { useState, useEffect, useRef } from "react"
import { Box, Typography, TextField, Button, Alert, Card, CardContent, Chip, Divider, CircularProgress } from "@mui/material"
import { useAuth } from "../../../context/AuthContext"
import { db } from "../../../firebaseconfig"
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore"
import { getTenantCollectionPath } from '../../../utils/tenantUtils'
// import useControlFileQuery from '../../../hooks/useControlFileQuery'; // SDK deshabilitado temporalmente para debug
// import { getControlFileIdToken } from '../../../utils/ControlFileAuth'; // SDK deshabilitado temporalmente para debug
// import { ControlFileClient } from '@controlfile/sdk' // SDK deshabilitado temporalmente para debug

export default function AdminProfilePage() {
  // SDK deshabilitado temporalmente para debug
  // const { user } = useAuth()
  return <div>SDK deshabilitado temporalmente para debug</div>
  // return <div>SDK deshabilitado temporalmente para debug</div>
  
  const { user } = useAuth()
  const [customEmail, setCustomEmail] = useState("")
  const [savedEmail, setSavedEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // ControlFile integration
  const { 
    status: cfStatus, 
    error: cfError, 
    user: cfUser, 
    connect: cfConnect, 
    disconnect: cfDisconnect,
    openControlFile: cfOpenControlFile,
    appDisplayName 
  } = useControlFileQuery()
  const [cfConnectionSuccess, setCfConnectionSuccess] = useState("")

  // SDK Upload state
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)

  const isPrivileged = ["max", "dhhkvja"].includes(user?.role?.toLowerCase())

  useEffect(() => {
    if (user?.email) {
      setCustomEmail(user.email)
      setSavedEmail(user.email)
    }
  }, [user])

  const handleControlFileConnect = async () => {
    try {
      setCfConnectionSuccess("")
      await cfConnect()
      if (cfStatus === 'connected') {
        setCfConnectionSuccess("Conectado exitosamente a ControlFile")
      }
    } catch (err) {
      console.error("Error conectando a ControlFile:", err)
    }
  }

  const handleControlFileDisconnect = async () => {
    try {
      setCfConnectionSuccess("")
      await cfDisconnect()
      setCfConnectionSuccess("Desconectado de ControlFile")
    } catch (err) {
      console.error("Error desconectando de ControlFile:", err)
    }
  }

  const handleOpenControlFile = () => {
    cfOpenControlFile()
  }

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setUploadFile(selectedFile)
      setUploadError(null)
      setUploadResult(null)
    }
  }

  const handleUploadToControlFile = async () => {
    if (!uploadFile) {
      setUploadError('Por favor selecciona un archivo')
      return
    }

    if (cfStatus !== 'connected') {
      setUploadError('Debes estar conectado a ControlFile primero')
      return
    }

    if (!cfUser?.uid) {
      setUploadError('No se pudo obtener el usuario de ControlFile')
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadResult(null)

    try {
      // SDK deshabilitado temporalmente para debug
      throw new Error("SDK deshabilitado temporalmente para debug")
      
      // Crear cliente SDK
      const client = new ControlFileClient({
        baseUrl: import.meta.env.VITE_CONTROLFILE_BACKEND_URL,
        getAuthToken: getControlFileIdToken,
      })

      // Obtener contexto contractual de aplicación (API v1)
      const appFiles = client.forApp('controldoc', cfUser.uid)

      // Path relativo al app root: ['perfil', userId]
      const path = ['perfil', cfUser.uid]

      // Asegurar que la estructura de carpetas existe (opcional, uploadFile lo hace automáticamente)
      await appFiles.ensurePath({ path })

      // Subir archivo usando API contractual (path relativo al app root)
      const result = await appFiles.uploadFile({
        file: uploadFile,
        path,
      })

      setUploadResult({
        fileId: result.fileId || result.id || 'N/A',
        fileName: result.fileName || uploadFile.name,
        fileSize: result.fileSize || uploadFile.size,
      })
      setUploadFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Error subiendo archivo:', err)
      if (
        err.message?.includes('No conectado') ||
        err.message?.includes('401') ||
        err.message?.includes('autenticación') ||
        err.message?.includes('token')
      ) {
        setUploadError('Error de autenticación: Verifica tu conexión a ControlFile')
      } else if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        setUploadError('Error: No tienes permisos para subir archivos')
      } else if (err.message?.includes('Network') || err.message?.includes('fetch')) {
        setUploadError('Error de red: Verifica tu conexión a internet')
      } else {
        setUploadError(`Error al subir archivo: ${err.message || 'Error desconocido'}`)
      }
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    const handle = customEmail.toLowerCase().trim()

    if (!/^[a-z0-9]+([.-]?[a-z0-9]+)*$/.test(handle)) {
      return setError("Solo letras minúsculas, números, puntos o guiones. No se permite usar '@' ni '.com'.")
    }

    try {
      // Validar que no exista en otra cuenta
      // Usar la ruta multi-tenant correcta
      const usersCollectionPath = getTenantCollectionPath('users');
      const usersRef = collection(db, usersCollectionPath)
      const snapshot = await getDocs(usersRef)
      const exists = snapshot.docs.some(
        (docSnap) => docSnap.data().email === handle && docSnap.id !== user.uid
      )

      if (exists) {
        return setError("Este email personalizado ya está en uso por otro usuario.")
      }

      // Usar la ruta multi-tenant correcta
      await updateDoc(doc(db, usersCollectionPath, user.uid), {
        email: handle,
      })

      setSavedEmail(handle)
      setSuccess("Email personalizado guardado correctamente.")
      setError("")
    } catch (err) {
      console.error("Error al guardar email personalizado:", err)
      setError("Hubo un error al guardar.")
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Configuración de Perfil
      </Typography>

      <Typography variant="subtitle1" gutterBottom>
        Email actual: <strong>{user?.email}@controldoc.app</strong>
      </Typography>

      {/* ControlFile Integration Section */}
      <Card sx={{ mt: 3, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Integración con {appDisplayName}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="body2">
              Estado de conexión:
            </Typography>
            <Chip 
              label={
                cfStatus === 'connected' ? 'Conectado' :
                cfStatus === 'checking' ? 'Verificando...' :
                cfStatus === 'connecting' ? 'Conectando...' :
                cfStatus === 'redirecting' ? 'Redirigiendo...' :
                'Desconectado'
              }
              color={cfStatus === 'connected' ? 'success' : cfStatus === 'checking' ? 'info' : 'default'}
              size="small"
            />
          </Box>

          {cfUser && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Cuenta conectada: <strong>{cfUser.email}</strong>
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            {cfStatus !== 'connected' && (
              <Button 
                variant="outlined" 
                onClick={handleControlFileConnect}
                disabled={cfStatus === 'checking' || cfStatus === 'connecting' || cfStatus === 'redirecting'}
              >
                {cfStatus === 'checking' ? 'Verificando...' :
                 cfStatus === 'connecting' ? 'Conectando...' :
                 cfStatus === 'redirecting' ? 'Redirigiendo...' :
                 `Conectar con ${appDisplayName}`}
              </Button>
            )}

            {cfStatus === 'connected' && (
              <>
                <Button 
                  variant="contained" 
                  onClick={handleOpenControlFile}
                  color="primary"
                >
                  Ir a {appDisplayName}
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={handleControlFileDisconnect}
                  color="secondary"
                >
                  Desconectar
                </Button>
              </>
            )}
          </Box>

          {cfError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Error: {cfError.message}
            </Alert>
          )}

          {cfConnectionSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {cfConnectionSuccess}
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary">
            Conecta tu cuenta para poder guardar documentos directamente en {appDisplayName} desde ControlDoc.
          </Typography>

          {/* Sección de subida con SDK */}
          {cfStatus === 'connected' && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Subir archivo a {appDisplayName} (SDK)
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="controlfile-upload-input"
                />
                <label htmlFor="controlfile-upload-input">
                  <Button
                    variant="outlined"
                    component="span"
                    disabled={uploading}
                    sx={{ mb: 1 }}
                  >
                    Seleccionar archivo
                  </Button>
                </label>
                
                {uploadFile && (
                  <Typography variant="body2" color="text.secondary">
                    Archivo seleccionado: <strong>{uploadFile.name}</strong> ({(uploadFile.size / 1024).toFixed(2)} KB)
                  </Typography>
                )}

                <Button
                  variant="contained"
                  onClick={handleUploadToControlFile}
                  disabled={!uploadFile || uploading}
                  startIcon={uploading ? <CircularProgress size={16} /> : null}
                >
                  {uploading ? 'Subiendo...' : 'Subir a ControlFile (SDK)'}
                </Button>

                {uploadError && (
                  <Alert severity="error">
                    {uploadError}
                  </Alert>
                )}

                {uploadResult && (
                  <Alert severity="success">
                    <Typography variant="body2" component="div">
                      <strong>Archivo subido exitosamente</strong>
                      <br />
                      File ID: {uploadResult.fileId}
                      <br />
                      File Name: {uploadResult.fileName}
                      <br />
                      File Size: {uploadResult.fileSize} bytes
                    </Typography>
                  </Alert>
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      {isPrivileged ? (
        <>
          <TextField
            label="Email personalizado (sin @controldoc.app)"
            value={customEmail}
            onChange={(e) => {
              const value = e.target.value
                .toLowerCase()
                .replace(/[@\s]/g, "")   // elimina @ y espacios
                .replace(/\.com/g, "")   // elimina ".com"
                .slice(0, 30)              // máx 30 caracteres
              setCustomEmail(value)
            }}
            fullWidth
            sx={{ mt: 2 }}
          />
          <Typography variant="caption" color="text.secondary">
            Tu email será: <strong>{customEmail || "..." }@controldoc.app</strong>
          </Typography>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}

          <Button variant="contained" onClick={handleSave} sx={{ mt: 3 }}>
            Guardar Cambios
          </Button>
        </>
      ) : (
        <>
          <Typography variant="body1" sx={{ mt: 2 }}>
            Tu email asignado es: <strong>{user?.companyName?.toLowerCase().replaceAll(" ", "-") || "empresa"}@controldoc.app</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Sólo los administradores pueden personalizar su email interno.
          </Typography>
        </>
      )}
    </Box>
  )
}
