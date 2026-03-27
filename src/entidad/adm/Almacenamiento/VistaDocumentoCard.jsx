"use client"

import React, { useState, useMemo } from "react";
import {
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Stack,
  Tooltip,
  CircularProgress
} from "@mui/material";
import { InsertDriveFile, PictureAsPdf, Download, Delete } from "@mui/icons-material";
import DownloadButton from "../../../components/common/DownloadButton";
import { useSnackbar } from "notistack";

// Función helper para formatear el tamaño del archivo
const formatFileSize = (bytes) => {
  if (!bytes) return ""
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
}

export default function VistaDocumentoCard({ file, width = 240, height = 140, onDeleteFile = null }) {
  const [open, setOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [loading, setLoading] = useState(false)
  const { enqueueSnackbar } = useSnackbar()

  const fileURL = file?.fileURL || ""
  const fileName = file?.fileName || "Sin nombre"
  const fileType = file?.fileType || ""
  const fileSize = file?.fileSize ? formatFileSize(file.fileSize) : ""
  const uploadDate = file?.uploadedAt
    ? new Date(file.uploadedAt).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""

  const isPDF = fileType === "application/pdf" || /\.pdf$/i.test(fileURL)
  const isImage = !isPDF && (fileType.startsWith("image/") || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileURL))

  const pdfUrl = useMemo(() => {
    if (!isPDF) return ""
    const viewer = "https://mozilla.github.io/pdf.js/web/viewer.html"
    return `${viewer}?file=${encodeURIComponent(fileURL)}`
  }, [fileURL, isPDF])

  const handleDownloadAsPdf = async () => {
    if (!isImage) return
    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/convert-image/from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: fileURL }),
      })
      if (!response.ok) throw new Error("Error al convertir a PDF")
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = fileName.replace(/\.[^\.]+$/, ".pdf")
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
      enqueueSnackbar("PDF generado y descargado correctamente", { variant: "success" })
    } catch (error) {
      console.error("Error al convertir a PDF:", error)
      enqueueSnackbar("Error al convertir a PDF", { variant: "error" })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = () => {
    if (onDeleteFile && typeof onDeleteFile === "function") {
      onDeleteFile(file)
      setOpen(false)
    }
  }

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  return (
    <>
      <Card sx={{ width }}>
        <CardActionArea onClick={handleOpen} aria-label={`Abrir vista previa de ${fileName}`}>
          {isImage && !imgError ? (
            <CardMedia
              component="img"
              height={height}
              image={fileURL}
              alt={fileName}
              sx={{ objectFit: "cover" }}
              onError={() => setImgError(true)}
            />
          ) : isPDF ? (
            <Box
              sx={{
                height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f5f5f5",
                position: "relative",
              }}
            >
              <PictureAsPdf fontSize="large" color="error" />
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  bottom: 4,
                  left: 4,
                  right: 4,
                  textAlign: "center",
                  backgroundColor: "rgba(0,0,0,0.7)",
                  color: "white",
                  borderRadius: 1,
                  px: 1,
                }}
              >
                PDF
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                height,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f5f5f5",
              }}
            >
              <InsertDriveFile fontSize="large" color="disabled" />
            </Box>
          )}

          <CardContent sx={{ pt: 1, pb: 1 }}>
            <Typography variant="subtitle2" noWrap title={fileName}>
              {fileName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(file.uploadedAt).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" noWrap sx={{ flex: 1, mr: 2 }}>
              {fileName}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              {fileSize && (
                <Typography variant="caption" color="text.secondary">
                  {fileSize}
                </Typography>
              )}
              {uploadDate && (
                <Typography variant="caption" color="text.secondary">
                  {uploadDate}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {isPDF ? (
            <iframe src={pdfUrl} title="Vista ampliada" width="100%" height="600" style={{ border: "none" }} />
          ) : isImage && !imgError ? (
            <Box sx={{ display: "flex", justifyContent: "center", height: "70vh" }}>
              <img
                src={fileURL || "/placeholder.svg"}
                alt={fileName}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
                onError={() => setImgError(true)}
              />
            </Box>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: 200,
                gap: 2,
              }}
            >
              <InsertDriveFile fontSize="large" color="disabled" />
              <Typography variant="body2" color="text.secondary" align="center">
                Vista previa no disponible para este tipo de archivo
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
          {onDeleteFile && (
            <Button variant="outlined" color="error" startIcon={<Delete />} onClick={handleDelete} aria-label="Eliminar archivo">
              Eliminar
            </Button>
          )}

          <Stack direction="row" spacing={2}>
            <Tooltip title="Descargar archivo original">
              <span>
                <DownloadButton
                  url={fileURL}
                  filename={fileName}
                  label="Descargar"
                  variant="contained"
                  size="medium"
                  iconOnly={false}
                  startIcon={true}
                />
              </span>
            </Tooltip>
            {isImage && (
              <Tooltip title="Convertir a PDF y descargar">
                <span>
                  <Button
                    variant="outlined"
                    startIcon={loading ? <CircularProgress size={20} /> : <PictureAsPdf />}
                    onClick={handleDownloadAsPdf}
                    disabled={loading}
                    aria-label="Descargar como PDF"
                  >
                    PDF
                  </Button>
                </span>
              </Tooltip>
            )}
          </Stack>
        </DialogActions>
      </Dialog>
    </>
  )
}
