import { Card, CardContent, CardActions, Typography, Divider, IconButton, Tooltip, Box } from '@mui/material';
import { Description as DescriptionIcon, Delete as DeleteIcon } from '@mui/icons-material';

const DocumentCard = ({ document, onDelete, theme }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" alignItems="center" mb={1}>
          <DescriptionIcon sx={{ mr: 1, color: "var(--primary-main)" }} />
          <Typography variant="h6" noWrap sx={{ color: "var(--paper-background-text)" }}>{document.name}</Typography>
        </Box>
        <Divider sx={{ my: 1.5, borderColor: "var(--divider-color)" }} />
        <Typography variant="body2" sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>
          <strong>Aplicable a:</strong> {document.entityType}
        </Typography>
        <Typography variant="body2" sx={{ color: "var(--paper-background-text)", opacity: 0.7 }}>
          <strong>Vencimiento:</strong> {document.deadline?.type}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end' }}>
        <Tooltip title="Eliminar documento">
          <IconButton sx={{ color: "var(--error-main)", "&:hover": { bgcolor: "var(--error-dark)", color: "#fff" } }} onClick={() => onDelete(document.id)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
};

export default DocumentCard;