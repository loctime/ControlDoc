import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress
} from "@mui/material";

import {
  getDeadlineStatus,
  getStatusIconComponent,
  getDeadlineColor
} from "../../utils/getDeadlineUtils";

const TITLES = {
  aprobar: "Aprobar documento",
  rechazar: "Rechazar documento",
  poner_en_proceso: "Poner documento en proceso",
  ajustar_fecha: "Ajustar fecha de vencimiento"
};

/**
 * Dialog de revisión de documento para /admin/uploaded-documents.
 * Soporta: aprobar, rechazar, poner_en_proceso, ajustar_fecha.
 * Valida campos según tipo y llama onConfirm con un objeto de cambios.
 */
export default function RevisionDocumentoDialog({
  open,
  type,
  document: doc,
  expirationDate: initialExpirationDate = "",
  adminComment: initialAdminComment = "",
  onConfirm,
  onClose,
  loading = false
}) {
  const [expirationDate, setExpirationDate] = useState(initialExpirationDate);
  const [adminComment, setAdminComment] = useState(initialAdminComment);
  const [dateError, setDateError] = useState(false);
  const [commentError, setCommentError] = useState(false);

  const tipo = type;

  // Sincronizar con props cuando abren el dialog o cambian los valores iniciales
  useEffect(() => {
    if (open) {
      setExpirationDate(initialExpirationDate ?? "");
      setAdminComment(initialAdminComment ?? "");
      setDateError(false);
      setCommentError(false);
    }
  }, [open, initialExpirationDate, initialAdminComment]);

  const handleConfirm = () => {
    if (tipo === "rechazar" && !adminComment?.trim()) {
      setCommentError(true);
      return;
    }
    if (
      (tipo === "aprobar" || tipo === "ajustar_fecha") &&
      !expirationDate?.trim()
    ) {
      setDateError(true);
      return;
    }

    const payload = {
      type: tipo,
      ...(tipo === "aprobar" && { expirationDate: expirationDate?.trim() }),
      ...(tipo === "rechazar" && { adminComment: adminComment?.trim() }),
      ...(tipo === "poner_en_proceso" && {
        adminComment: adminComment?.trim() || undefined
      }),
      ...(tipo === "ajustar_fecha" && {
        expirationDate: expirationDate?.trim()
      })
    };

    onConfirm?.(payload);
  };

  const handleClose = () => {
    if (!loading) {
      setDateError(false);
      setCommentError(false);
      onClose?.();
    }
  };

  const title = TITLES[tipo] || "Revisión de documento";
  const needsDate =
    tipo === "aprobar" || tipo === "ajustar_fecha";
  const needsComment =
    tipo === "rechazar" || tipo === "poner_en_proceso";
  const commentRequired = tipo === "rechazar";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="revision-dialog-title"
      aria-describedby="revision-dialog-description"
    >
      <DialogTitle id="revision-dialog-title">{title}</DialogTitle>

      <DialogContent dividers id="revision-dialog-description">
        {!doc && (
          <Typography color="text.secondary">
            No hay documento seleccionado.
          </Typography>
        )}

        {doc && tipo === "poner_en_proceso" && (
          <Alert severity="info" sx={{ mb: 2 }}>
            El documento quedará en proceso hasta nueva revisión.
          </Alert>
        )}

        {doc && needsDate && (
          <TextField
            label={tipo === "ajustar_fecha" ? "Nueva fecha de vencimiento" : "Fecha de vencimiento"}
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
            helperText={dateError ? "La fecha de vencimiento es obligatoria" : ""}
            InputProps={{
              endAdornment:
                expirationDate &&
                getStatusIconComponent(
                  getDeadlineStatus(expirationDate).icon
                )
            }}
            sx={{
              mt: tipo === "ajustar_fecha" ? 0 : 2,
              "& input": {
                color: expirationDate
                  ? undefined
                  : "text.secondary"
              }
            }}
            inputProps={{
              "aria-required": true,
              "aria-invalid": dateError
            }}
          />
        )}

        {doc && needsComment && (
          <TextField
            label="Comentario"
            multiline
            rows={tipo === "poner_en_proceso" ? 3 : 4}
            fullWidth
            value={adminComment || ""}
            onChange={(e) => {
              setAdminComment(e.target.value);
              setCommentError(false);
            }}
            required={commentRequired}
            error={commentError}
            helperText={
              commentError
                ? "El comentario es obligatorio para rechazar"
                : tipo === "poner_en_proceso"
                ? "Opcional"
                : ""
            }
            sx={{ mt: 2 }}
            inputProps={{
              "aria-required": commentRequired,
              "aria-invalid": commentError
            }}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 1 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          aria-label="Cancelar"
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading}
          aria-label="Confirmar"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {loading ? "Procesando…" : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
