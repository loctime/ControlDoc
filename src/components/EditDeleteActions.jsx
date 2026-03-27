import { useState } from 'react';
import {
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress
} from "@mui/material";

/**
 * Componente reutilizable para acciones de editar y eliminar con confirmación.
 *
 * Props:
 * - onEdit: función a ejecutar al hacer clic en editar
 * - onDelete: función a ejecutar al confirmar eliminar
 * - editLabel: texto del botón editar (opcional)
 * - deleteLabel: texto del botón eliminar (opcional)
 * - disabled: desactiva ambos botones (opcional)
 * - loading: muestra spinner mientras se ejecuta algo (opcional)
 */
const EditDeleteActions = ({
  onEdit,
  onDelete,
  editLabel = "Editar",
  deleteLabel = "Eliminar",
  disabled = false,
  loading = false
}) => {
  const [openConfirm, setOpenConfirm] = useState(false);

  const handleDeleteClick = () => {
    setOpenConfirm(true);
  };

  const handleConfirmDelete = () => {
    setOpenConfirm(false);
    onDelete?.();
  };

  return (
    <>
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color="primary"
          onClick={onEdit}
          disabled={disabled || loading}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : editLabel}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDeleteClick}
          disabled={disabled || loading}
        >
          {deleteLabel}
        </Button>
      </Stack>

      <Dialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        aria-labelledby="confirm-dialog-title"
      >
        <DialogTitle id="confirm-dialog-title">¿Confirmar eliminación?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este elemento?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)} color="primary">
            Cancelar
          </Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EditDeleteActions;
