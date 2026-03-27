"use client"

// React import removed - using JSX runtime
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box,
} from "@mui/material"
import { useEffect, useState, useRef } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "../../../firebaseconfig"
import { useAppConfig } from "../../../context/AppConfigContext"
import { getTenantCollectionPath } from '../../../utils/tenantUtils'
import { uploadFile } from "../../../utils/FileUploadService"
import CloudUploadIcon from "@mui/icons-material/CloudUpload"

export default function LogoDialog({ open, onClose }) {
  const [logos, setLogos] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const { setAppLogo } = useAppConfig()

  const fetchLogos = () => {
    try {
      // Usar la ruta multi-tenant correcta
      const adminFoldersPath = getTenantCollectionPath('adminFolders');
      const logosRef = collection(db, `${adminFoldersPath}/logos/files`)
      
      console.log('LogoDialog - Escuchando cambios en:', `${adminFoldersPath}/logos/files`)
      
      const unsubscribe = onSnapshot(logosRef, (snapshot) => {
        console.log('LogoDialog - Snapshot recibido:', snapshot.size, 'logos')
        const loadedLogos = snapshot.docs.map((doc) => {
          console.log('LogoDialog - Logo encontrado:', doc.id, doc.data())
          return { id: doc.id, ...doc.data() }
        })
        setLogos(loadedLogos)
      }, (error) => {
        console.error("Error en snapshot de logos:", error)
      })
      
      return unsubscribe
    } catch (err) {
      console.error("Error cargando logos:", err)
    }
  }

  const handleSelectLogo = async (logo) => {
    try {
      if (!logo.fileURL) {
        alert("El logo seleccionado no tiene una URL válida.")
        return
      }
      console.log("Seleccionando logo:", logo.fileURL)
      await setAppLogo(logo.fileURL)
      console.log("Logo actualizado con éxito.")
      onClose()
    } catch (err) {
      console.error("Error actualizando logo:", err)
      alert("Error al actualizar el logo: " + err.message)
    }
  }

  const handleUploadLogo = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen')
      return
    }

    setUploading(true)
    try {
      const metadata = {
        fileName: file.name,
        fileDescription: 'Logo subido desde el diálogo',
        folder: 'logos',
        // Agregar campos adicionales para compatibilidad con FileStorage
        documentCategory: '',
        entityType: '',
        entityId: '',
        entityName: '',
        visibility: 'private',
        permissions: ['max'],
        versionNumber: 1,
        versionHistory: [],
        analyzed: false,
        analysisData: {}
      }
      
      const result = await uploadFile(file, 'admin/folders/logos', metadata)
      
      if (result.url) {
        alert('Logo subido exitosamente')
        // La lista se actualiza automáticamente con onSnapshot
      }
    } catch (error) {
      console.error('Error subiendo logo:', error)
      alert('Error al subir el logo: ' + error.message)
    } finally {
      setUploading(false)
      // Limpiar el input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  useEffect(() => {
    let unsubscribe = null
    
    if (open) {
      unsubscribe = fetchLogos()
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [open])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Seleccionar Logo desde Biblioteca</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            sx={{
              bgcolor: "var(--secondary-main)",
              "&:hover": { bgcolor: "var(--secondary-dark)" },
              "&:disabled": { bgcolor: "rgba(0,0,0,0.3)" },
            }}
          >
            {uploading ? "Subiendo..." : "Subir Nuevo Logo"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadLogo}
            style={{ display: 'none' }}
          />
        </Box>
        <Grid container spacing={2}>
          {logos.map((logo) => (
            <Grid item xs={6} sm={4} md={3} key={logo.id}>
              <Card>
                <CardContent sx={{ textAlign: "center" }}>
                  <img
                    src={logo.fileURL || "/placeholder.svg"}
                    alt={logo.fileName || "Logo"}
                    width={150}
                    height={100}
                    loading="lazy"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 100,
                      objectFit: "contain",
                      aspectRatio: "3/2",
                    }}
                  />
                  <Typography variant="body2" noWrap>
                    {logo.fileName || "Logo"}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: "center" }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleSelectLogo(logo)}
                    sx={{
                      "&:hover": { backgroundColor: "primary.dark" },
                    }}
                  >
                    Usar este logo
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
