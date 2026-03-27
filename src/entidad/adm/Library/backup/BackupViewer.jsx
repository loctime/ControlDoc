//adm/Library/backup/backupViewer.jsx
"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Breadcrumbs,
  Link,
  Chip,
} from "@mui/material"
import { Close, Folder, InsertDriveFile, Download, ArrowBack, PictureAsPdf, Image, Archive } from "@mui/icons-material"
import JSZip from "jszip"

export default function BackupViewer({ open, handleClose, currentBackup, formatDate }) {
  const [zipContent, setZipContent] = useState(null)
  const [currentPath, setCurrentPath] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open && currentBackup?.fileURL) {
      loadZipContent()
    }
  }, [open, currentBackup])

  const loadZipContent = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch(currentBackup.fileURL)
      const arrayBuffer = await response.arrayBuffer()
      const zip = new JSZip()
      const zipData = await zip.loadAsync(arrayBuffer)

      // Organizar archivos en estructura de carpetas
      const structure = {}

      Object.keys(zipData.files).forEach((path) => {
        const file = zipData.files[path]
        const parts = path.split("/")
        let current = structure

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]
          if (i === parts.length - 1) {
            // Es un archivo
            if (part && !file.dir) {
              current[part] = {
                type: "file",
                path: path,
                size: file._data?.uncompressedSize || 0,
                zipFile: file,
              }
            }
          } else {
            // Es una carpeta
            if (part && !current[part]) {
              current[part] = {
                type: "folder",
                children: {},
              }
            }
            current = current[part]?.children || {}
          }
        }
      })

      setZipContent(structure)
    } catch (err) {
      console.error("Error loading zip content:", err)
      setError("Error al cargar el contenido del backup")
    } finally {
      setLoading(false)
    }
  }

  const getCurrentContent = () => {
    if (!zipContent) return {}

    const pathParts = currentPath.split("/").filter(Boolean)
    let current = zipContent

    for (const part of pathParts) {
      current = current[part]?.children || {}
    }

    return current
  }

  const navigateToFolder = (folderName) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName
    setCurrentPath(newPath)
  }

  const navigateBack = () => {
    const pathParts = currentPath.split("/").filter(Boolean)
    pathParts.pop()
    setCurrentPath(pathParts.join("/"))
  }

  const navigateToBreadcrumb = (index) => {
    const pathParts = currentPath.split("/").filter(Boolean)
    const newPath = pathParts.slice(0, index + 1).join("/")
    setCurrentPath(newPath)
  }

  const downloadFile = async (fileItem) => {
    try {
      const content = await fileItem.zipFile.async("blob")
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = fileItem.path.split("/").pop()
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error downloading file:", err)
    }
  }

  const getFileIcon = (fileName) => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    switch (ext) {
      case "pdf":
        return <PictureAsPdf color="error" />
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return <Image color="primary" />
      case "zip":
      case "rar":
        return <Archive color="warning" />
      default:
        return <InsertDriveFile color="action" />
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const currentContent = getCurrentContent()
  const pathParts = currentPath.split("/").filter(Boolean)

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: "70vh",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          bgcolor: "#f9f9f9",
          borderBottom: "1px solid #ddd",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Archive color="primary" />
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            {currentBackup?.name || "Backup"}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip label={`${currentBackup?.fileCount || 0} archivos`} size="small" variant="outlined" />
          <IconButton onClick={handleClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "50vh",
            }}
          >
            <CircularProgress size={60} />
          </Box>
        ) : error ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : (
          <Box>
            {/* Información del backup */}
            <Box sx={{ p: 2, bgcolor: "#f5f5f5", borderBottom: "1px solid #ddd" }}>
              <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <Typography variant="caption">
                  <strong>Empresa:</strong> {currentBackup?.companyName}
                </Typography>
                <Typography variant="caption">
                  <strong>Creado:</strong> {formatDate(currentBackup?.createdAt)}
                </Typography>
                <Typography variant="caption">
                  <strong>Tamaño:</strong> {formatFileSize(currentBackup?.size)}
                </Typography>
                <Typography variant="caption">
                  <strong>Por:</strong> {currentBackup?.createdBy}
                </Typography>
              </Box>
              {currentBackup?.description && (
                <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
                  <strong>Descripción:</strong> {currentBackup.description}
                </Typography>
              )}
            </Box>

            {/* Navegación */}
            <Box sx={{ p: 2, borderBottom: "1px solid #ddd" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                {currentPath && (
                  <IconButton size="small" onClick={navigateBack}>
                    <ArrowBack />
                  </IconButton>
                )}
                <Typography variant="subtitle2">Contenido:</Typography>
              </Box>

              {pathParts.length > 0 && (
                <Breadcrumbs separator="/" sx={{ fontSize: "0.875rem" }}>
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => setCurrentPath("")}
                    sx={{ textDecoration: "none" }}
                  >
                    Raíz
                  </Link>
                  {pathParts.map((part, index) => (
                    <Link
                      key={index}
                      component="button"
                      variant="body2"
                      onClick={() => navigateToBreadcrumb(index)}
                      sx={{ textDecoration: "none" }}
                    >
                      {part}
                    </Link>
                  ))}
                </Breadcrumbs>
              )}
            </Box>

            {/* Lista de archivos y carpetas */}
            <List sx={{ maxHeight: "400px", overflow: "auto" }}>
              {Object.entries(currentContent).map(([name, item]) => (
                <ListItem
                  key={name}
                  button={item.type === "folder"}
                  onClick={item.type === "folder" ? () => navigateToFolder(name) : undefined}
                  sx={{
                    borderBottom: "1px solid #f0f0f0",
                    "&:hover": {
                      bgcolor: item.type === "folder" ? "action.hover" : "transparent",
                    },
                  }}
                >
                  <ListItemIcon>{item.type === "folder" ? <Folder sx={{ color: "var(--primary-main)" }} /> : getFileIcon(name)}</ListItemIcon>
                  <ListItemText
                    primary={name}
                    secondary={
                      item.type === "file"
                        ? formatFileSize(item.size)
                        : `${Object.keys(item.children || {}).length} elementos`
                    }
                  />
                  {item.type === "file" && (
                    <ListItemSecondaryAction>
                      <Tooltip title="Descargar archivo">
                        <IconButton edge="end" onClick={() => downloadFile(item)} size="small">
                          <Download />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}

              {Object.keys(currentContent).length === 0 && (
                <ListItem>
                  <ListItemText primary="Carpeta vacía" sx={{ textAlign: "center", color: "text.secondary" }} />
                </ListItem>
              )}
            </List>
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 2 }}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
