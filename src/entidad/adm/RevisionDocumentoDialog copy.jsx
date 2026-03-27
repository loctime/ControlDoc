// components/RevisionDocumentoDialog.jsx
import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Alert
} from "@mui/material";

import DownloadButton from "../../components/common/DownloadButton";
import DownloadAsPdfButton from "../../components/common/DownloadAsPdfButton";
import VistaPrevia from "../../components/common/VistaPrevia";

import { buildDownloadName } from "../../utils/buildDownloadName";
import {
  getDeadlineStatus,
  getStatusIconComponent,
  getDeadlineColor
} from "../../utils/getDeadlineUtils";

export default function RevisionDocumentoDialog({
  open,
  tipo, // 'aprobar' | 'rechazar' | 'poner_en_proceso' | 'ajustar_fecha'
  doc,
  onClose,
  onConfirm,
  expirationDate,
  setExpirationDate,
  adminComment,
  setAdminComment,
  setToastMessage = () => {},
  setToastOpen = () => {}
}) {
  const [commentError, setCommentError] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!doc) return null;

  const handleConfirm = async () => {
    if (tipo === "rechazar" && !adminComment?.trim()) {
      setCommentError(true);
      setToastMessage("Debe ingresar un comentario.");
      setToastOpen(true);
      return;
    }

    if (
      (tipo === "aprobar" || tipo === "ajustar_fecha") &&
      !expirationDate
    ) {
      setDateError(true);
      setToastMessage("Debe ingresar una fecha de vencimiento.");
      setToastOpen(true);
      return;
    }

    setLoading(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error(err);
      setToastMessage("Error al procesar la acción.");
      setToastOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {tipo === "aprobar" && "Aprobar documento"}
        {tipo === "rechazar" && "Rechazar documento"}
        {tipo === "poner_en_proceso" && "Poner documento en proceso"}
        {tipo === "ajustar_fecha" && "Ajustar fecha de vencimiento"}
      </DialogTitle>

      <DialogContent dividers>
        {/* ───────────── APROBAR ───────────── */}
        {tipo === "aprobar" && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Vista previa
            </Typography>

            <VistaPrevia
              url={doc.fileURL}
              titulo="Vista previa del archivo"
              tipo="documento"
              width={280}
              height={280}
            />

            <Box sx={{ mt: 2 }}>
              <DownloadButton
                url={doc.fileURL}
                currentDocument={{
                  fileURL: doc.fileURL,
                  fileName: doc.fileName,
                  companyName: doc.companyName,
                  name: doc.name,
                  entityType: doc.entityType,
                  entityName: doc.entityName
                }}
                label="Descargar archivo"
              />
            </Box>

            {doc.fileName?.match(/\.(jpg|jpeg|png)$/i) && (
              <Box sx={{ mt: 1 }}>
                <DownloadAsPdfButton
                  imageUrl={doc.fileURL}
                  filename={buildDownloadName(doc).replace(/\.[^.]+$/, ".pdf")}
                  label="Descargar como PDF"
                />
              </Box>
            )}

            <TextField
              sx={{ mt: 2 }}
              label="Fecha de vencimiento"
              type="date"
              fullWidth
              size="small"
              value={expirationDate || ""}
              onChange={(e) => {
                setExpirationDate(e.target.value);
                setDateError(false);
              }}
              InputLabelProps={{ shrink: true }}
              error={dateError}
              helperText={dateError ? "Campo obligatorio" : ""}
              InputProps={{
                endAdornment:
                  expirationDate &&
                  getStatusIconComponent(
                    getDeadlineStatus(expirationDate).icon
                  )
              }}
              style={{
                color: expirationDate
                  ? getDeadlineColor(expirationDate)
                  : undefined
              }}
            />
          </>
        )}

        {/* ───────────── RECHAZAR ───────────── */}
        {tipo === "rechazar" && (
          <TextField
            label="Comentario"
            multiline
            rows={4}
            fullWidth
            value={adminComment || ""}
            onChange={(e) => {
              setAdminComment(e.target.value);
              setCommentError(false);
            }}
            required
            error={commentError}
            helperText={commentError ? "Campo obligatorio" : ""}
          />
        )}

        {/* ───────────── EN PROCESO ───────────── */}
        {tipo === "poner_en_proceso" && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              El documento quedará en proceso hasta nueva revisión.
            </Alert>

            <TextField
              label="Comentario (opcional)"
              multiline
              rows={3}
              fullWidth
              value={adminComment || ""}
              onChange={(e) => setAdminComment(e.target.value)}
            />
          </>
        )}

        {/* ───────────── AJUSTAR FECHA ───────────── */}
        {tipo === "ajustar_fecha" && (
          <TextField
            label="Nueva fecha de vencimiento"
            type="date"
            fullWidth
            size="small"
            value={expirationDate || ""}
            onChange={(e) => {
              setExpirationDate(e.target.value);
              setDateError(false);
            }}
            InputLabelProps={{ shrink: true }}
            error={dateError}
            helperText={dateError ? "Campo obligatorio" : ""}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading ? "Procesando…" : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
