// React import removed - using JSX runtime
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  Tooltip,
  Alert
} from "@mui/material";
import {
  Description as DescriptionIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon
} from "@mui/icons-material";
import { getDeadlineColor, getDeadlineStatus } from '../../../utils/getDeadlineUtils';
import { formatDateDDMMAAAA } from '../../../utils/dateHelpers.js';

const DocumentoCard = ({ doc, uploaded, onUploadClick = () => {} }) => {
  const getExpirationDate = () => {
    const rawDate = uploaded?.expirationDate || doc?.deadline?.date;
    if (!rawDate) return null;
    if (typeof rawDate === "string" || typeof rawDate === "number") return new Date(rawDate);
    if (rawDate.seconds) return new Date(rawDate.seconds * 1000);
    return null;
  };

  const expirationDate = getExpirationDate();
  const days = expirationDate ? Math.floor((expirationDate - new Date()) / (1000 * 60 * 60 * 24)) : null;

  const bgColor =
    days !== null
      ? days <= 0
        ? "rgba(244, 67, 54, 0.08)"
        : days <= 10
        ? "rgba(255, 152, 0, 0.08)"
        : "white"
      : "white";

  const renderExpiration = () => {
    if (!expirationDate) return null;
    const status = getDeadlineStatus(expirationDate);
    const Icon = status.icon === "Error" ? ErrorIcon :
                 status.icon === "Warning" ? WarningIcon :
                 status.icon === "CheckCircle" ? CheckCircleIcon : InfoIcon;

    return (
      <Box display="flex" alignItems="center" mt={1}>
        <Typography variant="caption" color={getDeadlineColor(expirationDate)}>
          {uploaded?.status === "Aprobado" ? "Vence aprobado: " : "Vence requerido: "}
          {formatDateDDMMAAAA(expirationDate)}
        </Typography>
        <Icon fontSize="small" sx={{ ml: 1 }} color={status.level} />
      </Box>
    );
  };

  const renderStatus = () => {
    // USAR SOLO uploadedDocuments (estado específico del empleado)
    // Los requiredDocuments son templates compartidos GLOBALES
    const hasUploadedDocument = !!uploaded;
    const documentStatus = uploaded?.status;

    // Debug más completo
    console.log(`[DocumentCard] 📋 Verificando documento:`, {
      docId: doc?.id,
      docName: doc?.name,
      uploadedExists: !!uploaded,
      uploadedId: uploaded?.id,
      uploadedStatus: uploaded?.status,
      uploadedRequiredDocumentId: uploaded?.requiredDocumentId,
      uploadedDocumentType: uploaded?.documentType,
      uploadedEntityId: uploaded?.entityId,
      uploadedEntityType: uploaded?.entityType,
      hasUploadedDocument,
      entitySpecific: 'uploadedDocuments'
    });

    if (!hasUploadedDocument) {
      console.log(`[DocumentCard] 📋 Sin documento subido - estado específico del empleado no encontrado`);
      return (
        <Typography variant="body2" color="text.secondary">
          Documento no cargado aún
        </Typography>
      );
    }

    console.log(`[DocumentCard] 📊 Estado del documento (empleado específico):`, {
      status: documentStatus,
      requiredDocumentId: uploaded?.requiredDocumentId,
      statusSource: 'uploadedDocuments'
    });

    return (
      <>
        <Chip
          label={documentStatus || "Pendiente de revisión"}
          size="small"
          sx={{ mb: 1 }}
          color={
            documentStatus === "Aprobado"
              ? "success"
              : documentStatus === "Subido"
              ? "info"
              : documentStatus === "Pendiente de revisión"
              ? "warning"
              : documentStatus === "En proceso"
              ? "info"
              : documentStatus === "Rechazado"
              ? "error"
              : "warning"
          }
        />
        {documentStatus === "Rechazado" && uploaded?.adminComment && (
          <Alert severity="error" sx={{ mt: 1, p: 1 }}>
            <Typography variant="caption">{uploaded.adminComment}</Typography>
          </Alert>
        )}
      </>
    );
  };

  return (
    <Card
      sx={{
        backgroundColor: bgColor,
        border: '1px solid #e0e0e0',
        '&:hover': { boxShadow: 3 },
        minHeight: 170,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <DescriptionIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="bold">
            {doc.name || uploaded?.documentName || "Sin nombre"}
          </Typography>
        </Box>

        {renderStatus()}
        {renderExpiration()}

        <Box mt={2}>
          <Tooltip title={
            !uploaded
              ? "Subir nuevo documento"
              : uploaded.status === "Aprobado"
              ? "Subir uno nuevo para actualizar"
              : "Reemplazar documento rechazado"
          }>
            <Button
              variant="outlined"
              size="small"
              onClick={() => onUploadClick(doc)}
              fullWidth
            >
              {!uploaded
                ? "Subir"
                : uploaded.status === "Aprobado"
                ? "Actualizar"
                : "Reemplazar"}
            </Button>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
};

export default DocumentoCard;
