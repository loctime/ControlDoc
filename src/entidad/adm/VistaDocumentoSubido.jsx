import { useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import DownloadButton from "../../components/common/DownloadButton";
import { parseFirestoreDate } from "../../utils/dateHelpers";
import {
  getDeadlineStatus,
  getStatusIconComponent
} from "../../utils/getDeadlineUtils";

const isPDF = (fileName) => fileName && /\.pdf$/i.test(fileName);
const isImage = (fileName) =>
  fileName && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);

export default function VistaDocumentoSubido({
  id,
  name,
  fileURL,
  fileName,
  status,
  companyName,
  entityName,
  entityType,
  uploadedByEmail,
  expirationDate,
  companyComment,
  adminComment,
  onDateSelect,
  onApproveClick,
  onRejectClick,
  onSetInProcessClick,
  onApprove,
  onReject,
  onSetInProcess,
  selectedDate
}) {
  const [imageScale, setImageScale] = useState(1);

  const expirationParsed = parseFirestoreDate(expirationDate);
  const deadlineStatus = getDeadlineStatus(expirationParsed || expirationDate);
  const hasComments = !!(companyComment?.trim() || adminComment?.trim());

  const handleApprove = () => {
    if (onApproveClick) onApproveClick(id);
    else onApprove?.(id);
  };
  const handleReject = () => {
    if (onRejectClick) onRejectClick(id);
    else onReject?.(id);
  };
  const handleSetInProcess = () => {
    if (onSetInProcessClick) onSetInProcessClick(id);
    else onSetInProcess?.(id);
  };

  const renderViewer = () => {
    if (!fileURL) return null;

    if (isPDF(fileName)) {
      return (
        <Box
          sx={{
            width: "100%",
            height: { xs: "55vh", md: "65vh" },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden"
          }}
        >
          <iframe
            src={fileURL}
            title="Vista previa PDF"
            style={{
              width: "100%",
              height: "100%",
              border: "none"
            }}
          />
        </Box>
      );
    }

    if (isImage(fileName)) {
      return (
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 280,
              bgcolor: "grey.100"
            }}
          >
            <img
              src={fileURL}
              alt={name || "Vista previa"}
              style={{
                maxWidth: "100%",
                maxHeight: "65vh",
                objectFit: "contain",
                transform: `scale(${imageScale})`
              }}
            />
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              onClick={() => setImageScale((s) => Math.min(2, s + 0.25))}
            >
              +
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setImageScale((s) => Math.max(0.5, s - 0.25))}
            >
              −
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setImageScale(1)}
            >
              Reset
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => window.open(fileURL, "_blank")}
            >
              Abrir en nueva pestaña
            </Button>
          </Stack>
        </Box>
      );
    }

    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        Tipo de archivo no soportado para vista previa. Use el botón Descargar.
      </Typography>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="h6">
          {name || fileName || "Documento"}
        </Typography>

        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
          <Typography variant="body2">
            Empresa: <b>{companyName || "—"}</b>
          </Typography>
          <Typography variant="body2">
            Entidad: {entityName || "—"} ({entityType || "—"})
          </Typography>
          <Typography variant="body2">
            Subido por: {uploadedByEmail || "—"}
          </Typography>

          <Chip
            size="small"
            label={status}
            color={
              status === "Pendiente de revisión"
                ? "warning"
                : status === "En proceso"
                ? "info"
                : status === "Aprobado"
                ? "success"
                : "error"
            }
          />

          {expirationDate && (
            <Chip
              size="small"
              icon={getStatusIconComponent(deadlineStatus.icon)}
              label={
                expirationParsed
                  ? expirationParsed.toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    })
                  : "Vence: —"
              }
              color={deadlineStatus.level}
              variant="outlined"
              sx={{
                borderColor:
                  deadlineStatus.level === "error"
                    ? "error.main"
                    : deadlineStatus.level === "warning"
                    ? "warning.main"
                    : undefined
              }}
            />
          )}
        </Stack>
      </Stack>

      <Box sx={{ my: 2 }}>{renderViewer()}</Box>

      {onDateSelect && (
        <Box sx={{ mb: 2 }}>
          <TextField
            label="Fecha de vencimiento"
            type="date"
            size="small"
            value={selectedDate || ""}
            onChange={(e) => onDateSelect(id, e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 200 }}
          />
        </Box>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        {fileURL && (
          <DownloadButton
            url={fileURL}
            currentDocument={{
              fileURL,
              fileName,
              name,
              companyName,
              entityType,
              entityName
            }}
            label="Descargar"
            variant="outlined"
            size="small"
          />
        )}

        {(status === "Pendiente de revisión" || status === "En proceso") && (
          <>
            <Button
              variant="contained"
              color="success"
              size="small"
              onClick={handleApprove}
            >
              Aprobar
            </Button>
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={handleReject}
            >
              Rechazar
            </Button>
            {status === "Pendiente de revisión" && (
              <Button
                variant="outlined"
                color="info"
                size="small"
                onClick={handleSetInProcess}
              >
                En proceso
              </Button>
            )}
          </>
        )}
      </Stack>

      {hasComments && (
        <Accordion defaultExpanded={false} sx={{ mt: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Comentarios</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {companyComment?.trim() && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Comentario de la empresa
                </Typography>
                <Typography variant="body2">{companyComment}</Typography>
              </Box>
            )}
            {adminComment?.trim() && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Comentario de revisión
                </Typography>
                <Typography variant="body2">{adminComment}</Typography>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}
