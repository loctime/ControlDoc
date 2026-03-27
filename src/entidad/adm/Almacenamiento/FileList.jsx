// React import removed - using JSX runtime
import {
  Paper,
  Box,
  IconButton,
  Typography,
} from "@mui/material"
import { Visibility, MoreVert, InsertDriveFile, PictureAsPdf, Image, Description } from "@mui/icons-material"
import { formatDateDDMMAAAA } from '../../../utils/dateHelpers.js';

// Iconos para diferentes tipos de archivo.
const fileTypeIcons = {
  "application/pdf": <PictureAsPdf sx={{ color: "var(--error-main)" }} />,
  "image/png": <Image sx={{ color: "var(--primary-main)" }} />,
  "image/jpeg": <Image sx={{ color: "var(--primary-main)" }} />,
  "image/jpg": <Image sx={{ color: "var(--primary-main)" }} />,
  "image/gif": <Image sx={{ color: "var(--primary-main)" }} />,
  "application/msword": <Description sx={{ color: "#2b579a" }} />,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
    <Description sx={{ color: "#2b579a" }} />
  ),
  "application/vnd.ms-excel": <Description sx={{ color: "#217346" }} />,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": <Description sx={{ color: "#217346" }} />,
  "application/vnd.ms-powerpoint": <Description sx={{ color: "#d24726" }} />,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": (
    <Description sx={{ color: "#d24726" }} />
  ),
}

const renderFileIcon = (fileType = "") => {
  return fileTypeIcons[fileType] || <InsertDriveFile sx={{ color: "var(--paper-background-text)", opacity: 0.5 }} />
}

const formatDate = (dateString) => {
  if (!dateString) return "-"
  return formatDateDDMMAAAA(dateString)
}

export default function FileList({ visibleFiles = [], handlePreview = () => {}, handleOpenMenu = () => {} }) {
  if (!Array.isArray(visibleFiles)) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography color="error">Error: visibleFiles debe ser un array</Typography>
      </Paper>
    )
  }

  return (
    <Paper>
      <Box sx={{ width: "100%", overflow: "auto" }}>
        <Box sx={{ display: "table", width: "100%", borderCollapse: "collapse" }}>
          {/* Header */}
          <Box sx={{ display: "table-header-group", bgcolor: "background.default" }}>
            <Box sx={{ display: "table-row" }}>
              <Box sx={{ display: "table-cell", p: 2, fontWeight: "bold", borderBottom: 1, borderColor: "divider" }}>
                Nombre
              </Box>
              <Box sx={{ display: "table-cell", p: 2, fontWeight: "bold", borderBottom: 1, borderColor: "divider" }}>
                Carpeta
              </Box>
              <Box sx={{ display: "table-cell", p: 2, fontWeight: "bold", borderBottom: 1, borderColor: "divider" }}>
                Descripción
              </Box>
              <Box sx={{ display: "table-cell", p: 2, fontWeight: "bold", borderBottom: 1, borderColor: "divider" }}>
                Fecha
              </Box>
              <Box sx={{ display: "table-cell", p: 2, fontWeight: "bold", borderBottom: 1, borderColor: "divider" }}>
                Acciones
              </Box>
            </Box>
          </Box>

          {/* Body */}
          <Box sx={{ display: "table-row-group" }}>
            {visibleFiles.length === 0 ? (
              <Box sx={{ display: "table-row" }}>
                <Box sx={{ display: "table-cell", p: 4, textAlign: "center" }} colSpan={5}>
                  <Typography variant="body1" color="text.secondary">
                    No hay archivos para mostrar
                  </Typography>
                </Box>
              </Box>
            ) : (
              visibleFiles.map((file, index) => {
                const fileId = file.fileId || file.id || `file-${index}`
                return (
                  <Box
                    key={fileId}
                    sx={{
                      display: "table-row",
                      "&:hover": { bgcolor: "action.hover" },
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      console.debug(`[FileList] Preview archivo:`, file)
                      handlePreview(file)
                    }}
                  >
                    <Box sx={{ display: "table-cell", p: 2, borderBottom: 1, borderColor: "divider" }}>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        {renderFileIcon(file.fileType)}
                        <Typography sx={{ ml: 1 }} noWrap title={file.fileName}>
                          {file.fileName || "Sin nombre"}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "table-cell", p: 2, borderBottom: 1, borderColor: "divider" }}>
                      <Typography variant="body2">{file.folder || file.folderPath || "-"}</Typography>
                    </Box>
                    <Box sx={{ display: "table-cell", p: 2, borderBottom: 1, borderColor: "divider" }}>
                      <Typography variant="body2" noWrap title={file.fileDescription}>
                        {file.fileDescription || file.description || "-"}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "table-cell", p: 2, borderBottom: 1, borderColor: "divider" }}>
                      <Typography variant="body2">{formatDate(file.uploadedAt)}</Typography>
                    </Box>
                    <Box sx={{ display: "table-cell", p: 2, borderBottom: 1, borderColor: "divider" }}>
                      <IconButton
                        size="small"
                        aria-label="Ver archivo"
                        onClick={(e) => {
                          e.stopPropagation()
                          console.debug(`[FileList] Click ver archivo:`, file)
                          handlePreview(file)
                        }}
                        title="Ver archivo"
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Más opciones"
                        onClick={(e) => {
                          e.stopPropagation()
                          console.debug(`[FileList] Click menú archivo:`, file)
                          handleOpenMenu(e, file)
                        }}
                        title="Más opciones"
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                )
              })
            )}
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}
