// React import removed - using JSX runtime

// Material UI
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  IconButton,
} from "@mui/material";

// Iconos
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

// Utilidades
import { getDeadlineColor, getDeadlineStatus } from '../../utils/getDeadlineUtils.jsx';
import { formatDateDDMMAAAA } from '../../utils/dateHelpers.js';

export default function EntidadPanel({
  title,
  entityType,
  entityList = [],
  documentosRequeridos = [],
  documentosSubidos = [],
  onVerMas = () => {},
  onUploadDirect = () => {},
  renderIdentificadores = () => null,
  maxDocumentos = 5,
  sortField = null,
  sortDirection = 'asc',
  onSort = () => {},
  formatDate = (value) => {
    if (!value) return null;
    return formatDateDDMMAAAA(value);
  }
}) {
  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {title} ({entityList.length})
      </Typography>

      {entityList.length === 0 ? (
        <Typography color="textSecondary">
          No hay elementos registrados para esta entidad.
        </Typography>
      ) : (
        <TableContainer 
          component={Paper}
          sx={{ 
            overflowX: 'auto',
            maxWidth: '100%',
            width: '100%'
          }}
        >
          <Table sx={{ tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                {renderIdentificadores("header")}
                {[...documentosRequeridos]
                  .filter(doc => doc.entityType === entityType)
                  .slice(0, maxDocumentos)
                  .map(doc => (
                    <TableCell key={doc.id}>
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1, 
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' }
                        }}
                        onClick={() => onSort('documento')}
                      >
                        <b>{doc.name}</b>
                        {sortField === 'documento' ? 
                          (sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />) :
                          <ArrowUpwardIcon fontSize="small" sx={{ opacity: 0.3 }} />
                        }
                      </Box>
                    </TableCell>
                  ))}
                <TableCell><b>Ver Más</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entityList.map(entidad => (
                <TableRow key={entidad.id}>
                  {renderIdentificadores("row", entidad)}

                  {[...documentosRequeridos]
                    .filter(doc => doc.entityType === entityType)
                    .slice(0, maxDocumentos)
                    .map(doc => {
                      const uploaded = documentosSubidos.find(
                        up => up.entityId === entidad.id && (up.requiredDocumentId === doc.id || up.documentType === doc.id)
                      );
                      // Estado solo desde uploadedDocuments (requiredDocuments son plantillas, no tienen estado por subida)

                      let expDate = null;
                      if (uploaded?.expirationDate) {
                        if (typeof uploaded.expirationDate === 'string' || typeof uploaded.expirationDate === 'number') {
                          expDate = new Date(uploaded.expirationDate);
                        } else if (uploaded.expirationDate?.seconds) {
                          expDate = new Date(uploaded.expirationDate.seconds * 1000);
                        }
                      } else if (doc.deadline?.date) {
                        if (typeof doc.deadline.date === 'string' || typeof doc.deadline.date === 'number') {
                          expDate = new Date(doc.deadline.date);
                        } else if (doc.deadline.date?.seconds) {
                          expDate = new Date(doc.deadline.date.seconds * 1000);
                        }
                      }
                      const fechaValida = expDate && !isNaN(expDate) && formatDateDDMMAAAA(expDate) !== 'Fecha inválida';
                      const status = fechaValida ? getDeadlineStatus(expDate) : null;
                      let Icon = null;
                      if (status) {
                        if (status.icon === 'Error') Icon = ErrorIcon;
                        else if (status.icon === 'Warning') Icon = WarningIcon;
                        else if (status.icon === 'CheckCircle') Icon = CheckCircleIcon;
                        else Icon = InfoIcon;
                      }
                      // USAR SOLO uploadedDocuments (estado específico de la entidad)
                      // NO confiar en requiredDocuments que son templates compartidos
                      const finalStatus = uploaded?.status;
                      const hasAnyUploadedStatus = !!uploaded;

                      // Lógica reforzada: SIEMPRE muestra estado
                      if (hasAnyUploadedStatus) {
                        return (
                          <TableCell key={doc.id}>
                            <Box sx={{ display: "flex", flexDirection: "column", cursor: "pointer" }} onClick={() => onUploadDirect(entidad, doc.id)}>
                              <Typography
                                color={
                                  finalStatus === "Aprobado"
                                    ? "success.main"
                                    : finalStatus === "Subido"
                                    ? "info.main"
                                    : finalStatus === "En proceso"
                                    ? "info.main"
                                    : finalStatus === "Rechazado"
                                    ? "error.main"
                                    : finalStatus === "Pendiente de revisión"
                                    ? "warning.main"
                                    : "text.secondary"
                                }
                                variant="body1"
                                fontWeight="bold"
                                sx={{ mb: 0.5 }}
                              >
                                {finalStatus || "Pendiente de revisión"}
                              </Typography>
                              {finalStatus === "Rechazado" && uploaded?.adminComment && (
                                <Typography variant="caption" color="error" display="block">
                                  Motivo: {uploaded.adminComment}
                                </Typography>
                              )}
                              {finalStatus === "Aprobado" && fechaValida && (
                                <Typography variant="caption" color={getDeadlineColor(expDate)}>
                                  Vence aprobado: {formatDateDDMMAAAA(expDate)}
                                </Typography>
                              )}
                              {finalStatus !== "Aprobado" && fechaValida && (
                                <Typography variant="caption" color={getDeadlineColor(expDate)}>
                                  Vence requerido: {formatDateDDMMAAAA(expDate)}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                        );
                      } else if (fechaValida) {
                        return (
                          <TableCell key={doc.id}>
                            <Box display="flex" flexDirection="column" alignItems="flex-start" mt={1} gap={1}>
                              <Typography variant="body1" color="text.secondary" fontWeight="bold" sx={{ mb: 0.5 }}>
                                Pendiente para subir
                              </Typography>
                              <Typography variant="caption" color={getDeadlineColor(expDate)}>
                                Vence requerido: {formatDateDDMMAAAA(expDate)}
                              </Typography>
                              {Icon && <Icon fontSize="small" color={status.level} />}
                            </Box>
                          </TableCell>
                        );
                      } else {
                        return (
                          <TableCell key={doc.id}>
                            <Typography variant="body1" color="text.secondary" fontWeight="bold">Pendiente para subir</Typography>
                          </TableCell>
                        );
                      }
                    })}
                  <TableCell>
                    <Tooltip title="Ver todos los documentos" arrow>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onVerMas(entidad)}
                      >
                        Ver Más
                      </Button>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
