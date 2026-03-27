// React import removed - using JSX runtime
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
  Typography,
  Button,
} from "@mui/material"
import { Close } from "@mui/icons-material"
import VistaPrevia from "../../../components/common/VistaPrevia"
import DownloadButton from "../../../components/common/DownloadButton"

export default function PreviewDialog({ open, onClose, previewFile }) {
  if (!previewFile) return null

  const isPDF = previewFile.fileType === "application/pdf" || /\.pdf$/i.test(previewFile.fileURL)
  const isImage =
    previewFile.fileType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(previewFile.fileURL)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" noWrap sx={{ flex: 1, mr: 2 }}>
            {previewFile.fileName || "Vista previa"}
          </Typography>
          <IconButton onClick={onClose} aria-label="Cerrar vista previa">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, height: "70vh" }}>
        {isPDF ? (
          <iframe
            src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(previewFile.fileURL)}`}
            width="100%"
            height="100%"
            style={{ border: "none" }}
            title="Vista previa PDF"
          />
        ) : isImage ? (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
            }}
          >
            <img
              src={previewFile.fileURL || "/placeholder.svg"}
              alt={previewFile.fileName}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              p: 4,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              Vista previa no disponible
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Este tipo de archivo no se puede previsualizar en el navegador. Puedes descargarlo para abrirlo con la
              aplicación correspondiente.
            </Typography>
            <DownloadButton
              url={previewFile.fileURL}
              filename={previewFile.fileName}
              label="Descargar archivo"
              variant="contained"
              size="medium"
              iconOnly={false}
              startIcon={true}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <DownloadButton
          url={previewFile.fileURL}
          filename={previewFile.fileName}
          label="Descargar"
          variant="contained"
          size="medium"
          iconOnly={false}
          startIcon={true}
        />
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
