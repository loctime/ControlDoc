import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DownloadButton from "../../../../components/common/DownloadButton";
import VistaPrevia from "../../../../components/common/VistaPrevia";

export function LatestDocumentSection({
  expanded,
  onToggle,
  onKeyDown,
  statusLabel,
  statusColor,
  info,
  isProcessState,
  contactEmail,
  mailtoHref,
  entityName,
  documentName,
}) {
  const {
    version,
    updatedAt,
    reviewerComment,
    companyComment,
    fileURL,
    fileName,
  } = info;

  return (
    <Stack spacing={1.5}>
      <Box
        onClick={onToggle}
        onKeyDown={onKeyDown}
        role="button"
        tabIndex={0}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Typography variant="subtitle1" fontWeight={600}>
            Último documento gestionado
          </Typography>
          {statusLabel && (
            <Chip
              label={statusLabel}
              color={statusColor}
              size="small"
              sx={{ textTransform: "capitalize" }}
            />
          )}
          <Typography
            variant="body2"
            color="primary.main"
            sx={{ fontWeight: 600, textDecoration: "underline" }}
          >
            Ver
          </Typography>
        </Stack>
        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Grid container spacing={2.5} alignItems="stretch">
          <Grid item xs={12} md={8}>
            <Stack spacing={1.5} sx={{ height: "100%" }}>
              {isProcessState && (
                <Alert severity="warning" variant="outlined">
                  <Typography variant="body2" fontWeight={600}>
                    Este documento está en revisión externa.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Si el archivo tiene un error, avisa al administrador para cancelar la revisión antes de subir uno nuevo.
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={2}>
                    <Button
                      variant="contained"
                      color="warning"
                      size="small"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(
                            new CustomEvent("openSupportContact", {
                              detail: { contactEmail, entityName, documentName },
                            })
                          );
                        }
                      }}
                      disabled={!contactEmail}
                    >
                      Notificar al administrador
                    </Button>
                    {mailtoHref && (
                      <Button variant="outlined" size="small" href={mailtoHref}>
                        Enviar correo
                      </Button>
                    )}
                  </Stack>
                </Alert>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
                {version && (
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      Versión:
                    </Box>{" "}
                    {version}
                  </Typography>
                )}
                {updatedAt && (
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      Actualizado:
                    </Box>{" "}
                    {updatedAt}
                  </Typography>
                )}
              </Stack>

              {reviewerComment && (
                <Typography variant="body2">
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    Comentario del administrador:
                  </Box>{" "}
                  {reviewerComment}
                </Typography>
              )}
              {companyComment && (
                <Typography variant="body2" color="text.secondary">
                  <Box component="span" sx={{ fontWeight: 600 }}>
                    Comentario enviado:
                  </Box>{" "}
                  {companyComment}
                </Typography>
              )}

              {fileURL && (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <DownloadButton
                    url={fileURL}
                    filename={fileName}
                    currentDocument={{
                      fileURL,
                      fileName,
                      name: documentName || fileName,
                      companyName: entityName,
                    }}
                    label="Descargar último archivo"
                    variant="outlined"
                    size="small"
                  />
                  {fileName && (
                    <Typography variant="caption" color="text.secondary">
                      Archivo: {fileName}
                    </Typography>
                  )}
                </Stack>
              )}
            </Stack>
          </Grid>

          {fileURL && (
            <Grid item xs={12} md={3}>
              <VistaPrevia
                url={fileURL}
                fileType={info.fileType}
                width="100%"
                height={160}
                tipo="documento"
                sx={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 1,
                }}
              />
            </Grid>
          )}
        </Grid>
      </Collapse>
    </Stack>
  );
}


